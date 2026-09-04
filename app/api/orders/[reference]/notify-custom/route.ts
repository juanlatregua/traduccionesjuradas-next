// app/api/orders/[reference]/notify-custom/route.ts
//
// Compositor ÚNICO de mensajes del staff al cliente (fusión con el antiguo
// /send-client-message): EMAIL con cuerpo editable (adjunta traducciones +
// factura si attachFiles) y SMS opcional (alsoSms). Registra OrderEvent
// notification.custom.sent → visible en el log de mensajes de la ficha.

import { NextResponse } from "next/server";
import { isOrderSecured } from "@/lib/credit-terms";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendCustomClientEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { fetchFileAsAttachment, buildIssuedInvoiceAttachment } from "@/lib/delivery-attachments";

export const runtime = "nodejs";

type Params = { params: { reference: string } };
type DeliveryFile = { url: string; filename?: string | null };

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        clientEmail: true,
        paymentStatus: true,
        clientInvoice: { select: { status: true, docKind: true, dueDate: true, paidAt: true } },
        monthlyInvoice: { select: { status: true, docKind: true, annulledAt: true } },
        deliveryFilesJson: true,
        translatedFileUrl: true,
        finalFilename: true,
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const subject = String(body?.subject || "").trim() || `Tu traducción jurada (${order.reference})`;
    const bodyText = String(body?.bodyText || "").trim();
    const attachFiles = body?.attachFiles !== false;
    const alsoSms = body?.alsoSms === true;
    if (!bodyText) {
      return NextResponse.json({ ok: false, error: "El mensaje está vacío." }, { status: 400 });
    }
    if (bodyText.length > 4000) {
      return NextResponse.json({ ok: false, error: "El mensaje es demasiado largo (máx. 4000)." }, { status: 400 });
    }

    // Los leads de WhatsApp tienen email sintético (@whatsapp.local): no llega.
    if (String(order.clientEmail || "").toLowerCase().endsWith("@whatsapp.local")) {
      return NextResponse.json(
        { ok: false, error: "Este cliente no tiene email real (lead de WhatsApp). Envíalo por WhatsApp." },
        { status: 400 }
      );
    }

    // No entregar sin cobrar: adjuntar la traducción a un impago no se permite.
    // El staff puede reenviar el mensaje sin adjuntos (attachFiles=false).
    if (attachFiles && !isOrderSecured(order)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "El pedido no está pagado ni autorizado a crédito: no se puede adjuntar la traducción. Desmarca los adjuntos, confirma el pago o autoriza el crédito primero.",
        },
        { status: 400 }
      );
    }

    let attachments: any[] = [];
    if (attachFiles) {
      const files: DeliveryFile[] = Array.isArray(order.deliveryFilesJson)
        ? (order.deliveryFilesJson as unknown as DeliveryFile[]).filter(
            (f) => f && typeof f.url === "string" && f.url.trim()
          )
        : order.translatedFileUrl
          ? [{ url: order.translatedFileUrl, filename: order.finalFilename || null }]
          : [];
      const multi = files.length > 1;
      const [fileAtts, invAtt] = await Promise.all([
        Promise.all(
          files.map((f, i) =>
            fetchFileAsAttachment(
              f.url,
              f.filename || `Traduccion-jurada-${order.reference}${multi ? `-${i + 1}` : ""}.pdf`
            )
          )
        ),
        buildIssuedInvoiceAttachment(order.reference),
      ]);
      attachments = [...fileAtts.filter(Boolean), ...(invAtt ? [invAtt] : [])];
    }

    // SMS opcional (absorbido de /send-client-message): versión corta + enlace
    // de estado. Best-effort — no bloquea el email si Twilio falla.
    let smsSent = false;
    if (alsoSms) {
      try {
        const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
        const { buildSignedOrderUrl } = await import("@/lib/order-token");
        const phone = await getOrderPhone(order.id);
        if (phone) {
          const statusUrl = buildSignedOrderUrl(order.reference, "estado");
          const short = bodyText.length > 120 ? `${bodyText.slice(0, 117)}...` : bodyText;
          await sendNotification({
            to: formatPhoneSpain(phone),
            body: `${order.reference}: ${short} ${statusUrl}`,
          });
          smsSent = true;
        }
      } catch (err) {
        console.error("[notify-custom] SMS failed", err);
      }
    }

    // Log SÍNCRONO antes del envío de fondo: el contenido exacto queda en la
    // landing aunque el envío no llegue a completar en serverless.
    await prisma.orderEvent
      .create({
        data: {
          orderId: order.id,
          type: "notification.custom.sent",
          message: "Mensaje personalizado enviado al cliente por email.",
          payload: {
            channel: smsSent ? "EMAIL+SMS" : "EMAIL",
            toEmail: order.clientEmail,
            subject,
            bodyText,
            actorEmail: staff.email,
            fileCount: attachments.length,
          },
        },
      })
      .catch((e) => console.error("[notify-custom] event failed", e));

    await sendEmailWithRetry(() =>
      sendCustomClientEmail({ toEmail: order.clientEmail, subject, bodyText, attachments })
    );

    return NextResponse.json({ ok: true, fileCount: attachments.length, smsSent });
  } catch (err: any) {
    console.error("[notify-custom] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al enviar el email." },
      { status: 500 }
    );
  }
}
