import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";
import { sendPriceRequestAckToClient } from "@/lib/quote-email";
import { findLiveSiblingLeadRequest, sendLeadPriceRequest, validarAntesDeRetirar, type LeadDoc, type LeadRequestInput } from "@/lib/lavori-lead";
import { retireLeadRequest } from "@/lib/lavori-retire";
import { freezeQuoteForRepricing } from "@/lib/precio-tras-envio";
import { parFromLangs } from "@/lib/lavori-dup-guard";
import { sombraBloqueo } from "@/lib/caso/sombra";
import { anclasDeExpediente } from "@/lib/caso/sombra-plan";
import { decidirSolicitud, quotesACongelar, retirarEnOrden } from "@/lib/caso/hilo";
import { casoDeLaPeticion, rastroHilo, reservarHilo, solicitudesVivasDelHilo } from "@/lib/caso/hilo-db";
import type { Anclas } from "@/lib/caso/resolver-db";

export const runtime = "nodejs";

/* Solicitud de PRECIO vía lavori para un LEAD (WhatsApp/teléfono/puerta) SIN pedido,
   desde el builder: el staff sube o hereda los documentos, elige el par y los manda
   al candidato del par como encargo dirigido sin precio (adenda 11-ago-2026).
   La vuelta (precio_propuesto) aterriza en LavoriPriceRequest vía /api/lavori/eventos.
   Toda la lógica vive en lib/lavori-lead.ts (mismo carril que el enlace de un
   toque del aviso a staff); aquí solo auth, forma del body, hilo del caso y acuse.

   Hilo único (F3b, Juan 14-oct-2026): como mucho UNA solicitud viva por caso+par
   (serializado con candado por caso+par). Si ya la hay, se devuelve esa (200, existing).
   «Volver a pedir» (otro jurado, reclamar) va sobre el hilo: lavori no admite añadir
   candidatos a una ref, así que se valida el envío nuevo, se retira la viva en lavori
   y solo entonces sale la nueva, con su caso y su presupuesto heredados. */

