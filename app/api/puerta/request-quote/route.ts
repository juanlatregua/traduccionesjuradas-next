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
      },
    });
    if (docs.length === 0) {
      return NextResponse.json({ ok: false, error: "Sesión no encontrada." }, { status: 404 });
    }

    const contactEmail = email || docs.find((d) => d.clientEmail)?.clientEmail || "";
    const contactPhone = phone || docs.find((d) => d.clientPhone)?.clientPhone || "";
    if (!contactEmail && !contactPhone) {
      return NextResponse.json(
        { ok: false, error: "Necesitamos un email o un teléfono para responderte." },
        { status: 400 }
      );
    }

    // Persistir el contacto que llegue nuevo (sin pisar el existente).
    if (email || phone) {
      await prisma.documentAnalysis.updateMany({
        where: { sessionToken: token },
        data: {
          ...(email ? { clientEmail: email } : {}),
          ...(phone ? { clientPhone: phone } : {}),
        },
      });
    }

    const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
    const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
    const lineas = docs.map((d) => {
      const par = `${getLanguageName(d.sourceLanguage || "?")} → ${getLanguageName(d.targetLanguage || "?")}`;
      const ref = d.quoteAmount ? ` · motor (referencia interna): ${Number(d.quoteAmount).toFixed(2)} € netos` : "";
      return `· ${d.fileName} — ${d.documentType || "documento"} · ${par} · ${d.estimatedWords ?? "?"} palabras / ${d.pageCount ?? "?"} págs${ref}`;
    });
    const builderUrl =
      `${baseUrl}/zona-traductor/presupuesto?customerEmail=${encodeURIComponent(contactEmail)}` +
      (docs[0]?.clientName ? `&customerName=${encodeURIComponent(docs[0].clientName)}` : "") +
      (contactPhone ? `&customerPhone=${encodeURIComponent(contactPhone)}` : "");

    // Aviso a staff — dos transportes independientes; con await (lambda).
    await sendMail({
      to: adminEmail,
      subject: `Lead pide presupuesto humano — ${docs.length} doc(s) ${getLanguageName(docs[0]?.sourceLanguage || "?")}`,
      html: renderSimpleEmailHtml(
        [
          "Un lead de la puerta ha pedido presupuesto humano (idioma sin precio instantáneo o importe alto).",
          `Contacto: ${contactEmail || "(sin email)"} · ${contactPhone || "(sin teléfono)"}`,
          ...lineas,
          `Montar presupuesto: ${builderUrl}`,
        ].join("\n")
      ),
    }).catch((err) => console.error("[puerta:request-quote] aviso staff fallo:", err));
    await sendStaffAlertSMS(
      `TraduccionesJuradas: lead pide presupuesto humano (${docs.length} doc, ${docs[0]?.sourceLanguage || "?"}>${docs[0]?.targetLanguage || "?"}). Mira el email.`,
      "puerta_request_quote"
    ).catch(() => {});

    // Acuse al cliente: un solo canal (email real o SMS).
    await sendPriceRequestAckToClient({
      name: docs[0]?.clientName,
      email: contactEmail,
      phone: contactPhone,
      locale,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[puerta:request-quote] error", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo enviar la solicitud." }, { status: 500 });
  }
}
