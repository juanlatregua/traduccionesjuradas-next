import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { confirmManualPayment, getOrderDetail } from "@/lib/orders";
import { sendPaymentConfirmedEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type ConfirmBody = {
  method?: "BIZUM" | "TRANSFER";
};

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Acceso denegado." }, { status: 403 });
  }

  try {
    const body = (await req.json()) as ConfirmBody;
    const method = body.method === "TRANSFER" ? "TRANSFER" : "BIZUM";

    await confirmManualPayment(params.reference, method);

    // Notify client (non-blocking)
    const order = await getOrderDetail(params.reference);
    if (order?.clientEmail) {
      sendPaymentConfirmedEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        title: order.title,
        amountCents: order.amountCents,
        method,
      }).catch((e) => console.error("[confirm-payment] email failed", e));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[confirm-payment] error", err);
    return NextResponse.json({ ok: false, error: "Error al confirmar pago." }, { status: 500 });
  }
}
