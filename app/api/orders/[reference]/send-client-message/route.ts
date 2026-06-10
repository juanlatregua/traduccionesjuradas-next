// app/api/orders/[reference]/send-client-message/route.ts
// STAFF: enviar un mensaje LIBRE al cliente de un pedido (p.ej. pedirle info
// sobre el documento). Email siempre; SMS opcional. Registra OrderEvent.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendClientMessageEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  message?: string;
  alsoSms?: boolean;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const body = (await req.json()) as Body;
    const message = String(body?.message || "").trim();
    if (!message) {
      return NextResponse.json({ ok: false, error: "El mensaje está vacío." }, { status: 400 });
    }
    if (message.length > 2000) {
      return NextResponse.json({ ok: false, error: "El mensaje es demasiado largo (máx. 2000)." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true, reference: true, clientEmail: true, clientLocale: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }
    if (!order.clientEmail) {
      return NextResponse.json({ ok: false, error: "El pedido no tiene email de cliente." }, { status: 400 });
    }

    const lang = order.clientLocale === "fr" ? "fr" : "es";
    const { buildSignedOrderUrl } = await import("@/lib/order-token");
    const statusUrl = buildSignedOrderUrl(order.reference, "estado");

    await sendClientMessageEmail({
      toEmail: order.clientEmail,
      reference: order.reference,
      message,
      statusUrl,
      lang,
    });

    let smsSent = false;
    if (body.alsoSms) {
      try {
        const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
        const phone = await getOrderPhone(order.id);
        if (phone) {
          const short = message.length > 120 ? `${message.slice(0, 117)}...` : message;
          await sendNotification({
            to: formatPhoneSpain(phone),
            body: `${order.reference}: ${short} ${statusUrl}`,
          });
          smsSent = true;
        }
      } catch (err) {
        console.error("[send-client-message] SMS failed", err);
      }
    }

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "staff.client_message.sent",
        message: `Mensaje al cliente: ${message.slice(0, 140)}${message.length > 140 ? "…" : ""}`,
        payload: { actorEmail, channel: smsSent ? "email+sms" : "email", lang },
      },
    });

    return NextResponse.json({ ok: true, smsSent });
  } catch (err: any) {
    console.error("[send-client-message] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo enviar el mensaje al cliente." },
      { status: 500 }
    );
  }
}
