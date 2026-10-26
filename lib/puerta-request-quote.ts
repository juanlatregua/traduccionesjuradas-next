// lib/puerta-request-quote.ts
// Enrutado de «Solicitar presupuesto» desde la puerta. Extraído de
// app/api/puerta/request-quote/route.ts para que lo reutilice también el enlace
// firmado «revisar a mano» del email de recuperación (app/revisar-presupuesto).
// Comportamiento idéntico al de la ruta.

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendPriceRequestAckToClient } from "@/lib/quote-email";
import { sendStaffAlertSMS } from "@/lib/sms";
import { getLanguageName } from "@/lib/pricing-engine/languages";
import { findLiveSiblingLeadRequest, leadFromPuertaSession, resolveLeadRoute, sendLeadPriceRequest } from "@/lib/lavori-lead";
import { lavoriOneTapUrl } from "@/lib/lavori-onetap";
import { autoQuoteFromPuertaSession } from "@/lib/learned-rates";
import { directMembersFor } from "@/lib/lavori-directo";
import { casaJuradoFor } from "@/lib/lavori-bridge";
import { findRecurrentClient } from "@/lib/recurrent-client-db";
import { recurrentLabel } from "@/lib/recurrent-client";
import { findOpenSiblings, sameDocumentSiblingIds } from "@/lib/open-siblings-db";
import { blockingSibling, describeSibling } from "@/lib/open-siblings";
import { parFromLangs } from "@/lib/lavori-dup-guard";
import { casoEnSombra, compararGuarda, estamparSesion } from "@/lib/caso/sombra";
import { paresDe } from "@/lib/caso/sombra-plan";
import { deadlineLine, deadlineOf, jurorDeadlineNote, urgentSubjectPrefix, type DeadlineUrgency } from "@/lib/needed-by";
import { saveSessionDeadline } from "@/lib/needed-by-db";
import { AVISO_REPETIDO_HORAS, clavesDocs, decidirAvisoHumano, dedupeAviso, type AvisoPrevio } from "@/lib/caso/aviso-humano";

const horaMadrid = (d: Date) =>
  d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** «Ya está en lavori: LEAD-x enviada a <jurado> a las HH:MM» con la hora real de la solicitud. */
async function lineaEnLavori(ref: string, nombres: string, repetido: boolean): Promise<string> {
  const l = await prisma.lavoriPriceRequest.findUnique({ where: { ref }, select: { createdAt: true } }).catch(() => null);
  return `Ya está en lavori: ${ref} enviada a ${nombres || "el jurado"} el ${horaMadrid(l?.createdAt ?? new Date())}${
    repetido ? " (es la misma solicitud de antes: NO se ha enviado otra)" : " (ahora)"
  }.`;
}

/** Reclama el aviso en el rastro del caso antes de enviarlo. Sin caso o si el rastro falla: aviso completo (fail-open). */
async function reclamarAvisoHumano(
  casoId: string | null,
  claves: string[],
  solicitudNueva: string | null,
  sesion: string,
  contacto: { email: string; phone: string }
): Promise<{ tipo: "completo" | "corto" | "nada"; casoRef: string | null; eventoId: string | null }> {
  if (!casoId) return { tipo: "completo", casoRef: null, eventoId: null };
  try {
    const [c, eventos] = await Promise.all([
      prisma.caso.findUnique({ where: { id: casoId }, select: { ref: true, estado: true } }),
      prisma.casoEvento.findMany({
        where: { casoId, tipo: { in: ["aviso_humano", "aviso_humano_repetido"] } },
        select: { tipo: true, createdAt: true, payload: true },
      }),
    ]);
    const casoRef = c?.ref ?? null;
    const previos: AvisoPrevio[] = eventos.map((e) => ({
      tipo: e.tipo as AvisoPrevio["tipo"],
      createdAt: e.createdAt,
      docs: ((e.payload as { docs?: string[] } | null)?.docs || []).map(String),
      email: (e.payload as { email?: string | null } | null)?.email ?? null,
      phone: (e.payload as { phone?: string | null } | null)?.phone ?? null,
    }));
    const ahora = new Date();
    const d = decidirAvisoHumano({ casoId, casoEstado: c?.estado, contacto, docs: claves, previos, solicitudNueva: Boolean(solicitudNueva), ahora });
    if (d.tipo === "nada") return { tipo: "nada", casoRef, eventoId: null };
    const base = dedupeAviso(claves);
    const dedupeKey =
      d.tipo === "completo"
        ? // nº de avisos completos previos: dos peticiones simultáneas chocan; las siguientes no.
          `${base}|n${previos.filter((p) => p.tipo === "aviso_humano").length}`.slice(0, 190)
        : `${base}|${Math.floor(ahora.getTime() / (AVISO_REPETIDO_HORAS * 36e5))}`.slice(0, 190);
    let eventoId: string;
    try {
      ({ id: eventoId } = await prisma.casoEvento.create({
        data: {
          casoId,
          tipo: d.tipo === "completo" ? "aviso_humano" : "aviso_humano_repetido",
          dedupeKey,
          actor: "system:puerta",
          payload: { docs: claves, docsNuevos: d.docsNuevos, solicitud: solicitudNueva, sesion, email: contacto.email || null, phone: contacto.phone || null },
        },
        select: { id: true },
      }));
    } catch (err: any) {
      // Otra petición simultánea ya lo reclamó: ese aviso basta.
      if (err?.code === "P2002") return { tipo: "nada", casoRef, eventoId: null };
      throw err;
    }
    return { tipo: d.tipo, casoRef, eventoId };
  } catch (err) {
    console.error("[puerta:request-quote] rastro del aviso falló; se avisa igual:", err);
    return { tipo: "completo", casoRef: null, eventoId: null };
  }
}

