import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendLeadReminderEmail } from "@/lib/email";
import { getLanguageName, isPublicAutoPriceable } from "@/lib/pricing-engine/languages";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendMail, isPlaceholderEmail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendSMS, sendStaffAlertSMS, formatPhoneSpain } from "@/lib/sms";


export const runtime = "nodejs";

function hasCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const after = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h ago

  // Solo leads de la PUERTA. Se excluyen a propósito:
  //  · exp:*   → expedientes que el staff está presupuestando a mano; decirles
  //              "no llegaste a completar el pedido" sería falso y queda fatal.
  //  · staff:* → documentos del propio traductor en el builder.
  // Antes esto no hacía falta porque el email solo se estampaba en el checkout y
  // el cron casi nunca encontraba a nadie; ahora la puerta lo captura al entrar.
  const candidates = await prisma.documentAnalysis.findMany({
    where: {
      status: { in: ["QUOTE_GENERATED", "PAYMENT_PENDING"] },
      clientEmail: { not: null },
      // Sin consentimiento expreso y previo NO se escribe: la casilla de la
      // subida solo cubre tratar los documentos (LSSI art. 21.1; su excepción
      // del 21.2 pide relación contractual previa, y un lead no es cliente).
      marketingConsent: true,
      orderId: null,
      reminderSentAt: null,
      createdAt: { gte: since, lte: after },
      NOT: [
        { sessionToken: { startsWith: "exp:" } },
        { sessionToken: { startsWith: "staff:" } },
      ],
    },
    take: 100,
  });

  // UN aviso por PERSONA, no por documento. La puerta es multi-documento: una
  // sesión con 3 documentos deja 3 filas con el mismo email, y enviar por fila
  // significaba 3 correos idénticos el mismo día (queja de spam garantizada, y
  // el dominio de envío es del que depende el negocio).
  const byEmail = new Map<string, typeof candidates>();
  for (const lead of candidates) {
    if (!lead.clientEmail) continue;
    const key = lead.clientEmail.toLowerCase();
    const group = byEmail.get(key);
    if (group) group.push(lead);
    else byEmail.set(key, [lead]);
  }

  let sent = 0;
  let failed = 0;

  for (const [email, group] of byEmail) {
    try {
      await sendLeadReminderEmail({
        toEmail: group[0].clientEmail!,
        // El nombre casi nunca está (la puerta no lo pide); si alguna fila del
        // grupo lo trae, se usa.
        clientName: group.find((l) => l.clientName)?.clientName ?? null,
        // Personalización (24-ago): sus documentos, y el precio solo si el
        // idioma tiene precio público (fr) — el resto lo confirma el traductor.
        docs: group.map((l) => {
          const src = (l.sourceLanguage || "").toLowerCase();
          const tgt = (l.targetLanguage || "").toLowerCase();
          const foreign = src && src !== "es" ? src : tgt;
          const par =
            src && tgt ? ` (${getLanguageName(src)} → ${getLanguageName(tgt)})` : "";
          const words = l.estimatedWords ? `, ${l.estimatedWords} palabras` : "";
          return {
            label: `${l.documentType || l.fileName}${par}${words}`,
            priceEur:
              l.quoteAmount != null && foreign && isPublicAutoPriceable(foreign)
                ? Number(l.quoteAmount)
                : null,
          };
        }),
      });
      // Marcar TODAS las filas del grupo: si solo se marcase la enviada, las
      // hermanas seguirían siendo candidatas y reenviarían mañana (la ventana
      // es de 7 días).
      await prisma.documentAnalysis.updateMany({
        where: { id: { in: group.map((l) => l.id) } },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } catch (err: any) {
      console.error(`[lead-reminders] Failed for ${email}:`, err?.message || err);
      failed++;
    }
  }

  // Solicitudes de precio nacidas de la PUERTA (carril automático 25-ago) que a las
  // 24 h siguen SIN cifra del jurado: segundo mensaje honesto al cliente + aviso
  // rojo a Juan (SMS + email con enlace al builder). Una sola vez por lead.
  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const paradas = await prisma.lavoriPriceRequest.findMany({
    where: {
      status: "SENT",
      createdBy: { in: ["puerta-auto", "one-tap"] },
      createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000), gt: new Date(now.getTime() - 72 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  let paradasAvisadas = 0;
  for (const lpr of paradas) {
    const gate = await checkRateLimit({ key: `lead-24h:${lpr.ref}`, limit: 1, windowMs: 7 * 24 * 60 * 60 * 1000 });
    if (!gate.ok) continue;
    const parts = (lpr.customerHint || "").split(" · ").map((x) => x.trim()).filter(Boolean);
    const email = parts.find((x) => x.includes("@") && !isPlaceholderEmail(x)) || null;
    const phone = parts.find((x) => /\+?\d[\d\s]{6,}/.test(x)) || null;
    const name = parts.find((x) => x !== email && x !== phone) || "";
    const horas = Math.round((now.getTime() - lpr.createdAt.getTime()) / 3600000);
    const builder = `${baseUrl}/zona-traductor/presupuesto?lead=${encodeURIComponent(lpr.ref)}`;
    if (email) {
      await sendMail({
        to: email,
        subject: "Seguimos con tu presupuesto de traducción jurada",
        text: `Hola${name ? ` ${name}` : ""},\nseguimos con tu presupuesto: el traductor jurado que tiene tus documentos aún no nos ha pasado su cifra. Te lo enviamos mañana como muy tarde; si tienes prisa, responde a este email o escríbenos por WhatsApp al 951 333 614.\nJuan Silva Moreno · traductor jurado nº 3850 · traduccionesjuradas.net`,
        html: renderSimpleEmailHtml(`Hola${name ? ` ${name}` : ""},\nseguimos con tu presupuesto: el traductor jurado que tiene tus documentos aún no nos ha pasado su cifra. Te lo enviamos mañana como muy tarde; si tienes prisa, responde a este email o escríbenos por WhatsApp al 951 333 614.\nJuan Silva Moreno · traductor jurado nº 3850 · traduccionesjuradas.net`),
      }).catch((err) => console.error("[lead-24h] email cliente fallo:", err));
    } else if (phone) {
      await sendSMS({
        to: formatPhoneSpain(phone),
        body: "Seguimos con su presupuesto de traduccion jurada: se lo enviamos manana como muy tarde. Si tiene prisa, WhatsApp 951 333 614. Juan Silva Moreno, traductor jurado 3850.",
        channel: "sms",
      }).catch((err) => console.error("[lead-24h] sms cliente fallo:", err));
    }
    await sendMail({
      to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
      subject: `🔴 Lead ${lpr.par} sin precio ${horas} h (${lpr.ref})`,
      text: [
        `La solicitud de precio ${lpr.ref} (${lpr.par}, ${lpr.docsCount} doc${lpr.words ? `, ${lpr.words} palabras` : ""}) lleva ${horas} h sin cifra del jurado.`,
        `Cliente: ${lpr.customerHint || "(sin datos)"} — ya le hemos dicho que lo recibe mañana como muy tarde.`,
        `Opciones: tarificarlo tú ahora en el builder (${builder}) o insistir al jurado en lavori.`,
      ].join("\n"),
      html: renderSimpleEmailHtml(`La solicitud de precio ${lpr.ref} (${lpr.par}, ${lpr.docsCount} doc${lpr.words ? `, ${lpr.words} palabras` : ""}) lleva ${horas} h sin cifra del jurado.\nCliente: ${lpr.customerHint || "(sin datos)"} — ya le hemos dicho que lo recibe mañana como muy tarde.\nOpciones: tarificarlo tú ahora en el builder (${builder}) o insistir al jurado en lavori.`),
    }).catch((err) => console.error("[lead-24h] email staff fallo:", err));
    await sendStaffAlertSMS(`ROJO: lead ${lpr.par} ${horas}h sin precio del jurado (${lpr.ref}). Tarificar: ${builder}`, `lead_24h ${lpr.ref}`).catch(() => {});
    paradasAvisadas += 1;
  }

  return NextResponse.json({ ok: true, scanned: candidates.length, leads: byEmail.size, sent, failed, leads24h: paradas.length, leads24hAvisados: paradasAvisadas });
}

export const POST = GET;
