// app/api/customers/deliver/route.ts
// STAFF: entrega directa de traducciones a un cliente que llegó por presupuesto /
// WhatsApp (sin pedido formal). NO reinventa nada: compone los chokepoints del
// flujo canónico de entrega —
//   createOrder()  →  [si ya pagó] confirmManualPayment() + transitionWorkflowState()
//                  →  updateDeliveryState("TRADUCIDO", files)
//                  →  [si notificar] sendTranslationReadyEmail() con adjuntos
// El SMS "traducción lista" lo dispara transitionWorkflowState (fuente única), igual
// que /api/orders/[reference]/delivery. Si el cliente aún no ha pagado, se entrega
// sin marcar pago y sin aviso automático (el staff manda el enlace por WhatsApp).

import { NextResponse } from "next/server";
import { createOrder, confirmManualPayment, updateDeliveryState } from "@/lib/orders";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { sendTranslationReadyEmail, buildTranslationReadyEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { fetchFileAsAttachment, buildIssuedInvoiceAttachment } from "@/lib/delivery-attachments";
import { buildSignedOrderUrl } from "@/lib/order-token";
import { requireStaffAccess } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type FileRef = { url?: string; key?: string | null; name?: string | null };
type Body = {
  clientEmail?: string;
  clientName?: string | null;
  title?: string;
  langPair?: string | null;
  amountCents?: number | null;
  translations?: FileRef[];
  alreadyPaid?: boolean;
  notifyClient?: boolean;
};

function isDeliverableEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith("@whatsapp.local");
}

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const actorEmail = access.email;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* opcional */
  }

  const clientEmail = String(body.clientEmail || "").trim().toLowerCase();
  if (!clientEmail) return NextResponse.json({ ok: false, error: "Falta el email del cliente." }, { status: 400 });

  const translations = (body.translations || [])
    .filter((f) => f && f.url)
    .map((f) => ({ url: String(f.url), fileKey: f.key || null, filename: f.name || null, mimeType: "application/pdf" as const }));
  if (translations.length === 0) {
    return NextResponse.json({ ok: false, error: "Adjunta al menos una traducción." }, { status: 400 });
  }

  const title = String(body.title || "").trim() || `Traducción jurada · ${translations.length} documento(s)`;
  const langPair = body.langPair?.trim() || null;
  const amountCents = Number.isFinite(body.amountCents) && (body.amountCents as number) > 0 ? Math.round(body.amountCents as number) : 0;
  const alreadyPaid = body.alreadyPaid === true;

  if (alreadyPaid && amountCents <= 0) {
    return NextResponse.json({ ok: false, error: "Indica el importe cobrado para marcar el pedido como pagado." }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { email: { equals: clientEmail, mode: "insensitive" } },
    select: { name: true, companyName: true, phone: true },
  });
  const clientName = (body.clientName?.trim() || customer?.companyName || customer?.name || null) as string | null;

  try {
    // 1) Crear el pedido (chokepoint createOrder, con su reintento/idempotencia).
    const order = await createOrder({
      clientEmail,
      clientName: clientName || undefined,
      source: "file",
      title,
      langPair: langPair || undefined,
      amountCents,
    });
    const reference = order.reference;

    // Teléfono del cliente en el pedido (para que el SMS de hito pueda llegar).
    if (customer?.phone) {
      await prisma.order.update({ where: { reference }, data: { clientPhone: customer.phone } }).catch(() => {});
    }

    const primary = translations[0];

    if (alreadyPaid) {
      // 2) Marcar cobrado por el chokepoint central de pago (no a mano).
      await confirmManualPayment(reference, "TRANSFER", actorEmail);
      // 3) Transición canónica: dispara el SMS "traducción lista" (fuente única).
      await transitionWorkflowState({
        reference,
        to: "TRADUCIDO_ENTREGADO",
        actorEmail,
        reason: "Entrega directa desde la carpeta del cliente.",
        payload: { delivered: true },
      });
    }

    // 4) Sellar la entrega (ficheros + estado) con el mismo helper que /delivery.
    await updateDeliveryState(reference, "TRADUCIDO", {
      translatedFileUrl: primary.url,
      translatedFileKey: primary.fileKey || undefined,
      translatedFilename: primary.filename || undefined,
      deliveryFiles: translations,
      eventMessage: `Entrega directa creada por ${actorEmail}.${translations.length > 1 ? ` ${translations.length} archivos.` : ""}`,
    });

    // 5) Email "traducción lista" con adjuntos — solo si se pide notificar Y el email
    //    es entregable (los clientes de WhatsApp tienen email-marcador @whatsapp.local).
    if (body.notifyClient && isDeliverableEmail(clientEmail)) {
      const statusUrl = buildSignedOrderUrl(reference, "estado");
      const lang = order.clientLocale === "fr" ? "fr" : "es";
      const composed = buildTranslationReadyEmail({
        reference,
        downloadUrl: primary.url,
        statusUrl,
        lang,
        translationAttached: true,
        invoiceAttached: false,
      });
      await prisma.orderEvent
        .create({
          data: {
            orderId: order.id,
            type: "notification.delivery_ready.sent",
            message: "Cliente notificado de traducción lista con enlace de descarga.",
            payload: { actorEmail, channel: "EMAIL", toEmail: clientEmail, subject: composed.subject, bodyHtml: composed.html, downloadUrl: primary.url, fileCount: translations.length },
          },
        })
        .catch((err) => console.error("[customers-deliver] notif event failed", err));

      void (async () => {
        const multi = translations.length > 1;
        const [fileAttachments, invAttach] = await Promise.all([
          Promise.all(translations.map((f, i) => fetchFileAsAttachment(f.url, f.filename || `Traduccion-jurada-${reference}${multi ? `-${i + 1}` : ""}.pdf`))),
          buildIssuedInvoiceAttachment(reference),
        ]);
        const transAttachments = fileAttachments.filter(Boolean) as NonNullable<(typeof fileAttachments)[number]>[];
        const attachments = [...transAttachments, ...(invAttach ? [invAttach] : [])];
        await sendEmailWithRetry(() =>
          sendTranslationReadyEmail({ toEmail: clientEmail, reference, downloadUrl: primary.url, lang, statusUrl, attachments, translationAttached: transAttachments.length > 0, invoiceAttached: !!invAttach })
        );
      })().catch((e) => console.error("[customers-deliver] ready email failed", e));
    }

    return NextResponse.json({ ok: true, reference });
  } catch (err: any) {
    console.error("[customers-deliver] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear la entrega." }, { status: 400 });
  }
}
