import { NextResponse } from "next/server";
import { sendTranslationReadyEmail } from "@/lib/email";
import { requireStaffAccess } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";

type NotifyBody = {
  reference?: string;
  clientEmail?: string;
  downloadUrl?: string;
  templateKey?: string;
};

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const body = (await req.json()) as NotifyBody;
    const reference = (body.reference || "").trim();
    if (!reference) {
      return NextResponse.json(
        { ok: false, error: "Falta referencia del pedido." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { reference },
      select: {
        id: true,
        reference: true,
        clientEmail: true,
        finalDeliveryFileUrl: true,
        translatedFileUrl: true,
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const clientEmail = (body.clientEmail || order.clientEmail || "").trim();
    const downloadUrl =
      (body.downloadUrl || "").trim() ||
      String(order.finalDeliveryFileUrl || "").trim() ||
      String(order.translatedFileUrl || "").trim();

    if (!reference || !clientEmail || !downloadUrl) {
      return NextResponse.json(
        { ok: false, error: "Faltan referencia, email de cliente o enlace de descarga." },
        { status: 400 }
      );
    }

    await sendTranslationReadyEmail({
      toEmail: clientEmail,
      reference,
      downloadUrl,
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "notification.delivery_ready.sent",
        message: "Notificacion de traduccion lista enviada al cliente.",
        payload: {
          actorEmail,
          channel: "EMAIL",
          toEmail: clientEmail,
          templateKey: String(body.templateKey || "email_delivery_ready"),
          downloadUrl,
          sentAt: new Date().toISOString(),
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo enviar la notificacion." },
      { status: 500 }
    );
  }
}