const s = (x: unknown, max: number) => (typeof x === "string" && x.trim() ? x.trim().slice(0, max) : null);
const eur = (c: number) => `${(c / 100).toFixed(2)} €`;

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actor = staff.email || "staff";

  try {
    const body = (await req.json().catch(() => null)) as {
      docs?: LeadDoc[];
      sourceLang?: string;
      targetLang?: string;
      words?: number;
      expedienteRef?: string;
      customerHint?: string;
      customerPhone?: string;
      customerEmail?: string;
      customerName?: string;
      especificaciones?: string;
      candidatos?: string[];
      casoId?: string;
      lavoriLeadRef?: string;
      sessionToken?: string;
      quoteId?: string;
      /** Retirar la solicitud viva del caso+par y pedir de nuevo (otro jurado o reclamar). */
      volverAPedir?: boolean;
      /** El staff ha leído que el presupuesto enviado quedará con el pago congelado. */
      confirmarCongelar?: boolean;
    } | null;

    const docs = Array.isArray(body?.docs) ? body!.docs! : [];
    const parSolicitado = parFromLangs(body?.sourceLang, body?.targetLang);
    const contacto = { email: body?.customerEmail, phone: body?.customerPhone, nombre: body?.customerName };
    const sessionToken = s(body?.sessionToken, 80);
    const anclas: Anclas = {
      ...anclasDeExpediente(body?.expedienteRef),
      ...(sessionToken ? { sessionToken, expedienteRef: `puerta:${sessionToken}` } : {}),
      casoId: s(body?.casoId, 40),
      lprRef: s(body?.lavoriLeadRef, 40),
      quoteId: s(body?.quoteId, 40),
    };
    const leadInput: LeadRequestInput = {
      docs,
      sourceLang: String(body?.sourceLang || ""),
      targetLang: String(body?.targetLang || ""),
      words: body?.words,
      especificaciones: body?.especificaciones,
      candidatos: body?.candidatos,
      // Staff en el constructor con candidatos elegidos: único camino que puede forzar un par de la casa.
      forzarCasa: Array.isArray(body?.candidatos) && body!.candidatos!.length > 0,
      expedienteRef: body?.expedienteRef,
      customerHint: body?.customerHint,
      createdBy: staff.email ?? null,
      contacto,
      anclas,
    };

    let caso: Awaited<ReturnType<typeof casoDeLaPeticion>> = { resuelto: false, casoId: null, accion: null, regla: null };
    if (parSolicitado) {
      const urls = docs.map((d) => String(d?.url || "")).filter(Boolean);
      const hashes = urls.length
        ? (await prisma.documentAnalysis.findMany({ where: { fileUrl: { in: urls }, fileHash: { not: null } }, select: { fileHash: true } }).catch(() => [])).map((h) => h.fileHash!)
        : [];
      caso = await casoDeLaPeticion({ entrada: "price_request", contacto, pares: [parSolicitado], docs: { hashes, contentKeys: [] }, anclas, actor });
    }
    const casoHilo = caso.casoId ?? anclas.casoId ?? null;

    // Reserva corta del hilo (caso+par): una segunda petición mientras esta envía → 409.
    const reserva = parSolicitado && casoHilo ? await reservarHilo(casoHilo, parSolicitado, actor) : null;
    if (reserva && !reserva.ok) return NextResponse.json({ ok: false, error: reserva.error }, { status: 409 });

    const flujo = async () => {
      let casoId = casoHilo;
      if (parSolicitado) {
        const vivas = await solicitudesVivasDelHilo(casoId, anclas);
        casoId ||= vivas.find((l) => l.casoId)?.casoId ?? null;
        const d = decidirSolicitud({ lprs: vivas, par: parSolicitado, ahora: new Date(), volverAPedir: body?.volverAPedir === true });

        if (d.accion === "reutilizar") {
          const v = d.viva;
          return NextResponse.json({
            ok: true,
            existing: v.ref,
            ref: v.ref,
            estado: v.status,
            precio: v.priceCents,
            plazoDias: v.plazoDias,
            miembroNombre: v.miembroNombre,
            repetido: true,
          });
        }
        if (d.accion === "esperar") {
          return NextResponse.json({ ok: false, error: `${d.viva.ref} se está retirando en lavori ahora mismo: espera unos segundos y vuelve a pedir.` }, { status: 409 });
        }
        if (d.accion === "bloquear") {
          return NextResponse.json({ ok: false, error: `No se vuelve a pedir: ${d.motivo}.` }, { status: 409 });
        }
        if (d.accion === "reemplazar") {
          const refs = d.retirar.map((l) => l.ref);
          if (d.congelar.length > 0 && body?.confirmarCongelar !== true) {
            const conCifra = d.retirar.find((l) => l.priceCents && l.quoteId && d.congelar.includes(l.quoteId));
            return NextResponse.json(
              {
                ok: false,
                needsFreezeConfirm: true,
                error: `El presupuesto enviado lleva el coste de ${conCifra?.miembroNombre || "el jurado"} (${conCifra?.priceCents ? eur(conCifra.priceCents) : "su cifra"}, ${conCifra?.ref}). Al volver a pedir, el pago quedará congelado hasta el nuevo precio.`,
              },
              { status: 409 }
            );
          }
          const nueva: LeadRequestInput = {
            ...leadInput,
            expedienteRef: body?.expedienteRef || d.retirar.find((l) => l.expedienteRef)?.expedienteRef || null,
            ...(casoId ? { casoId } : {}),
          };
          const previa = await validarAntesDeRetirar(nueva, refs);
          if (!previa.ok) return NextResponse.json({ ok: false, error: `No se ha retirado nada: ${previa.error}` }, { status: previa.status });

          const { retiradas, fallo } = await retirarEnOrden(d.retirar, (l) =>
            retireLeadRequest({
              id: l.id,
              actorEmail: actor,
              motivo: "volver a pedir precio desde el constructor",
              terminal: "RETIRED",
              lavoriMotivo: "reasignado",
              relanzar: false,
            })
          );
          if (fallo) {
            if (retiradas.length) {
              await rastroHilo(casoId, "solicitud_reemplazada", actor, `parcial:${retiradas.join(",")}:${Date.now()}`, { retiradas, fallida: fallo.ref, error: fallo.error, nueva: null });
            }
            return NextResponse.json(
              { ok: false, error: `${retiradas.length ? `${retiradas.join(", ")} retirada; ` : ""}${fallo.ref} no se pudo retirar (${fallo.error}). No se ha pedido otra.` },
              { status: fallo.status }
            );
          }
          const result = await sendLeadPriceRequest(nueva);
          const congelados: string[] = [];
          for (const quoteId of quotesACongelar(result.ok, d.congelar)) {
            if (await freezeQuoteForRepricing({ quoteId, retiradas, actorEmail: actor })) congelados.push(quoteId);
          }
          if (!result.ok) {
            await rastroHilo(casoId, "solicitud_reemplazada", actor, `fallo:${retiradas.join(",")}:${Date.now()}`, { retiradas, nueva: null, error: result.error, sinCongelar: d.congelar });
            return NextResponse.json(
              { ok: false, error: `${retiradas.join(", ")} quedó retirada en lavori, pero la nueva no salió (${result.error}). Vuelve a pedir desde aquí.` },
              { status: result.status }
            );
          }
          if (d.quoteId) {
            await prisma.lavoriPriceRequest
              .updateMany({ where: { ref: result.ref, quoteId: null }, data: { quoteId: d.quoteId } })
              .catch((err) => console.error("[lavori-price-request] heredar presupuesto falló:", err));
          }
          await rastroHilo(casoId, "solicitud_reemplazada", actor, result.ref, { retiradas, nueva: result.ref, candidatos: result.candidatos, quoteId: d.quoteId, congelados });
          return NextResponse.json(
            { ok: true, ref: result.ref, encargoId: result.encargoId, repetido: result.repetido, nombres: result.nombres, reemplaza: retiradas, congelados: congelados.length },
            { status: 201 }
          );
        }
      }

      // Guarda vieja (red): misma persona + par con solicitud viva en OTRA gestión. Solo
      // pasa si el caso dice que es otro caso (adjunta a uno distinto, o crea por nuevo /
      // documento distinto); dudoso o sin caso → se frena, sin segundo clic.
      if (parSolicitado && (body?.customerEmail || body?.customerPhone)) {
        const viva = await findLiveSiblingLeadRequest({ email: body?.customerEmail, phone: body?.customerPhone, par: parSolicitado, days: 7 }).catch(() => null);
        const otraGestion = viva && (viva.request.expedienteRef || null) !== (body?.expedienteRef || null);
        const casoLoSepara =
          caso.resuelto &&
          !!viva?.request.casoId &&
          (casoId ? viva.request.casoId !== casoId : caso.accion === "crear" && (caso.regla === "nuevo" || caso.regla === "documento_distinto"));
        if (viva && otraGestion && !casoLoSepara) {
          await sombraBloqueo(
            { entrada: "price_request", contacto, pares: [parSolicitado], anclas, actor },
            parSolicitado,
            { guarda: "findLiveSiblingLeadRequest", objetoGuarda: { lprId: viva.request.id }, refs: { viva: viva.request.ref }, dedupeKey: `${viva.request.ref}|${body?.expedienteRef || ""}` }
          );
          return NextResponse.json(
            {
              ok: false,
              error: `Esta persona ya tiene una solicitud viva para ${parSolicitado}: ${viva.request.ref} (${viva.request.status}${viva.quote ? `, presupuesto ${viva.quote.quoteNumber}` : ""}). Continúa ahí (ábrela con ?lead=${viva.request.ref}) o vuelve a pedir sobre ella.`,
            },
            { status: 409 }
          );
        }
      }

      const result = await sendLeadPriceRequest(leadInput);
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      }

      // Acuse al cliente (12-ago SMS; 24-ago también email): al salir los documentos
      // hacia el traductor, el cliente recibe UN aviso — email si es real, SMS/WhatsApp
      // si es lead solo-WhatsApp. Con await: sin él, la lambda se congela al responder
      // y la llamada muere sin salir (E2E 12-ago). Un fallo del acuse no tumba el POST.
      // Solo si el encargo es NUEVO: en un reintento (repetido) el cliente ya lo recibió.
      if (!result.repetido) {
        await sendPriceRequestAckToClient({
          name: body?.customerName,
          email: body?.customerEmail,
          phone: body?.customerPhone,
        });
      }

      return NextResponse.json(
        { ok: true, ref: result.ref, encargoId: result.encargoId, repetido: result.repetido, nombres: result.nombres },
        { status: result.repetido ? 200 : 201 }
      );
    };
    try {
      return await flujo();
    } finally {
      if (reserva?.ok) await reserva.liberar();
    }
  } catch (err) {
    console.error("[lavori-price-request lead] error", err);
    return NextResponse.json(
      { ok: false, error: "Error al enviar la solicitud de precio." },
      { status: 500 }
    );
  }
}
