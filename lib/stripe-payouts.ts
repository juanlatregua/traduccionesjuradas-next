// lib/stripe-payouts.ts — Los INGRESOS DE STRIPE tal como llegan al banco.
//
// El problema que resuelve: Stripe no ingresa cobro a cobro. Agrupa varios en un
// payout semanal y descuenta su comisión, así que en el extracto aparece UNA
// línea de 176,47 € que no coincide con ningún pedido. El conciliador cruzaba
// línea contra pedido, con ±4 % de comisión y ventana de 7 días, y fallaba por
// las dos cosas a la vez: importe agrupado y fecha del payout (hasta 10 días
// después del cobro). Medido 28-ago-2026: de 9 payouts, 3 agrupan varios cobros
// y NINGUNO cae dentro de la ventana de su propio cobro.
//
// Aquí se le pregunta a Stripe, que es quien lo sabe: qué cobros lleva cada
// payout, cuánta comisión y qué día llega. Con eso la conciliación deja de
// adivinar y una línea del banco se explica entera.
//
// Solo LECTURA de la API de Stripe.

import { getStripe } from "@/lib/stripe";

export type StripeCharge = {
  paymentIntentId: string | null;
  chargeId: string;
  amountCents: number; // bruto cobrado al cliente
  feeCents: number;
  netCents: number;
  created: string; // ISO
  description: string | null;
};

export type StripeRefund = {
  chargeId: string;
  amountCents: number; // positivo: lo devuelto al cliente
  created: string;
  description: string | null;
};

export type StripePayout = {
  id: string;
  arrivalDate: string; // ISO — el día que aparece en el extracto
  netCents: number; // lo que ingresa el banco: es el importe a casar
  grossCents: number; // suma de los cobros
  feeCents: number; // comisión total del payout
  refundCents: number; // devoluciones incluidas en ESTA liquidación
  // Aportación climática de Stripe (Climate contribution): NO es comisión, es
  // una aportación voluntaria a captura de carbono que Stripe descuenta del
  // mismo ingreso. Va aparte porque contablemente no es lo mismo que la
  // comisión del servicio de pago, y el asesor lo va a preguntar.
  climateCents: number;
  status: string;
  charges: StripeCharge[];
  refunds: StripeRefund[];
};

/** Payouts con su composición. `since` en ISO (por defecto, 120 días atrás). */
export async function fetchStripePayouts(since?: Date): Promise<StripePayout[]> {
  const stripe = getStripe();
  if (!stripe) return [];
  const gte = Math.floor((since ? since.getTime() : Date.now() - 120 * 86400000) / 1000);
  const payouts = await stripe.payouts.list({ created: { gte }, limit: 100 });
  const out: StripePayout[] = [];
  for (const p of payouts.data) {
    const txs = await stripe.balanceTransactions.list({ payout: p.id, limit: 100, expand: ["data.source"] });
    const charges: StripeCharge[] = [];
    const refunds: StripeRefund[] = [];
    let climate = 0;
    for (const t of txs.data) {
      // Las DEVOLUCIONES viajan dentro de la misma liquidación como apunte
      // negativo y hay que restarlas, o el bruto no cuadra con lo ingresado.
      // Caso real (15-jun-2026): 502,95 de cargos − 8,04 de comisión = 494,91,
      // pero al banco entraron 444,09. Los 50,82 que faltaban eran el reembolso
      // de un encargo en ucraniano que Juan rechazó por estar fuera de su
      // habilitación y devolvió el mismo día.
      if (t.type === "refund" || t.type === "payment_refund") {
        const src: any = t.source;
        refunds.push({
          chargeId: typeof src?.charge === "string" ? src.charge : String(src?.id || ""),
          amountCents: Math.abs(t.amount),
          created: new Date(t.created * 1000).toISOString(),
          description: src?.reason ?? t.description ?? null,
        });
        continue;
      }
      if (t.type === "contribution") {
        climate += Math.abs(t.amount);
        continue;
      }
      if (t.type !== "charge" && t.type !== "payment") continue;
      const src = t.source as any;
      charges.push({
        paymentIntentId: typeof src?.payment_intent === "string" ? src.payment_intent : src?.payment_intent?.id ?? null,
        chargeId: typeof src?.id === "string" ? src.id : String(t.source || ""),
        amountCents: t.amount,
        feeCents: t.fee,
        netCents: t.net,
        created: new Date(t.created * 1000).toISOString(),
        description: src?.description ?? t.description ?? null,
      });
    }
    out.push({
      id: p.id,
      arrivalDate: new Date(p.arrival_date * 1000).toISOString(),
      netCents: p.amount,
      grossCents: charges.reduce((a, c) => a + c.amountCents, 0),
      feeCents: charges.reduce((a, c) => a + c.feeCents, 0),
      refundCents: refunds.reduce((a, r) => a + r.amountCents, 0),
      climateCents: climate,
      status: p.status,
      charges,
      refunds,
    });
  }
  return out.sort((a, b) => a.arrivalDate.localeCompare(b.arrivalDate));
}

