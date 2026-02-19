import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrder, getOrdersByClientEmail } from "@/lib/orders";
import { sendOrderCreatedEmail, sendNewOrderStaffEmail } from "@/lib/email";

export const runtime = "nodejs";

/* GET  /api/orders  — list orders for authenticated client */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
  }

  try {
    const orders = await getOrdersByClientEmail(session.user.email);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("[orders] error listing orders", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedidos." }, { status: 500 });
  }
}

/* POST /api/orders  — create a new order */
type CreateBody = {
  source?: "preset" | "file";
  title?: string;
  langPair?: string;
  words?: number;
  pagesLabel?: string;
  amountCents?: number;
  currency?: string;
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as CreateBody;

    if (!body.title || !body.amountCents || body.amountCents < 100) {
      return NextResponse.json(
        { ok: false, error: "Titulo e importe requeridos (minimo 1 EUR)." },
        { status: 400 }
      );
    }

    const order = await createOrder({
      clientEmail: session.user.email,
      clientName: session.user.name || undefined,
      source: body.source || "file",
      title: body.title,
      langPair: body.langPair,
      words: body.words,
      pagesLabel: body.pagesLabel,
      amountCents: body.amountCents,
      currency: body.currency || "eur",
    });

    // Send emails (non-blocking)
    const baseUrl = process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net";
    const paymentUrl = `${baseUrl}/area-cliente/pedido/${order.reference}/pagar`;

    sendOrderCreatedEmail({
      toEmail: session.user.email,
      clientName: session.user.name || undefined,
      reference: order.reference,
      title: body.title,
      amountCents: body.amountCents,
      paymentUrl,
    }).catch((e) => console.error("[orders] email to client failed", e));

    sendNewOrderStaffEmail({
      reference: order.reference,
      title: body.title,
      amountCents: body.amountCents,
      clientEmail: session.user.email,
      langPair: body.langPair,
    }).catch((e) => console.error("[orders] email to staff failed", e));

    return NextResponse.json({ ok: true, order: { id: order.id, reference: order.reference } });
  } catch (err) {
    console.error("[orders] error creating order", err);
    return NextResponse.json({ ok: false, error: "Error al crear pedido." }, { status: 500 });
  }
}
