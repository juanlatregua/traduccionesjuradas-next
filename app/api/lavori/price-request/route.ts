import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import {
  lavoriManualRoute,
  fetchLavoriCartera,
  buildPriceRequestPayload,
  sendLavoriSolicitud,
  resolveLavoriCandidatos,
  type BridgeDoc,
} from "@/lib/lavori-bridge";
import { sendNotification, formatPhoneSpain } from "@/lib/sms";

export const runtime = "nodejs";

/* Solicitud de PRECIO vía lavori para un LEAD (WhatsApp/teléfono) SIN pedido:
   el staff sube los documentos al builder, elige el par y los manda al candidato
   del par como encargo dirigido sin precio (adenda 11-ago-2026 del contrato).
   La vuelta (precio_propuesto) aterriza en LavoriPriceRequest vía /api/lavori/eventos.
   Regla madre: al payload no viaja PII del lead (ni nombre ni teléfono);
   customerHint se queda en NUESTRA base para que el staff sepa de quién era. */

const BLOB_HOST_RE = /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//;
const MAX_DOC_BYTES = 15 * 1024 * 1024;
const MAX_DOCS = 10;

type LeadDoc = { url: string; name?: string; pageStart?: number; pageEnd?: number };

/** Descarga el blob y, si es un trozo de PDF multi-documento, extrae su rango. */
async function packLeadDoc(doc: LeadDoc, index: number): Promise<BridgeDoc | null> {
  const res = await fetch(doc.url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  let buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_DOC_BYTES) return null;

  const contentType = res.headers.get("content-type") || "application/pdf";
  const isPdf = contentType.includes("pdf") || doc.url.toLowerCase().includes(".pdf");
  // Sin pageStart NO hay rango: viaja el PDF ENTERO. El Math.max(1,...) anterior
  // convertía la ausencia de rango en "página 1..1" y el sobre salía amputado
  // (caso PT 14-ago: 1 de 8 páginas; lo cazó el propio traductor).
  const start = Math.round(Number(doc.pageStart) || 0);
  const end = Math.round(Number(doc.pageEnd) || start);
  if (isPdf && start > 0) {
    try {
      const { PDFDocument } = require("pdf-lib");
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const total = src.getPageCount();
      const from = Math.min(start, total);
      const to = Math.min(Math.max(end, from), total);
      if (!(from === 1 && to === total)) {
        const out = await PDFDocument.create();
        const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
        const copied = await out.copyPages(src, indices);
        copied.forEach((p: any) => out.addPage(p));
        buf = Buffer.from(await out.save());
      }
    } catch (err) {
      console.error("[lavori-lead] pdf-lib error, se envía el original:", err);
    }
  }

  // Nombre neutro: tipo documental si lo hay; jamás el fichero original del
  // cliente (los adjuntos de WhatsApp suelen llevar su nombre).
  const safe = String(doc.name || "").replace(/[^\w.\- ]+/g, "_").trim().slice(0, 80);
  const nombre = `${safe || `documento-${index + 1}`}${/\.pdf$/i.test(safe) ? "" : ".pdf"}`;
  return { nombre, contentType: isPdf ? "application/pdf" : contentType, base64: buf.toString("base64") };
}

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      docs?: LeadDoc[];
      sourceLang?: string;
      targetLang?: string;
      words?: number;
      expedienteRef?: string;
      customerHint?: string;
      customerPhone?: string;
      especificaciones?: string;
      candidatos?: string[];
    } | null;

    const docs = Array.isArray(body?.docs) ? body!.docs!.slice(0, MAX_DOCS) : [];
    if (docs.length === 0) {
      return NextResponse.json({ ok: false, error: "Sin documentos que enviar." }, { status: 400 });
    }
    if (docs.some((d) => !BLOB_HOST_RE.test(String(d?.url || "")))) {
      return NextResponse.json({ ok: false, error: "URL de documento no permitida." }, { status: 400 });
    }

    const sourceLang = String(body?.sourceLang || "").trim().toLowerCase();
    const targetLang = String(body?.targetLang || "").trim().toLowerCase();
    if (!sourceLang || !targetLang) {
      return NextResponse.json({ ok: false, error: "Faltan los idiomas del par." }, { status: 400 });
    }
    if (sourceLang !== "es" && targetLang !== "es") {
      return NextResponse.json(
        { ok: false, error: "Traducción cruzada (sin español): gestión a medida, no vía lavori." },
        { status: 400 }
      );
    }
    // Cartera viva de la lengua (respaldo estático si lavori no responde): el
    // carril fijo si existe; si no, toda la cartera con canal.
    const cartera = await fetchLavoriCartera(sourceLang === "es" ? targetLang : sourceLang);
    const route = lavoriManualRoute(`${sourceLang}->${targetLang}`, cartera.miembros);
    if (!route || (route.candidatos.length === 0 && !Array.isArray(body?.candidatos))) {
      return NextResponse.json(
        { ok: false, error: `El par ${sourceLang}→${targetLang} no tiene jurados en el tablón de lavori.` },
        { status: 400 }
      );
    }

    // Candidatos elegidos a mano (21-ago-2026): "todos los de la lengua" o "uno
    // en concreto"; ausente → carril por defecto.
    const eleccion = resolveLavoriCandidatos(route, body?.candidatos, cartera.miembros);
    if (!eleccion.ok) {
      return NextResponse.json({ ok: false, error: eleccion.error }, { status: 400 });
    }
    const candidatos = eleccion.candidatos;

    // Ref estable a partir del contenido de la solicitud: repetir el clic con los
    // mismos documentos y par NO duplica el encargo (idempotencia local + lavori).
    // Una elección de candidatos distinta del carril por defecto SÍ es otra
    // solicitud (mandar a Vanessa y luego a todos son dos encargos a propósito);
    // solo entra en la ref cuando se eligió, para no mover las refs antiguas.
    const docKeys = docs
      .map((d) => `${d.url}#${Number(d.pageStart) || 1}-${Number(d.pageEnd) || ""}`)
      .sort()
      .join("|");
    const refSeed = `${docKeys}|${route.par}${eleccion.elegidos ? `|${[...candidatos].sort().join(",")}` : ""}`;
    const ref = `LEAD-${createHash("sha256").update(refSeed).digest("hex").slice(0, 10).toUpperCase()}`;

    const previo = await prisma.lavoriPriceRequest.findUnique({ where: { ref } });
    if (previo) {
      return NextResponse.json({ ok: true, repetido: true, ref, encargoId: previo.encargoId });
    }

    const documentos: BridgeDoc[] = [];
    for (const [i, doc] of docs.entries()) {
      const empaquetado = await packLeadDoc(doc, i);
      if (empaquetado) documentos.push(empaquetado);
    }
    if (documentos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se pudo descargar ningún documento." },
        { status: 400 }
      );
    }

    const words = Number.isFinite(Number(body?.words)) && Number(body?.words) > 0 ? Math.round(Number(body?.words)) : null;
    // Especificaciones del encargo (adenda 12-ago): texto libre del staff, sin PII
    // del cliente (misma regla madre que la descripción). No entra en la ref: el
    // mismo lead con especificaciones retocadas sigue siendo el mismo encargo.
    const especificaciones = String(body?.especificaciones || "").trim().slice(0, 2000) || null;
    const payload = buildPriceRequestPayload({
      reference: ref,
      route: { ...route, candidatos },
      words,
      especificaciones,
      documentos,
    });
    const result = await sendLavoriSolicitud(payload);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }

    await prisma.lavoriPriceRequest
      .create({
        data: {
          ref,
          par: route.par,
          candidatos,
          expedienteRef: body?.expedienteRef ? String(body.expedienteRef).slice(0, 60) : null,
          customerHint: body?.customerHint ? String(body.customerHint).slice(0, 160) : null,
          docsCount: documentos.length,
          words,
          encargoId: result.encargoId,
          createdBy: staff.email ?? null,
        },
      })
      .catch((err: any) => {
        // Carrera de doble clic: la fila ya existe (unique ref) — el envío fue
        // idempotente en lavori, así que no es un fallo.
        if (err?.code !== "P2002") throw err;
      });

    // Acuse al cliente (petición Juan 12-ago): al salir los documentos hacia el
    // traductor, el lead recibe un WhatsApp/SMS de cortesía. Con await: sin él,
    // la lambda se congela al responder y la llamada a Twilio muere sin salir
    // (cazado en el E2E del 12-ago). Un fallo del SMS no tumba la solicitud.
    const customerPhone = String(body?.customerPhone || "").trim();
    if (customerPhone) {
      const acuse = await sendNotification({
        to: formatPhoneSpain(customerPhone),
        body:
          "Gracias por su solicitud. Sus documentos van a ser tratados directamente " +
          "por un traductor jurado nombrado por el MAEC y le indicaremos el precio " +
          "en breve. Gracias por su atención.\n— Traducciones Juradas · traduccionesjuradas.net",
      }).catch((err) => ({ ok: false as const, error: String(err) }));
      if (!acuse.ok) console.error("[lavori-lead] acuse al cliente fallo:", acuse.error);
    }

    return NextResponse.json(
      { ok: true, ref, encargoId: result.encargoId, repetido: result.repetido },
      { status: 201 }
    );
  } catch (err) {
    console.error("[lavori-price-request lead] error", err);
    return NextResponse.json(
      { ok: false, error: "Error al enviar la solicitud de precio." },
      { status: 500 }
    );
  }
}
