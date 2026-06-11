import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { sendPaymentReconciliationAlertEmail, sendCronFailureAlertEmail } from "@/lib/email";

export const runtime = "nodejs";

/* Cron diario: cruza los pagos confirmados en Stripe contra los pedidos PAID
   de la BD y alerta por email de cualquier pago cobrado sin pedido. */

function hasCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  // El cron NO puede morir en silencio: si la lógica revienta (Stripe/BD caídos),
  // la red de seguridad dejaría de avisar. Alertamos del propio fallo y devolvemos
  // 500 para que Vercel lo marque como cron fallido (señal independiente del email).
  try {
    return await runReconciliation();
  } catch (err: any) {
    console.error("[payment-reconciliation] cron failed:", err?.message || err);
    try {
      await sendCronFailureAlertEmail({ job: "payment-reconciliation", detail: String(err?.message || err) });
    } catch (alertErr) {
      console.error("[payment-reconciliation] failure alert also failed:", alertErr);
    }
    return NextResponse.json({ ok: false, error: "Reconciliation cron failed." }, { status: 500 });
  }
}

async function runReconciliation(): Promise<NextResponse> {
  const stripe = getStripe();
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 72 * 3600;
  const graceCutoff = now - 30 * 60; // ignora pagos de los ultimos 30 min (webhook asincrono)

  // 1. Sesiones de checkout pagadas en la ventana
  const sessions: Array<{
    id: string;
    created: number;
    reference: string | null;
    sessionRefId: string | null;
    email: string | null;
    amount: string;
  }> = [];

  let startingAfter: string | undefined;
  for (let page = 0; page < 5; page++) {
    const res = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: windowStart },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of res.data) {
      if (s.status !== "complete" || s.payment_status !== "paid") continue;
      if (s.created > graceCutoff) continue;
      sessions.push({
        id: s.id,
        created: s.created,
        reference: String(s.metadata?.orderReference || "").trim() || null,
        sessionRefId: String(s.metadata?.orderSessionId || "").trim() || null,
        email:
          String(s.customer_details?.email || s.customer_email || "")
            .trim()
            .toLowerCase() || null,
        amount: `${((s.amount_total || 0) / 100).toFixed(2)} ${(s.currency || "eur").toUpperCase()}`,
      });
    }
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1]?.id;
  }

  // 2. Resolver la referencia de las sesiones del funnel (orderSessionId -> reference)
  const funnelIds = sessions
    .map((s) => s.sessionRefId)
    .filter((x): x is string => Boolean(x));
  let refByOrderSessionId = new Map<string, string>();
  if (funnelIds.length > 0) {
    const os = await prisma.orderSession.findMany({
      where: { id: { in: funnelIds } },
      select: { id: true, reference: true },
    });
    refByOrderSessionId = new Map(os.map((o) => [o.id, o.reference]));
  }

  // 3. Cruzar contra los pedidos PAID
  const resolved = sessions.map((s) => ({
    ...s,
    resolvedRef:
      s.reference ||
      (s.sessionRefId ? refByOrderSessionId.get(s.sessionRefId) || null : null),
  }));
  const refs = resolved
    .map((r) => r.resolvedRef)
    .filter((x): x is string => Boolean(x));
  let paidOrderRefs = new Set<string>();
  if (refs.length > 0) {
    const orders = await prisma.order.findMany({
      where: { reference: { in: refs }, paymentStatus: "PAID" },
      select: { reference: true },
    });
    paidOrderRefs = new Set(orders.map((o) => o.reference));
  }

  const discrepancies = resolved
    .filter((r) => !r.resolvedRef || !paidOrderRefs.has(r.resolvedRef))
    .map((r) => ({
      reference: r.resolvedRef,
      clientEmail: r.email,
      amount: r.amount,
      stripeSessionId: r.id,
      createdAt: new Date(r.created * 1000)
        .toISOString()
        .slice(0, 16)
        .replace("T", " "),
    }));

  if (discrepancies.length > 0) {
    try {
      await sendPaymentReconciliationAlertEmail({ discrepancies });
    } catch (err: any) {
      console.error(
        "[payment-reconciliation] alert email failed:",
        err?.message || err,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: sessions.length,
    discrepancies: discrepancies.length,
    references: discrepancies.map((d) => d.reference),
  });
}

export const POST = GET;
