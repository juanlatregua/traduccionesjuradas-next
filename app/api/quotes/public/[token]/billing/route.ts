// app/api/quotes/public/[token]/billing/route.ts — «Revisa tus datos de
// facturación» de /q/[token], antes de pagar. Se guardan ligados al presupuesto
// (lib/quote-billing.ts) y al nacer el pedido pasan a BillingData y a Customer.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { decimalToNumber } from "@/lib/quotes";
import { BILLING_RATE, billingLocked, validateBilling } from "@/lib/q-journey";
import { billingLockState, saveQuoteBilling } from "@/lib/quote-billing";

export const runtime = "nodejs";

type Params = { params: { token: string } };

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `quote-billing:${params.token}:${ip}`, ...BILLING_RATE });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    select: { id: true, paidAt: true, total: true, balanceAmount: true, customerEmail: true, deletedAt: true },
  });
  if (!quote || quote.deletedAt) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }

  // Tras el pago (o con pedido / factura emitida viva) los datos fiscales los toca solo el staff.
  const lock = await billingLockState(quote.id);
  if (billingLocked({ paidAt: quote.paidAt, ...lock })) {
    return NextResponse.json(
      { ok: false, error: "Este presupuesto ya tiene pedido o factura: escríbenos para cambiar los datos fiscales.", code: "locked" },
      { status: 409 }
    );
  }

  // El umbral de 400 € se mide sobre el importe total de la factura (plazos incluidos).
  const totalCents = Math.round((decimalToNumber(quote.total) + decimalToNumber(quote.balanceAmount)) * 100);
  const result = validateBilling(body || {}, totalCents);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Datos no válidos.", code: result.code }, { status: 400 });
  }

  await saveQuoteBilling({ quoteId: quote.id, customerEmail: quote.customerEmail, value: result.value, orderId: lock.orderId });
  return NextResponse.json({ ok: true });
}
