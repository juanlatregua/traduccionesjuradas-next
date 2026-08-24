import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendReviewRequestEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  // Mismo fallback que el email de entrega (lib/email.ts): la env con el enlace
  // corto de un clic manda si existe; si no, la ficha de Google (fiable). Antes
  // este endpoint devolvía 500 con la env vacía — el botón llevaba roto en prod
  // y agosto cerró con CERO peticiones de reseña (auditoría 24-ago).
  const envReview = (process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL_TJ || "").trim();
  const reviewUrl = envReview.startsWith("http")
    ? envReview
    : "https://www.google.com/maps?cid=1858671208989418611";

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        clientEmail: true,
        deliveryState: true,
        paymentStatus: true,
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    // Allow review requests only for delivered orders (TRADUCIDO = delivered)
    if (order.deliveryState !== "TRADUCIDO") {
      return NextResponse.json(
        { ok: false, error: "Solo se puede solicitar resena en pedidos entregados o cerrados." },
        { status: 400 }
      );
    }

    // Send review request email
    await sendReviewRequestEmail({
      toEmail: order.clientEmail,
      reference: order.reference,
      reviewUrl,
    });

    // Audit event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "notification.review_request.sent",
        message: "Solicitud de resena enviada al cliente.",
        payload: {
          actorEmail,
          channel: "EMAIL",
          toEmail: order.clientEmail,
          reviewUrl,
        },
      },
    });

    // SMS/WhatsApp (fire & forget)
    const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
    const { smsReviewRequest } = await import("@/lib/sms-templates");
    const phone = await getOrderPhone(order.id).catch(() => null);
    if (phone) {
      sendNotification({
        to: formatPhoneSpain(phone),
        body: smsReviewRequest({ url: reviewUrl }),
      }).catch((err) => console.error("[SMS review-request]", err));
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[review-request]", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al enviar solicitud de resena." },
      { status: 500 }
    );
  }
}
