import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import { createPayPalOrder } from "@/lib/paypal";

export const runtime = "nodejs";

type PayPalBody = {
  reference?: string;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
    }

    const body = (await req.json()) as PayPalBody;
    const reference = body.reference;

    if (!reference) {
      return NextResponse.json({ ok: false, error: "Referencia requerida." }, { status: 400 });
    }

    const order = await getOrderDetail(reference, session.user.email);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ ok: false, error: "Este pedido ya esta pagado." }, { status: 400 });
    }

    const amountEur = (order.amountCents / 100).toFixed(2);
    const paypalOrder = await createPayPalOrder({
      orderReference: reference,
      amountEur,
      description: order.title || `Traduccion jurada ${reference}`,
    });

    return NextResponse.json({ ok: true, paypalOrderId: paypalOrder.id });
  } catch (err: any) {
    console.error("[paypal] error creating order", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al crear orden PayPal." },
      { status: 500 }
    );
  }
}