/** Marcador idempotente del gasto de comisión de un payout. */
export function stripeFeeMarker(payoutId: string) {
  return `stripe:${payoutId}`;
}

/**
 * Registra la COMISIÓN del payout como gasto. Sin esto los libros no cuadran:
 * el banco ingresa el neto y las facturas emitidas suman el bruto, así que la
 * diferencia tiene que estar contabilizada o el asesor no puede cerrar el
 * trimestre. Stripe Technology Europe (Irlanda) ⇒ inversión del sujeto pasivo:
 * base sin IVA repercutido aquí, se autoliquida en el 303. Idempotente por
 * payout: volver a ejecutarlo no duplica.
 */
export async function registerStripeFeeExpense(payout: StripePayout) {
  const { prisma } = await import("@/lib/prisma");
  const cargoTotal = payout.feeCents + payout.climateCents;
  if (cargoTotal <= 0) return { created: false, reason: "sin comisión" };
  const marker = stripeFeeMarker(payout.id);
  const ya = await prisma.expense.findFirst({ where: { supplierInvoiceNumber: marker }, select: { id: true } });
  if (ya) return { created: false, reason: "ya registrado", id: ya.id };
  const e = await prisma.expense.create({
    data: {
      date: new Date(payout.arrivalDate),
      brand: "traduccionesjuradas",
      supplier: "Stripe Technology Europe Ltd",
      supplierInvoiceNumber: marker,
      concept: `Comisión Stripe · liquidación ${payout.arrivalDate.slice(0, 10)} (${payout.charges.length} cobro${payout.charges.length === 1 ? "" : "s"}, bruto ${(payout.grossCents / 100).toFixed(2)} €${payout.refundCents > 0 ? `, devuelto ${(payout.refundCents / 100).toFixed(2)} €` : ""})`,
      category: "comisiones",
      baseCents: payout.feeCents + payout.climateCents,
      vatRate: 0,
      vatCents: 0,
      taxTreatment: "isp_intracom",
      ivaDeducible: true,
      irpfRetentionPct: 0,
      irpfCents: 0,
      totalCents: payout.feeCents + payout.climateCents,
      payableCents: 0, // ya descontada del ingreso: no hay nada que transferir
      paymentStatus: "PAID",
      paidAt: new Date(payout.arrivalDate),
      notes: `Descontado por Stripe del propio ingreso (payout ${payout.id}). Bruto ${(payout.grossCents / 100).toFixed(2)} € − comisión ${(payout.feeCents / 100).toFixed(2)} €${payout.climateCents > 0 ? ` − aportación climática ${(payout.climateCents / 100).toFixed(2)} €` : ""}${payout.refundCents > 0 ? ` − devoluciones ${(payout.refundCents / 100).toFixed(2)} €` : ""} = ${(payout.netCents / 100).toFixed(2)} € ingresados. La aportación climática NO es comisión del servicio de pago: es una aportación voluntaria a captura de carbono.`,
    },
  });
  return { created: true, id: e.id };
}

/**
 * Traduce los payouts a lo que entiende el conciliador: cada liquidación con
 * los PEDIDOS que la componen, resueltos por el payment_intent que se guardó al
 * cobrar (Order.externalPaymentId). Un cobro sin pedido conocido no rompe nada:
 * la liquidación se sigue casando por importe, solo que sin nombre.
 */
export async function buildPayoutSnapshot(since?: Date) {
  const { prisma } = await import("@/lib/prisma");
  const payouts = await fetchStripePayouts(since);
  const pis = payouts.flatMap((p) => p.charges.map((c) => c.paymentIntentId).filter(Boolean)) as string[];
  const orders = pis.length
    ? await prisma.order.findMany({
        where: { externalPaymentId: { in: pis } },
        select: { reference: true, amountCents: true, clientName: true, externalPaymentId: true },
      })
    : [];
  const porPi = new Map(orders.map((o) => [o.externalPaymentId as string, o]));
  return payouts.map((p) => ({
    id: p.id,
    arrivalDate: p.arrivalDate,
    netCents: p.netCents,
    grossCents: p.grossCents,
    feeCents: p.feeCents,
    refundCents: p.refundCents,
    climateCents: p.climateCents,
    orders: p.charges.map((c) => {
      const o = c.paymentIntentId ? porPi.get(c.paymentIntentId) : null;
      return {
        reference: o?.reference ?? `(cobro ${c.chargeId.slice(-8)})`,
        amountCents: c.amountCents,
        clientName: o?.clientName ?? c.description ?? null,
      };
    }),
  }));
}
