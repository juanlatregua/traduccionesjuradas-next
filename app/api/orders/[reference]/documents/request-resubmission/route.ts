import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendDocumentResubmissionRequestEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  reason?: string;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const body = (await req.json()) as Body;
    const reason = String(body?.reason || "").trim();

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        clientEmail: true,
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const { buildSignedOrderUrl } = await import("@/lib/order-token");
    const uploadUrl = buildSignedOrderUrl(order.reference, "pagar");

    await sendDocumentResubmissionRequestEmail({
      toEmail: order.clientEmail,
      reference: order.reference,
      reason: reason || null,
      uploadUrl,
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.source_document_resubmission_requested",
        message: "Se solicita al cliente reenviar documento por falta de legibilidad.",
        payload: {
          actorEmail,
          reason: reason || null,
          uploadUrl,
        },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[orders-documents-resubmission] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo solicitar el reenvio al cliente." },
      { status: 500 }
    );
  }
}