export type PuertaQuoteResult = { status: number; body: Record<string, unknown> };

function out(body: Record<string, unknown>, init?: { status?: number }): PuertaQuoteResult {
  return { status: init?.status ?? 200, body };
}

export async function routePuertaQuoteRequest(input: {
  sessionToken: string;
  email?: string;
  phone?: string;
  locale?: string | null;
  deadline?: { urgency: DeadlineUrgency; neededBy: Date | null } | null;
}): Promise<PuertaQuoteResult> {
  const token = input.sessionToken;
  const email = input.email || "";
  const phone = input.phone || "";
  const locale = input.locale ?? null;
  try {

    // Propiedad por sessionToken (igual que documents/contact): solo su sesión.
    const docs = await prisma.documentAnalysis.findMany({
      where: { sessionToken: token },
      orderBy: { createdAt: "asc" },
      take: 20,
      select: {
        id: true,
        fileName: true,
        documentType: true,
        sourceLanguage: true,
        targetLanguage: true,
        estimatedWords: true,
        pageCount: true,
        quoteAmount: true,
        clientEmail: true,
        clientName: true,
        clientPhone: true,
        source: true,
        urgency: true,
        neededBy: true,
      },
    });
    if (docs.length === 0) {
      return out({ ok: false, error: "Sesión no encontrada." }, { status: 404 });
    }

    const contactEmail = email || docs.find((d) => d.clientEmail)?.clientEmail || "";
    const contactPhone = phone || docs.find((d) => d.clientPhone)?.clientPhone || "";
    const fromWhatsApp = docs.some((d) => d.source === "whatsapp");
    const phoneDigits = contactPhone.replace(/\D/g, "");
    const waDigits = phoneDigits.length === 9 ? `34${phoneDigits}` : phoneDigits;
    if (!contactEmail && !contactPhone) {
      return out(
        { ok: false, error: "Necesitamos un email o un teléfono para responderte." },
        { status: 400 }
      );
    }

    // Persistir el contacto nuevo SOLO donde falta (el capturado en el spinner
    // no se pisa: es el que dio el cliente con su consentimiento).
    if (email) {
      await prisma.documentAnalysis.updateMany({
        where: { sessionToken: token, clientEmail: null },
        data: { clientEmail: email },
      });
    }
    if (phone) {
      await prisma.documentAnalysis.updateMany({
        where: { sessionToken: token, clientPhone: null },
        data: { clientPhone: phone },
      });
    }

    // Cliente que vuelve: solo para staff (avisos). La respuesta de la puerta es idéntica para todos.
    const recurrente = await findRecurrentClient({ email: contactEmail, phone: contactPhone });
    let recurrenteTxt = recurrentLabel(recurrente);
    const recurrenteSms = recurrente.kind === "recurrent" ? "RECURRENTE · " : recurrente.kind === "possible" ? "¿recurrente? · " : "";

    const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    if (recurrente.kind !== "none") recurrenteTxt += ` · Historial: ${baseUrl}/zona-traductor/clientes/${encodeURIComponent(recurrente.email)}`;
    const lineas = docs.map((d) => {
      const par = `${getLanguageName(d.sourceLanguage || "?")} → ${getLanguageName(d.targetLanguage || "?")}`;
      const ref = d.quoteAmount ? ` · motor (referencia interna): ${Number(d.quoteAmount).toFixed(2)} € netos` : "";
      return `· ${d.fileName} — ${d.documentType || "documento"} · ${par} · ${d.estimatedWords ?? "?"} palabras / ${d.pageCount ?? "?"} págs${ref}`;
    });
    // El builder importa los documentos de la puerta por sesión (25-ago-2026):
    // ya no hay que volver a soltar el PDF.
    const builderUrl =
      `${baseUrl}/zona-traductor/presupuesto?session=${encodeURIComponent(token)}` +
      `&customerEmail=${encodeURIComponent(contactEmail)}` +
      (docs[0]?.clientName ? `&customerName=${encodeURIComponent(docs[0].clientName)}` : "") +
      (contactPhone ? `&customerPhone=${encodeURIComponent(contactPhone)}` : "");

    // Carril directo a lavori (orden de Juan 25-ago: «un carril y un aviso directo»):
    // si el par tiene jurados con canal en el tablón, el aviso lleva un enlace de
    // UN TOQUE que dispara la solicitud de precio con estos mismos documentos.
    // Con LAVORI_LEAD_AUTO_LANGS (p. ej. "de,he") la solicitud sale sola al llegar
    // el lead y el aviso ya dice a quién fue. Sin PII en el sobre (regla madre).
    const lead = await leadFromPuertaSession(token);

    // MISMA persona con otra cosa abierta (9-oct-2026: 69 casos en 60 días, 7 con dos
    // solicitudes a lavori, 11 con dos presupuestos enviados). Solo se BLOQUEA si es el MISMO
    // DOCUMENTO (huella del dup-guard) con solicitud o presupuesto abierto por el mismo email:
    // solo aviso a Juan con [DUPLICADO?] y enlace al abierto. Misma persona y par pero otro
    // documento → flujo normal + aviso [MISMA PERSONA]. Solo teléfono = aviso, nunca bloqueo.
    // La respuesta pública es idéntica en todos los casos.
    const parLead = lead?.sourceLang ? parFromLangs(lead.sourceLang, lead.targetLang) : null;
    // Caso en sombra (F2): se resuelve aquí, antes de crear nada, y se estampa en la sesión.
    // Las guardas de abajo siguen decidiendo; si el resolver falla, caso = null y nada cambia.
    const contacto = { email: contactEmail, phone: contactPhone, nombre: docs[0]?.clientName };
    const caso = await casoEnSombra(
      {
        entrada: "puerta",
        contacto,
        pares: parLead ? [parLead] : paresDe(docs[0]?.sourceLanguage, docs[0]?.targetLanguage),
        docs: { hashes: (lead?.rows || []).map((r) => r.fileHash).filter((h): h is string => Boolean(h)), contentKeys: [] },
        anclas: { sessionToken: token, expedienteRef: `puerta:${token}` },
        actor: "system:puerta",
      },
      parLead
    );
    await estamparSesion(token, caso?.casoId);
    // Plazo del cliente (26-oct-2026): el que manda ahora, o el que ya dejó en la sesión.
    if (input.deadline) {
      await saveSessionDeadline(token, input.deadline).catch((err) => console.error("[puerta:request-quote] plazo no guardado:", err));
    } else if (caso?.casoId) {
      const previo = deadlineOf(docs);
      if (previo?.urgency) {
        await prisma.caso.update({ where: { id: caso.casoId }, data: { urgency: String(previo.urgency), neededBy: previo.neededBy } }).catch(() => {});
      }
    }
    const plazo = input.deadline ?? deadlineOf(docs);
    const plazoTxt = deadlineLine(plazo);
    const plazoAsunto = urgentSubjectPrefix(plazo);
    const plazoJurado = jurorDeadlineNote(plazo);
    const hermanos = await findOpenSiblings({ email: contactEmail, phone: contactPhone, par: parLead, excludeSession: token });
    const mismoDoc = await sameDocumentSiblingIds(
      hermanos,
      (lead?.rows || []).map((r) => ({ url: r.fileUrl, hash: r.fileHash, pageCount: r.pageCount })),
      parLead
    );
    const bloqueo = blockingSibling(hermanos, mismoDoc);
    const hermanosTxt = hermanos.length
      ? `${bloqueo ? "⚠ [DUPLICADO?] NO se ha lanzado lavori ni borrador: " : "[MISMA PERSONA] ya tiene abierto: "}${hermanos
          .slice(0, 3)
          .map((h) => `${describeSibling(h)} → ${h.url}`)
          .join(" · ")}`
      : "";
    if (hermanos.length && !bloqueo) {
      // Rastro en BD ANTES de avisar (FunnelEvent: uno por sesión y paso); el aviso [MISMA PERSONA]
      // viaja en el email de Juan de cada rama (hermanosTxt).
      await prisma.funnelEvent
        .upsert({
          where: { sessionId_step: { sessionId: `puerta:${token}`, step: "misma_persona" } },
          create: { sessionId: `puerta:${token}`, step: "misma_persona", reference: hermanos[0].ref.slice(0, 60), metadata: { hermanos: hermanos.slice(0, 5).map((h) => h.ref) } },
          update: {},
        })
        .catch((err) => console.error("[puerta:request-quote] rastro misma_persona fallo:", err));
    }
    if (bloqueo) {
      await compararGuarda({ vieja: "bloquea", guarda: "open-siblings", objeto: "solicitud", sombra: caso, objetoGuarda: bloqueo.kind === "quote" ? { quoteId: bloqueo.id } : { lprId: bloqueo.id }, refs: { bloqueo: bloqueo.ref, sesion: token }, dedupeKey: token });
      await sendMail({
        to: adminEmail,
        subject: `${plazoAsunto}[DUPLICADO?] ${fromWhatsApp ? "[WhatsApp] " : ""}Lead con ${bloqueo.ref} ya abierto — ${docs.length} doc(s) ${getLanguageName(docs[0]?.sourceLanguage || "?")}`,
        html: renderSimpleEmailHtml(
          [
            hermanosTxt,
            ...(plazoTxt ? [plazoTxt] : []),
            `Contacto: ${contactEmail || "(sin email)"} · ${contactPhone || "(sin teléfono)"}`,
            ...(recurrenteTxt ? [`★ ${recurrenteTxt}`] : []),
            ...lineas,
            `Si de verdad es otro encargo, móntalo a mano (documentos ya dentro): ${builderUrl}`,
          ].join("\n")
        ),
      }).catch((err) => console.error("[puerta:request-quote] aviso duplicado fallo:", err));
      await sendStaffAlertSMS(
        `${recurrenteSms}[DUPLICADO?] ${(lead?.sourceLang || "?").toUpperCase()}>${(lead?.targetLang || "es").toUpperCase()} · ya abierto ${bloqueo.ref} (${describeSibling(bloqueo).split("(")[1]?.replace(")", "") || ""}) · ${bloqueo.url}`,
        "puerta_duplicado"
      ).catch(() => {});
      await sendPriceRequestAckToClient({ name: docs[0]?.clientName, email: contactEmail, phone: contactPhone, locale, translatorLangName: null, askDeadline: !plazo });
      return out({ ok: true, lavori: { sent: false } });
    }

    // AGENTE DE PRECIOS (27-ago-2026): documento ya conocido con tarifa APROBADA →
    // borrador listo para que Juan lo revise y envíe (21-sep-2026), sin molestar
    // al jurado; al pagar, el encargo le llega con su cifra cerrada. Si falta
    // tarifa, sigue el carril de lavori.
    const auto = await autoQuoteFromPuertaSession({
      sessionToken: token,
      contactEmail,
      contactPhone,
      contactName: docs[0]?.clientName,
      locale,
      casoId: caso ? caso.casoId : null,
    }).catch((err) => ({ ok: false as const, reason: String(err?.message || err) }));
    if (auto.ok) {
      const n = docs.length;
      await sendMail({
        to: adminEmail,
        subject: `${plazoAsunto}🤖 ${auto.sent ? "Presupuesto del tarifario ENVIADO" : "Borrador del tarifario"} ${auto.quoteNumber} — ${auto.totalEur.toFixed(2)} € (${getLanguageName(docs[0]?.sourceLanguage || "?")})`,
        html: renderSimpleEmailHtml(
          [
            `El agente de precios ha preparado el BORRADOR ${auto.quoteNumber} (${auto.totalEur.toFixed(2)} € IVA incl., ${auto.lines} línea${auto.lines === 1 ? "" : "s"}) con el tarifario aprendido. ${auto.sent ? "Ha salido SOLO al cliente (LEARNED_RATES_AUTOSEND=on: guardas, margen y procedencia OK)." : `NO se ha enviado: revísalo y envíalo tú.${auto.autoSendReasons.length ? ` Motivo del auto-envío frenado: ${auto.autoSendReasons.join("; ")}.` : ""}`}`,
            ...(plazoTxt ? [plazoTxt] : []),
            `Contacto: ${contactEmail || "(sin email)"} · ${contactPhone || "(sin teléfono)"}`,
            ...(recurrenteTxt ? [`★ ${recurrenteTxt}`] : []),
            ...(hermanosTxt ? [hermanosTxt] : []),
            auto.miembroNombre
              ? `Al pagar, el encargo irá a ${auto.miembroNombre} con su precio ya cerrado (sin solicitud previa).`
              : "Sin jurado asociado a la tarifa: al pagar irá por el carril normal de lavori.",
            ...lineas,
            `Ficha: ${baseUrl}/zona-traductor/presupuestos/${auto.quoteId}`,
          ].join("\n")
        ),
      }).catch((err) => console.error("[puerta:request-quote] aviso auto fallo:", err));
      await sendStaffAlertSMS(
        `🤖 ${recurrenteSms}${auto.sent ? "Tarifario ENVIADO" : "Borrador tarifario"} ${auto.quoteNumber} ${auto.totalEur.toFixed(2)}€${auto.sent ? "" : " (enviar tú)"} · ${n} doc${lead?.words ? ` · ${lead.words} pal.` : ""} · ${contactEmail || contactPhone}`,
        "puerta_auto_quote"
      ).catch(() => {});
      return out({
        ok: true,
        lavori: { sent: false },
        quote: { sent: auto.sent, draft: !auto.sent, number: auto.quoteNumber },
      });
    }
    console.log("[puerta:request-quote] tarifario no aplica:", auto.reason);

    const resolved = lead?.sourceLang ? await resolveLeadRoute(lead.sourceLang, lead.targetLang).catch(() => null) : null;
    const carril = resolved && resolved.route.candidatos.length > 0 ? resolved : null;
    const quien = carril
      ? carril.route.candidatos.map((id) => carril.cartera.find((m) => m.id === id)?.nombre || id).join(", ")
      : "";
    const leadLang = lead?.sourceLang === "es" ? lead?.targetLang : lead?.sourceLang;
    // Aclaración de Juan (25-ago 20:00): el cliente no-FR debe ver «tu documento ya
    // está con un traductor jurado de X» — la solicitud sale SOLA en cuanto pide
    // presupuesto. LAVORI_LEAD_AUTO_LANGS restringe por lengua ("de,he") o apaga ("none");
    // sin definir = todas las lenguas con carril.
    const autoRaw = String(process.env.LAVORI_LEAD_AUTO_LANGS || "").toLowerCase().trim();
    const autoLangs = new Set(autoRaw ? autoRaw.split(",").map((x) => x.trim()).filter(Boolean) : leadLang ? [leadLang] : []);
    const resumen = `${(lead?.tipos || []).slice(0, 3).join(" + ") || `${docs.length} doc`}${lead?.words ? ` · ${lead.words} pal.` : ""}`;
    let lavoriEmail = "";
    let lavoriSms = "";
    let lavoriSent: { lang: string; langName: string } | null = null;
    let esDirecto = false;
    let solicitudNueva: string | null = null;
    // Cliente que vuelve a subir (Cosmos, 10-sep): ya tiene una solicitud viva del
    // mismo par → NO sale otra a lavori; el aviso apunta a la que existe.
    // BAJA 8 (Juan, 15-sep): sin carril por defecto pero CON jurado directo, el
    // par se calcula igual desde el lead — si hay hermana, tampoco sale el directo.
    const parDelLead =
      lead?.sourceLang && leadLang ? (lead.sourceLang === "es" ? `ES>${leadLang.toUpperCase()}` : `${leadLang.toUpperCase()}>ES`) : null;
    const hermana = carril || parDelLead
      ? await findLiveSiblingLeadRequest({ email: contactEmail, phone: contactPhone, par: carril ? carril.route.par : parDelLead! }).catch(() => null)
      : null;
    // Lengua de la casa (francés = Juan, T-IJ 3850): NO sale a lavori por
    // ningún carril. Orden de Juan 16-sep-2026 tras tres escapes por la cartera
    // viva (LEAD-0B0C46A29D, LEAD-C4699A93B1, LEAD-6E846030BB).
    const casa = leadLang ? casaJuradoFor(leadLang) : null;
    if (casa) {
      lavoriEmail = `NO se ha enviado a lavori (${getLanguageName(leadLang!).toLowerCase()}: lo jura la casa, ${casa.nombre}, T-IJ ${casa.maec}). Móntalo tú: ${builderUrl}`;
      lavoriSms = `${getLanguageName(leadLang!)}: tuyo, al builder`;
    } else if (hermana) {
      const h = hermana.request;
      await compararGuarda({ vieja: "bloquea", guarda: "findLiveSiblingLeadRequest", objeto: "solicitud", sombra: caso, objetoGuarda: { lprId: h.id }, refs: { hermana: h.ref, sesion: token }, dedupeKey: token });
      const detalle = [
        h.status,
        h.priceCents ? `${(h.priceCents / 100).toFixed(2)} € de ${h.miembroNombre || "el traductor"}` : "sin precio aún",
        hermana.quote ? `presupuesto ${hermana.quote.quoteNumber} ${hermana.quote.status}` : "sin presupuesto",
      ].join(" · ");
      lavoriEmail = `Ya está en lavori: ${h.ref} enviada a ${h.miembroNombre || `${h.candidatos.length} jurado(s)`} el ${horaMadrid(h.createdAt)} (${detalle}). NO se ha enviado otra. Solicitud: ${baseUrl}/zona-traductor/presupuesto?lead=${encodeURIComponent(h.ref)}`;
      lavoriSms = `Ya en curso ${h.ref} (${h.status}) — sin 2.ª solicitud`;
    } else {
      // Carril directo (orden Juan 25-ago/15-sep/21-sep): para ciertas lenguas hay
      // jurado(s) DIRECTO(s) — la solicitud va SOLO a ellos y, con la primera
      // cifra, se monta el borrador (regla de margen única) que revisa Juan; nunca sale solo al
      // cliente. No depende de LAVORI_LEAD_AUTO_LANGS. Si falla el envío, cae a
      // la lógica normal (auto-lang / one-tap) sin romper.
      const directos = lead && leadLang ? await directMembersFor(leadLang).catch(() => []) : [];
      if (directos.length > 0) {
        // BAJA 9: refresca el contacto de esta sesión con el actual (no solo
        // donde faltaba) ANTES de enviar — cuando el directo cotice y el
        // presupuesto se monte solo, tiene que llevar el contacto de hoy, no
        // el de una subida anterior. Nota: DocumentAnalysis no tiene columna
        // de locale, así que no hay nada que pasarle aquí a createAutoQuote.
        const refrescoContacto: Record<string, string> = {};
        if (contactEmail) refrescoContacto.clientEmail = contactEmail;
        if (contactPhone) refrescoContacto.clientPhone = contactPhone;
        if (docs[0]?.clientName) refrescoContacto.clientName = docs[0].clientName;
        if (Object.keys(refrescoContacto).length > 0) {
          await prisma.documentAnalysis
            .updateMany({ where: { sessionToken: token }, data: refrescoContacto })
            .catch((err) => console.error("[puerta:request-quote] refresco contacto directo fallo:", err));
        }
        const directoReq = await sendLeadPriceRequest({
          docs: lead!.docs,
          sourceLang: lead!.sourceLang!,
          targetLang: lead!.targetLang,
          words: lead!.words,
          expedienteRef: `puerta:${token}`,
          customerHint: [lead!.contact.name, contactEmail, contactPhone].filter(Boolean).join(" · ") || null,
          especificaciones: plazoJurado,
          candidatos: directos.map((d) => d.miembroId),
          createdBy: "puerta-directo",
          contacto,
          caso,
        }).catch(() => null);
        if (directoReq?.ok) {
          esDirecto = true;
          lavoriSent = { lang: leadLang!, langName: getLanguageName(leadLang!) };
          if (!directoReq.repetido) solicitudNueva = directoReq.ref;
          const nombres = directos.map((d) => d.nombre).join(", ");
          lavoriEmail = `${await lineaEnLavori(directoReq.ref, nombres, directoReq.repetido)} Directa: con la primera cifra y plazo se monta el BORRADOR (regla de margen: ≥10 €, tope +60 %, suelo 40 €/doc) y te aviso; no sale solo al cliente. Si en 6 h laborables nadie cotiza, te aviso para que decidas (no se reabre sola).`;
          lavoriSms = directoReq.repetido ? `Ya en lavori ${directoReq.ref} — sin 2.ª solicitud` : `✓ Directa a ${nombres} (lavori)`;
        }
      }
      if (!esDirecto) {
        if (carril && lead && leadLang && autoLangs.has(leadLang)) {
          const auto = await sendLeadPriceRequest({
            docs: lead.docs,
            sourceLang: lead.sourceLang!,
            targetLang: lead.targetLang,
            words: lead.words,
            expedienteRef: `puerta:${token}`,
            customerHint: [lead.contact.name, contactEmail, contactPhone].filter(Boolean).join(" · ") || null,
            especificaciones: plazoJurado,
            createdBy: "puerta-auto",
            contacto,
            caso,
          }).catch(() => null);
          if (auto?.ok) {
            lavoriSent = { lang: leadLang, langName: getLanguageName(leadLang) };
            if (!auto.repetido) solicitudNueva = auto.ref;
            lavoriEmail = `${await lineaEnLavori(auto.ref, auto.nombres.join(", "), auto.repetido)}${auto.respaldo ? ` ⚠ ${auto.respaldo}.` : ""} Montar presupuesto cuando llegue el precio: ${baseUrl}/zona-traductor/presupuesto?lead=${encodeURIComponent(auto.ref)}`;
            lavoriSms = auto.repetido ? `Ya en lavori ${auto.ref} — sin 2.ª solicitud` : `✓ Enviada a ${auto.nombres.join(", ")} (lavori)`;
          } else {
            lavoriEmail = `NO se ha enviado a lavori (falló el envío automático${auto && !auto.ok ? `: ${auto.error}` : ""}). Pedir precio en lavori (${quien}) → ${lavoriOneTapUrl(token)}`;
            lavoriSms = `Pedir precio en lavori (${quien}): ${lavoriOneTapUrl(token)}`;
          }
        } else if (carril) {
          lavoriEmail = `NO se ha enviado a lavori (envío automático apagado para esta lengua). Pedir precio a ${quien} con un toque: ${lavoriOneTapUrl(token)}`;
          lavoriSms = `Pedir precio en lavori (${quien}): ${lavoriOneTapUrl(token)}`;
        } else {
          lavoriEmail = `NO se ha enviado a lavori (sin carril para este par${leadLang ? `, ${leadLang.toUpperCase()}` : ""}): presupuestar a mano.${resolved ? " Ningún jurado del tablón puede recibirlo ahora (sin papel único firmado, sin canal o no libre): no se ha enviado nada a ciegas." : ""}`;
          lavoriSms = `Sin carril lavori. Montar presupuesto (docs dentro): ${builderUrl}`;
        }
      }
    }

    // Aviso a staff — idempotente por caso (lib/caso/aviso-humano): el rastro se
    // reclama ANTES de enviar; mismo cliente y mismos documentos = no se repite.
    const claves = clavesDocs(lead?.rows?.length ? lead.rows.map((r) => ({ id: r.id, hash: r.fileHash })) : docs.map((d) => ({ id: d.id })));
    const aviso = await reclamarAvisoHumano(caso?.casoId ?? null, claves, solicitudNueva, token, { email: contactEmail, phone: contactPhone });
    const casoUrl = aviso.casoRef ? `${baseUrl}/zona-traductor/casos/${caso!.casoId}` : null;
    const etiqueta = aviso.casoRef ? `[${aviso.casoRef}] ` : "";
    const quienCliente = docs[0]?.clientName || contactEmail || contactPhone || "El cliente";
    if (aviso.tipo === "completo") {
      const enviado = await sendMail({
        to: adminEmail,
        subject: `${plazoAsunto}${etiqueta}${fromWhatsApp ? "[WhatsApp] " : ""}${recurrente.kind === "recurrent" ? "[RECURRENTE] " : ""}Lead pide presupuesto humano — ${docs.length} doc(s) ${getLanguageName(docs[0]?.sourceLanguage || "?")}`,
        html: renderSimpleEmailHtml(
          [
            "Un lead de la puerta ha pedido presupuesto humano (idioma sin precio instantáneo o importe alto).",
            ...(plazoTxt ? [plazoTxt] : []),
            lavoriEmail,
            casoUrl ? `Ficha del caso: ${casoUrl}` : `Montar presupuesto (documentos ya dentro): ${builderUrl}`,
            `Contacto: ${contactEmail || "(sin email)"} · ${contactPhone || "(sin teléfono)"}`,
            ...(recurrenteTxt ? [`★ ${recurrenteTxt}`] : []),
            ...(hermanosTxt ? [hermanosTxt] : []),
            ...(fromWhatsApp
              ? [`Origen: WhatsApp — contéstale por ahí${waDigits ? `: https://wa.me/${waDigits}` : " (no dejó teléfono)"}`]
              : []),
            ...lineas,
            ...(casoUrl ? [`Montar presupuesto (documentos ya dentro): ${builderUrl}`] : []),
          ].join("\n")
        ),
      })
        .then(() => true)
        .catch((err) => {
          console.error("[puerta:request-quote] aviso staff fallo:", err);
          return false;
        });
      // Sin email no hubo aviso: se suelta el rastro para que la siguiente petición vuelva a avisar completo.
      if (!enviado && aviso.eventoId) {
        await prisma.casoEvento.delete({ where: { id: aviso.eventoId } }).catch((err) => console.error("[puerta:request-quote] no se pudo soltar el rastro del aviso:", err));
      }
      await sendStaffAlertSMS(
        `${plazoAsunto ? "URGENTE · " : ""}${etiqueta}${fromWhatsApp ? "[WA] " : ""}${recurrenteSms}${hermanos.length ? "¿dup? " : ""}Lead ${(lead?.sourceLang || docs[0]?.sourceLanguage || "?").toUpperCase()}>${(lead?.targetLang || docs[0]?.targetLanguage || "es").toUpperCase()} · ${resumen} · ${lavoriSms}`,
        "puerta_request_quote"
      ).catch(() => {});
    } else if (aviso.tipo === "corto") {
      // Repetición sin nada nuevo: un email corto como mucho cada 12 h, sin SMS.
      await sendMail({
        to: adminEmail,
        subject: `${etiqueta}${quienCliente} ha vuelto a pedir · añadido al caso, no se ha enviado otra solicitud`,
        html: renderSimpleEmailHtml(
          [
            `${quienCliente} ha vuelto a pedir presupuesto con los mismos documentos. Queda en el caso; no se ha enviado nada nuevo a lavori.`,
            lavoriEmail,
            casoUrl ? `Ficha del caso: ${casoUrl}` : `Montar presupuesto: ${builderUrl}`,
          ].join("\n")
        ),
      }).catch((err) => console.error("[puerta:request-quote] aviso repetido fallo:", err));
    }

    // Acuse al cliente: un solo canal (email real o SMS); ya deduplica 24 h por destinatario.
    await sendPriceRequestAckToClient({
      name: docs[0]?.clientName,
      email: contactEmail,
      phone: contactPhone,
      locale,
      translatorLangName: lavoriSent?.langName ?? null,
      askDeadline: !plazo,
    });

    return out({ ok: true, lavori: lavoriSent ? { sent: true, ...lavoriSent, ...(esDirecto ? { directo: true } : {}) } : { sent: false } });
  } catch (err: any) {
    console.error("[puerta:request-quote] error", err?.message || err);
    return out({ ok: false, error: "No se pudo enviar la solicitud." }, { status: 500 });
  }
}
