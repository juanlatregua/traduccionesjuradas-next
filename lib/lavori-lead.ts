// Solicitud de PRECIO a lavori para un LEAD sin pedido (WhatsApp, puerta, builder).
// Chokepoint único (25-ago-2026): lo usan el builder (POST /api/lavori/price-request),
// el enlace de un toque del aviso a staff (GET /api/lavori/one-tap) y, si Juan lo
// activa por lengua, el carril automático de la puerta (LAVORI_LEAD_AUTO_LANGS).
// Regla madre: al payload no viaja PII del lead (ni nombre ni teléfono ni email);
// customerHint se queda en NUESTRA base para que el staff sepa de quién era.
// SOLO SERVIDOR (node:crypto, Blob, Prisma).
import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import {
  buildPriceRequestPayload,
  fetchLavoriCartera,
  lavoriManualRoute,
  resolveLavoriCandidatos,
  sendLavoriSolicitud,
  SOBRE_MAX_FILE_BYTES,
  type BridgeDoc,
  type LavoriMember,
  type LavoriRoute,
} from "@/lib/lavori-bridge";
import { checkDocForSobre, describeDocForSobre } from "@/lib/lavori-sobre";
import { TYPE_LABELS } from "@/lib/diagnosis";

export const LEAD_BLOB_HOST_RE = /^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\//;
export const LEAD_MAX_DOCS = 10;

export type LeadDoc = { url: string; name?: string; pageStart?: number; pageEnd?: number };

/** Nombre neutro: tipo documental si lo hay; jamás el fichero original del
 * cliente (los adjuntos de WhatsApp suelen llevar su nombre). */
export function neutralDocName(doc: { name?: string | null }, index: number): string {
  const safe = String(doc.name || "").replace(/[^\w.\- ]+/g, "_").trim().slice(0, 80);
  return `${safe || `documento-${index + 1}`}${/\.pdf$/i.test(safe) ? "" : ".pdf"}`;
}

/** Etiqueta en español de un tipo documental de la puerta (para el nombre neutro). */
export function docTypeLabelEs(documentType: string | null | undefined, analysisJson: unknown): string | undefined {
  const fromJson = (analysisJson as any)?.document_type?.specific_type_es;
  if (typeof fromJson === "string" && fromJson.trim()) return fromJson.trim();
  const t = String(documentType || "").trim();
  return t ? TYPE_LABELS.es?.[t] || t.replace(/_/g, " ") : undefined;
}

/** Prepara un documento del lead para el sobre (por URL, adenda 25-ago-2026).
 * Sin rango de páginas viaja la URL del blob original tal cual. Con rango (PDF
 * multi-documento segmentado), el recorte se sube a nuestro Blob y viaja ESA URL.
 * Sin pageStart NO hay rango: el Math.max(1,...) antiguo convertía la ausencia
 * en "página 1..1" y el sobre salía amputado (caso PT 14-ago). */
export async function packLeadDoc(doc: LeadDoc, index: number): Promise<BridgeDoc | null> {
  const nombre = neutralDocName(doc, index);
  const start = Math.round(Number(doc.pageStart) || 0);
  const end = Math.round(Number(doc.pageEnd) || start);
  const isPdf = doc.url.toLowerCase().includes(".pdf") || start > 0;

  if (!(isPdf && start > 0)) {
    const r = await checkDocForSobre({ url: doc.url, name: nombre, type: "application/pdf" });
    return r.ok ? r.doc : null;
  }

  const res = await fetch(doc.url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > SOBRE_MAX_FILE_BYTES) return null;
  const entero = describeDocForSobre({ url: doc.url, name: nombre, type: "application/pdf", buf });
  try {
    const { PDFDocument } = require("pdf-lib");
    const src = await PDFDocument.load(buf, { ignoreEncryption: true });
    const total = src.getPageCount();
    const from = Math.min(start, total);
    const to = Math.min(Math.max(end, from), total);
    if (from === 1 && to === total) return entero.ok ? entero.doc : null;
    const out = await PDFDocument.create();
    const indices = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i);
    const copied = await out.copyPages(src, indices);
    copied.forEach((p: any) => out.addPage(p));
    const slice = Buffer.from(await out.save());
    const key = createHash("sha256").update(`${doc.url}#${from}-${to}`).digest("hex").slice(0, 16);
    const blob = await put(`lavori-sobre/${key}-${nombre}`, slice, {
      access: "public",
      contentType: "application/pdf",
    });
    const recorte = describeDocForSobre({ url: blob.url, name: nombre, type: "application/pdf", buf: slice });
    return recorte.ok ? recorte.doc : null;
  } catch (err) {
    console.error("[lavori-lead] pdf-lib error, se envía el original:", err);
    return entero.ok ? entero.doc : null;
  }
}

