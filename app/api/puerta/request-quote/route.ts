// app/api/puerta/request-quote/route.ts
// "Solicitar presupuesto" desde la puerta (24-ago-2026): los idiomas fuera del
// francés ya no enseñan precio de máquina ("previa cotización en lavori") y los
// franceses grandes prefieren confirmación humana. Este endpoint convierte ese
// clic en (1) aviso a staff por email + SMS (dos transportes) con el enlace al
// builder, y (2) acuse al cliente por email o SMS (sendPriceRequestAckToClient).
// El lead ya está en BD (DocumentAnalysis de su sesión); aquí solo se enruta.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
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

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `puerta-request-quote:${ip}`,
    limit: 10,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas peticiones." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => null);
    const token = typeof body?.sessionToken === "string" ? body.sessionToken.trim() : "";
    if (!token) {
      return NextResponse.json({ ok: false, error: "Sesión no válida." }, { status: 400 });
    }
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase().slice(0, 254) : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) : "";
    const locale = typeof body?.lang === "string" ? body.lang.trim().slice(0, 5) : null;

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
      },
    });
    if (docs.length === 0) {
      return NextResponse.json({ ok: false, error: "Sesión no encontrada." }, { status: 404 });
    }

    const contactEmail = email || docs.find((d) => d.clientEmail)?.clientEmail || "";
    const contactPhone = phone || docs.find((d) => d.clientPhone)?.clientPhone || "";
    const fromWhatsApp = docs.some((d) => d.source === "whatsapp");
    const phoneDigits = contactPhone.replace(/\D/g, "");
    const waDigits = phoneDigits.length === 9 ? `34${phoneDigits}` : phoneDigits;
    if (!contactEmail && !contactPhone) {
      return NextResponse.json(
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

    const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
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
    }).catch((err) => ({ ok: false as const, reason: String(err?.message || err) }));
    if (auto.ok) {
      const n = docs.length;
      await sendMail({
        to: adminEmail,
        subject: `🤖 Borrador del tarifario ${auto.quoteNumber} — ${auto.totalEur.toFixed(2)} € (${getLanguageName(docs[0]?.sourceLanguage || "?")})`,
        html: renderSimpleEmailHtml(
          [
            `El agente de precios ha preparado el BORRADOR ${auto.quoteNumber} (${auto.totalEur.toFixed(2)} € IVA incl., ${auto.lines} línea${auto.lines === 1 ? "" : "s"}) con el tarifario aprendido. NO se ha enviado: revísalo y envíalo tú.`,
            `Contacto: ${contactEmail || "(sin email)"} · ${contactPhone || "(sin teléfono)"}`,
            auto.miembroNombre
              ? `Al pagar, el encargo irá a ${auto.miembroNombre} con su precio ya cerrado (sin solicitud previa).`
              : "Sin jurado asociado a la tarifa: al pagar irá por el carril normal de lavori.",
            ...lineas,
            `Ficha: ${baseUrl}/zona-traductor/presupuestos/${auto.quoteId}`,
          ].join("\n")
        ),
      }).catch((err) => console.error("[puerta:request-quote] aviso auto fallo:", err));
      await sendStaffAlertSMS(
        `🤖 Borrador tarifario ${auto.quoteNumber} ${auto.totalEur.toFixed(2)}€ (enviar tú) · ${n} doc${lead?.words ? ` · ${lead.words} pal.` : ""} · ${contactEmail || contactPhone}`,
        "puerta_auto_quote"
      ).catch(() => {});
      return NextResponse.json({
        ok: true,
        lavori: { sent: false },
        quote: { sent: false, draft: true, number: auto.quoteNumber },
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
      lavoriEmail = `${getLanguageName(leadLang!).toUpperCase()}: lo jura la casa (${casa.nombre}, T-IJ ${casa.maec}) — NO se ha mandado a lavori. Móntalo tú: ${builderUrl}`;
      lavoriSms = `${getLanguageName(leadLang!)}: tuyo, al builder`;
    } else if (hermana) {
      const h = hermana.request;
      const detalle = [
        h.status,
        h.priceCents ? `${(h.priceCents / 100).toFixed(2)} € de ${h.miembroNombre || "el traductor"}` : "sin precio aún",
        hermana.quote ? `presupuesto ${hermana.quote.quoteNumber} ${hermana.quote.status}` : "sin presupuesto",
      ].join(" · ");
      lavoriEmail = `⚠ NO se ha enviado otra solicitud a lavori: este cliente ya tiene la ${h.ref} en curso (${detalle}). Sigue por ahí: ${baseUrl}/zona-traductor/presupuesto?lead=${encodeURIComponent(h.ref)}`;
      lavoriSms = `Ya en curso ${h.ref} (${h.status}) — sin 2.ª solicitud`;
    } else {
      // Carril directo (orden Juan 25-ago/15-sep/21-sep): para ciertas lenguas hay
      // jurado(s) DIRECTO(s) — la solicitud va SOLO a ellos y, con la primera
      // cifra, se monta el borrador (+20 %) que revisa Juan; nunca sale solo al
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
          candidatos: directos.map((d) => d.miembroId),
          createdBy: "puerta-directo",
        }).catch(() => null);
        if (directoReq?.ok) {
          esDirecto = true;
          lavoriSent = { lang: leadLang!, langName: getLanguageName(leadLang!) };
          const nombres = directos.map((d) => d.nombre).join(", ");
          lavoriEmail = `✓ Solicitud DIRECTA a ${nombres} (ref ${directoReq.ref}). Con la primera cifra y plazo se monta el BORRADOR (+20 %, suelo 40 €/doc) y te aviso; no sale solo al cliente. Si en 6 h laborables nadie cotiza, te aviso para que decidas (no se reabre sola).`;
          lavoriSms = `✓ Directa a ${nombres} (lavori)`;
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
            createdBy: "puerta-auto",
          }).catch(() => null);
          if (auto?.ok) {
            lavoriSent = { lang: leadLang, langName: getLanguageName(leadLang) };
            lavoriEmail = `✓ Solicitud de precio ENVIADA automáticamente a ${auto.nombres.join(", ")} en lavori (ref ${auto.ref}).${auto.respaldo ? ` ⚠ ${auto.respaldo}.` : ""} Montar presupuesto cuando llegue el precio: ${baseUrl}/zona-traductor/presupuesto?lead=${encodeURIComponent(auto.ref)}`;
            lavoriSms = `✓ Enviada a ${auto.nombres.join(", ")} (lavori)`;
          } else {
            lavoriEmail = `⚠ El envío automático a lavori falló${auto && !auto.ok ? `: ${auto.error}` : ""}. Pedir precio en lavori (${quien}) → ${lavoriOneTapUrl(token)}`;
            lavoriSms = `Pedir precio en lavori (${quien}): ${lavoriOneTapUrl(token)}`;
          }
        } else if (carril) {
          lavoriEmail = `Pedir precio en lavori (${quien}) con un toque: ${lavoriOneTapUrl(token)}`;
          lavoriSms = `Pedir precio en lavori (${quien}): ${lavoriOneTapUrl(token)}`;
        } else {
          lavoriEmail = `Sin carril en lavori para este par${leadLang ? ` (${leadLang.toUpperCase()})` : ""}: presupuestar a mano.`;
          lavoriSms = `Sin carril lavori. Montar presupuesto (docs dentro): ${builderUrl}`;
        }
      }
    }

    // Aviso a staff — dos transportes independientes; con await (lambda).
    await sendMail({
      to: adminEmail,
      subject: `${fromWhatsApp ? "[WhatsApp] " : ""}Lead pide presupuesto humano — ${docs.length} doc(s) ${getLanguageName(docs[0]?.sourceLanguage || "?")}`,
      html: renderSimpleEmailHtml(
        [
          "Un lead de la puerta ha pedido presupuesto humano (idioma sin precio instantáneo o importe alto).",
          `Contacto: ${contactEmail || "(sin email)"} · ${contactPhone || "(sin teléfono)"}`,
          ...(fromWhatsApp
            ? [`Origen: WhatsApp — contéstale por ahí${waDigits ? `: https://wa.me/${waDigits}` : " (no dejó teléfono)"}`]
            : []),
          ...lineas,
          lavoriEmail,
          `Montar presupuesto (documentos ya dentro): ${builderUrl}`,
        ].join("\n")
      ),
    }).catch((err) => console.error("[puerta:request-quote] aviso staff fallo:", err));
    await sendStaffAlertSMS(
      `${fromWhatsApp ? "[WA] " : ""}Lead ${(lead?.sourceLang || docs[0]?.sourceLanguage || "?").toUpperCase()}>${(lead?.targetLang || docs[0]?.targetLanguage || "es").toUpperCase()} · ${resumen} · ${lavoriSms}`,
      "puerta_request_quote"
    ).catch(() => {});

    // Acuse al cliente: un solo canal (email real o SMS).
    await sendPriceRequestAckToClient({
      name: docs[0]?.clientName,
      email: contactEmail,
      phone: contactPhone,
      locale,
      translatorLangName: lavoriSent?.langName ?? null,
    });

    return NextResponse.json({ ok: true, lavori: lavoriSent ? { sent: true, ...lavoriSent, ...(esDirecto ? { directo: true } : {}) } : { sent: false } });
  } catch (err: any) {
    console.error("[puerta:request-quote] error", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo enviar la solicitud." }, { status: 500 });
  }
}
