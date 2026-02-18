import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { getOrderDetail, updateDeliveryState } from "@/lib/orders";
import { sendTranslationReadyEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type DeliveryBody = {
  state?: "EN_PROCESO" | "TRADUCIDO";
  translatedFileUrl?: string;
  notifyClient?: boolean;
};

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Acceso denegado." }, { status: 403 });
  }

  try {
    const order = await getOrderDetail(params.reference);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as DeliveryBody;
    const state = body.state || "EN_PROCESO";
    const translatedFileUrl = (body.translatedFileUrl || "").trim();

    if (state === "TRADUCIDO" && !translatedFileUrl) {
      return NextResponse.json(
        { ok: false, error: "Para marcar como traducido debes adjuntar URL del archivo." },
        { status: 400 }
      );
    }

    await updateDeliveryState(order.reference, state, translatedFileUrl || undefined);

    if (body.notifyClient && state === "TRADUCIDO" && translatedFileUrl) {
      await sendTranslationReadyEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        downloadUrl: translatedFileUrl,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[orders-delivery] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al actualizar la entrega." },
      { status: 500 }
    );
  }
}
