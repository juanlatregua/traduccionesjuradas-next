import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import { buildRedsysFormData } from "@/lib/redsys";

export const runtime = "nodejs";

type RedsysBody = {
  reference?: string;
};

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
    }

    const body = (await req.json()) as RedsysBody;
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

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;

    const formData = buildRedsysFormData({
      orderReference: reference,
      amountCents: order.amountCents,
      notificationUrl: `${origin}/api/payment/redsys/notification`,
      successUrl: `${origin}/pago/exito?ref=${encodeURIComponent(reference)}`,
      cancelUrl: `${origin}/pago/cancelado?ref=${encodeURIComponent(reference)}`,
    });

    return NextResponse.json({ ok: true, ...formData });
  } catch (err: any) {
    console.error("[redsys] error creating form", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al generar formulario de pago." },
      { status: 500 }
    );
  }
}