/** Ruta + cartera viva de un par para una solicitud de lead. null = sin jurados. */
export async function resolveLeadRoute(sourceLang: string, targetLang: string): Promise<{
  route: LavoriRoute;
  cartera: LavoriMember[];
} | null> {
  const s = String(sourceLang || "").trim().toLowerCase();
  const t = String(targetLang || "").trim().toLowerCase();
  if (!s || !t || (s !== "es" && t !== "es")) return null;
  const cartera = await fetchLavoriCartera(s === "es" ? t : s);
  const route = lavoriManualRoute(`${s}->${t}`, cartera.miembros);
  if (!route) return null;
  return { route, cartera: cartera.miembros };
}

export type LeadRequestInput = {
  docs: LeadDoc[];
  sourceLang: string;
  targetLang: string;
  words?: number | null;
  especificaciones?: string | null;
  /** undefined = carril por defecto; lista = elección explícita validada contra la cartera */
  candidatos?: unknown;
  expedienteRef?: string | null;
  customerHint?: string | null;
  createdBy?: string | null;
};

export type LeadRequestResult =
  | { ok: true; ref: string; encargoId: string | null; repetido: boolean; candidatos: string[]; par: string; nombres: string[] }
  | { ok: false; status: 400 | 502; error: string };

/** Crea (o reutiliza, idempotente por contenido) la solicitud de precio en lavori
 * y la fila LavoriPriceRequest. NO acusa al cliente: eso lo decide quien llama. */
export async function sendLeadPriceRequest(input: LeadRequestInput): Promise<LeadRequestResult> {
  const docs = Array.isArray(input.docs) ? input.docs.slice(0, LEAD_MAX_DOCS) : [];
  if (docs.length === 0) return { ok: false, status: 400, error: "Sin documentos que enviar." };
  if (docs.some((d) => !LEAD_BLOB_HOST_RE.test(String(d?.url || "")))) {
    return { ok: false, status: 400, error: "URL de documento no permitida." };
  }
  const sourceLang = String(input.sourceLang || "").trim().toLowerCase();
  const targetLang = String(input.targetLang || "").trim().toLowerCase();
  if (!sourceLang || !targetLang) return { ok: false, status: 400, error: "Faltan los idiomas del par." };
  if (sourceLang !== "es" && targetLang !== "es") {
    return { ok: false, status: 400, error: "Traducción cruzada (sin español): gestión a medida, no vía lavori." };
  }

  const resolved = await resolveLeadRoute(sourceLang, targetLang);
  if (!resolved || (resolved.route.candidatos.length === 0 && !Array.isArray(input.candidatos))) {
    return { ok: false, status: 400, error: `El par ${sourceLang}→${targetLang} no tiene jurados en el tablón de lavori.` };
  }
  const { route, cartera } = resolved;
  const eleccion = resolveLavoriCandidatos(route, input.candidatos, cartera);
  if (!eleccion.ok) return { ok: false, status: 400, error: eleccion.error };
  const candidatos = eleccion.candidatos;
  const nombres = candidatos.map((id) => cartera.find((m) => m.id === id)?.nombre || id);

  // Ref estable a partir del contenido: repetir con los mismos documentos y par
  // NO duplica el encargo (idempotencia local + lavori). Una elección de
  // candidatos distinta del carril por defecto SÍ es otra solicitud.
  const docKeys = docs
    .map((d) => `${d.url}#${Number(d.pageStart) || 1}-${Number(d.pageEnd) || ""}`)
    .sort()
    .join("|");
  const refSeed = `${docKeys}|${route.par}${eleccion.elegidos ? `|${[...candidatos].sort().join(",")}` : ""}`;
  const ref = `LEAD-${createHash("sha256").update(refSeed).digest("hex").slice(0, 10).toUpperCase()}`;

  const previo = await prisma.lavoriPriceRequest.findUnique({ where: { ref } });
  if (previo) {
    return { ok: true, repetido: true, ref, encargoId: previo.encargoId, candidatos: previo.candidatos, par: previo.par, nombres };
  }

  const documentos: BridgeDoc[] = [];
  for (const [i, doc] of docs.entries()) {
    const empaquetado = await packLeadDoc(doc, i);
    if (empaquetado) documentos.push(empaquetado);
  }
  if (documentos.length === 0) return { ok: false, status: 400, error: "No se pudo descargar ningún documento." };

  const words = Number.isFinite(Number(input.words)) && Number(input.words) > 0 ? Math.round(Number(input.words)) : null;
  const especificaciones = String(input.especificaciones || "").trim().slice(0, 2000) || null;
  const payload = buildPriceRequestPayload({
    reference: ref,
    route: { ...route, candidatos },
    words,
    especificaciones,
    documentos,
  });
  const result = await sendLavoriSolicitud(payload);
  if (!result.ok) return { ok: false, status: 502, error: result.error };

  await prisma.lavoriPriceRequest
    .create({
      data: {
        ref,
        par: route.par,
        candidatos,
        expedienteRef: input.expedienteRef ? String(input.expedienteRef).slice(0, 60) : null,
        customerHint: input.customerHint ? String(input.customerHint).slice(0, 160) : null,
        docsCount: documentos.length,
        words,
        encargoId: result.encargoId,
        createdBy: input.createdBy ?? null,
      },
    })
    .catch((err: any) => {
      // Carrera de doble clic: la fila ya existe (unique ref) — el envío fue
      // idempotente en lavori, así que no es un fallo.
      if (err?.code !== "P2002") throw err;
    });

  return { ok: true, repetido: result.repetido, ref, encargoId: result.encargoId, candidatos, par: route.par, nombres };
}

/** Documentos de una sesión de la puerta listos para el sobre (los que tienen
 * fichero, analizados o no) + par y palabras deducidos del análisis. */
export async function leadFromPuertaSession(sessionToken: string) {
  const rows = await prisma.documentAnalysis.findMany({
    where: { sessionToken, fileUrl: { not: "" } },
    orderBy: { createdAt: "asc" },
    take: LEAD_MAX_DOCS,
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      documentType: true,
      analysisJson: true,
      sourceLanguage: true,
      targetLanguage: true,
      estimatedWords: true,
      pageCount: true,
      clientEmail: true,
      clientName: true,
      clientPhone: true,
    },
  });
  if (rows.length === 0) return null;
  const known = (l: string | null | undefined) => (l && l !== "unknown" ? l.toLowerCase() : null);
  const sourceLang = rows.map((r) => known(r.sourceLanguage)).find(Boolean) || null;
  const targetLang = rows.map((r) => known(r.targetLanguage)).find(Boolean) || "es";
  const words = rows.reduce((acc, r) => acc + (r.estimatedWords || 0), 0) || null;
  const docs: LeadDoc[] = rows.map((r, i) => ({
    url: r.fileUrl,
    name: docTypeLabelEs(r.documentType, r.analysisJson) || `documento-${i + 1}`,
  }));
  const tipos = Array.from(new Set(docs.map((d) => d.name).filter(Boolean))) as string[];
  const contact = {
    name: rows.find((r) => r.clientName)?.clientName || null,
    email: rows.find((r) => r.clientEmail)?.clientEmail || null,
    phone: rows.find((r) => r.clientPhone)?.clientPhone || null,
  };
  return { rows, docs, sourceLang, targetLang, words, tipos, contact };
}
