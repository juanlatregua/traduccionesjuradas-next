// lib/precio-tras-envio.ts — La cifra del jurado llega con el presupuesto YA enviado
// y sin pagar. Antes solo quedaba en LavoriPriceRequest.priceCents: el coste
// estimado seguía en las líneas (Florian 2026-00250: 70 € estimado, Morton 40 €;
// Bianca 2026-00245: 155 € estimado, Nielson 90 € con IVA) y, si era más caro que
// lo cobrado, nadie frenaba el pago. Ver lib/precio-tras-envio-math.ts.
// El precio al cliente y el PDF NO se tocan nunca.

import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/quotes";
import {
  decideSentQuotePrice,
  foreignLinesReason,
  freezeKeyFor,
  isUnpaidSentQuote,
  shouldFreeze,
  type SentPriceDecision,
} from "@/lib/precio-tras-envio-math";

const SITE = "https://www.traduccionesjuradas.net";
const RASTRO_PREFIX = "[precio-tras-envio]";
const eur = (c: number) => `${(c / 100).toFixed(2)} €`;

export type SentQuotePriceResult =
  | { handled: false; reason: string }
  | {
      handled: true;
      repetido: boolean;
      quoteNumber: string;
      decision: SentPriceDecision;
      written: boolean;
      frozen: boolean;
      unfrozen: boolean;
    };

async function rastro(quoteId: string, subject: string, body: string) {
  const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
  return prisma.messageLog
    .create({
      data: { quoteId, channel: "EMAIL", type: "MARGIN_OVERRIDE", recipient: adminEmail, subject: `${RASTRO_PREFIX} ${subject}`.slice(0, 250), body, status: "PENDING" },
      select: { id: true },
    })
    .catch((err) => {
      console.error("[precio-tras-envio] rastro fallo:", err);
      return null;
    });
}

async function avisar(input: { logId: string | null; subject: string; lines: string[]; sms: string | null; smsContext: string }) {
  const [{ sendMail }, { sendStaffAlertSMS }] = await Promise.all([import("@/lib/azure-mail"), import("@/lib/sms")]);
  const to = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";
  let mailOk = true;
  await Promise.all([
    sendMail({ to, subject: input.subject, text: input.lines.join("\n"), html: input.lines.map((l) => `<p>${l}</p>`).join("") }).catch((err) => {
      mailOk = false;
      console.error("[precio-tras-envio] email fallo:", err);
    }),
    input.sms ? sendStaffAlertSMS(input.sms, input.smsContext).catch((err) => console.error("[precio-tras-envio] SMS fallo:", err)) : null,
  ]);
  if (input.logId) {
    await prisma.messageLog
      .update({ where: { id: input.logId }, data: { status: mailOk ? "SENT" : "FAILED", sentAt: mailOk ? new Date() : null } })
      .catch(() => {});
  }
}

/** Expira las sesiones de Stripe abiertas del presupuesto. Fail-safe: nunca lanza.
 *  Las sesiones no se guardan al crearse (solo al cobrar, en QuotePayment), así que
 *  se buscan en Stripe las abiertas de las últimas 24 h con metadata.quoteId. */
async function expireOpenStripeSessions(quoteId: string): Promise<{ expired: string[]; error: string | null }> {
  const expired: string[] = [];
  try {
    const { getStripe } = await import("@/lib/stripe");
    const stripe = getStripe();
    const ids = new Set(
      (await prisma.quotePayment.findMany({ where: { quoteId, stripeSessionId: { not: null } }, select: { stripeSessionId: true } }))
        .map((p) => p.stripeSessionId as string)
    );
    await stripe.checkout.sessions
      .list({ status: "open", created: { gte: Math.floor(Date.now() / 1000) - 24 * 3600 }, limit: 100 })
      .autoPagingEach((s) => {
        if (s.metadata?.quoteId === quoteId) ids.add(s.id);
      });
    for (const id of Array.from(ids)) {
      try {
        await stripe.checkout.sessions.expire(id);
        expired.push(id);
      } catch {
        // Ya completada o caducada: nada que expirar.
      }
    }
    return { expired, error: null };
  } catch (err: any) {
    console.error("[precio-tras-envio] expirar sesiones Stripe fallo:", err);
    return { expired, error: String(err?.message || err) };
  }
}

export async function handleLeadPriceOnSentQuote(leadId: string): Promise<SentQuotePriceResult> {
  const lead = await prisma.lavoriPriceRequest.findUnique({
    where: { id: leadId },
    select: { id: true, ref: true, par: true, quoteId: true, priceCents: true, miembroId: true, miembroNombre: true, expedienteRef: true },
  });
  if (!lead?.quoteId || !lead.priceCents) return { handled: false, reason: "solicitud sin presupuesto atado o sin precio" };

  const quote = await prisma.quote.findUnique({
    where: { id: lead.quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      paidAt: true,
      createdAt: true,
      sourceLang: true,
      targetLang: true,
      customerId: true,
      expedienteRef: true,
      discountAmount: true,
      paymentFrozenAt: true,
      paymentFreezeKey: true,
      _count: { select: { orders: { where: { paymentStatus: "PAID" } } } },
      lines: { orderBy: { createdAt: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, supplierUnitCost: true } },
    },
  });
  if (!quote) return { handled: false, reason: "presupuesto atado no encontrado" };
  if (!isUnpaidSentQuote({ status: quote.status, paidAt: quote.paidAt, paidOrdersCount: quote._count.orders })) {
    return { handled: false, reason: `presupuesto ${quote.quoteNumber} en ${quote.status}${quote.paidAt ? " (pagado)" : ""}${quote._count.orders ? " con pedido pagado" : ""}` };
  }
  // Reemitido a mano: si hay uno más reciente ya enviado del mismo expediente (o cliente)
  // y par, el viejo no se toca; la alarma de siempre cita el nuevo.
  const expediente = quote.expedienteRef || lead.expedienteRef;
  const nuevo = await prisma.quote.findFirst({
    where: {
      id: { not: quote.id },
      createdAt: { gt: quote.createdAt },
      status: { not: "DRAFT" },
      deletedAt: null,
      sourceLang: quote.sourceLang,
      targetLang: quote.targetLang,
      OR: [{ customerId: quote.customerId }, ...(expediente ? [{ expedienteRef: expediente }] : [])],
    },
    orderBy: { createdAt: "desc" },
    select: { quoteNumber: true, status: true },
  });
  if (nuevo) return { handled: false, reason: `hay un presupuesto más reciente ${nuevo.quoteNumber} (${nuevo.status}) del mismo cliente y par: revisa ese, el ${quote.quoteNumber} no se ha tocado` };

  // Coste real en BASE: la cifra del canal puede venir en líquido o con IVA (Daniela ÷1,06,
  // Nielson ÷1,21). Con varias solicitudes con precio atadas al presupuesto, cuentan todas.
  const [{ priceBasisForMember }, { channelPriceToBaseCents }] = await Promise.all([import("@/lib/lavori-directo"), import("@/lib/lavori-directo-math")]);
  const otras = await prisma.lavoriPriceRequest.findMany({
    where: { quoteId: quote.id, id: { not: lead.id }, priceCents: { not: null }, status: { in: ["PRICED", "ACCEPTED"] } },
    select: { priceCents: true, miembroId: true },
  });
  const baseCents = channelPriceToBaseCents(lead.priceCents, priceBasisForMember(lead.miembroId));
  const realCostCents = baseCents + otras.reduce((a, o) => a + channelPriceToBaseCents(o.priceCents!, priceBasisForMember(o.miembroId)), 0);

  const decision = decideSentQuotePrice({
    lines: quote.lines.map((l) => ({ quantity: decimalToNumber(l.quantity), unitPrice: decimalToNumber(l.unitPrice), supplierUnitCost: l.supplierUnitCost == null ? null : decimalToNumber(l.supplierUnitCost) })),
    discountCents: Math.round(decimalToNumber(quote.discountAmount) * 100),
    realCostCents,
    otherPricedRequests: otras.length > 0,
    foreignLinesReason: foreignLinesReason({ descriptions: quote.lines.map((l) => l.description), leadPar: lead.par, sourceLang: quote.sourceLang, targetLang: quote.targetLang }),
  });
  const key = freezeKeyFor(lead.ref, lead.priceCents, lead.miembroId);
  const ficha = `${SITE}/zona-traductor/presupuestos/${quote.id}`;
  const miembro = lead.miembroNombre || lead.miembroId || "el jurado";
  const cifra = baseCents === lead.priceCents ? eur(lead.priceCents) : `${eur(lead.priceCents)} (${eur(baseCents)} base)`;
  const resumen = [
    `${miembro} ha dado ${cifra} para ${lead.ref} (${lead.par}) con el presupuesto ${quote.quoteNumber} YA ENVIADO (${quote.status}, sin pagar).`,
    `Base al cliente (sin IVA, tras descuento): ${eur(decision.clientBaseCents)} — no se toca, ni el PDF.`,
    `Coste estimado en las líneas: ${eur(decision.estimatedCostCents)} → margen ${eur(decision.estimatedMarginCents)}.`,
    `Coste real del jurado: ${eur(decision.realCostCents)} → margen ${eur(decision.marginCents)} (${decision.marginPct.toFixed(0)} % sobre coste).`,
  ];

  if (decision.kind === "perdida") {
    if (!shouldFreeze(decision, quote, key)) {
      return { handled: true, repetido: true, quoteNumber: quote.quoteNumber, decision, written: false, frozen: Boolean(quote.paymentFrozenAt), unfrozen: false };
    }
    const reason = `Pérdida: ${miembro} ${cifra} (${lead.ref}) · coste estimado ${eur(decision.estimatedCostCents)} · base al cliente ${eur(decision.clientBaseCents)} · margen ${eur(decision.marginCents)}.`;
    const logId = (await rastro(quote.id, `pago CONGELADO ${quote.quoteNumber}`, [...resumen, reason].join("\n")))?.id ?? null;
    // Condición atómica: un pedido pagado entre medias o el mismo evento simultáneo
    // (misma clave) no congela dos veces.
    const congelado = await prisma.quote.updateMany({
      where: { id: quote.id, paidAt: null, orders: { none: { paymentStatus: "PAID" } }, OR: [{ paymentFreezeKey: null }, { paymentFreezeKey: { not: key } }] },
      data: { paymentFrozenAt: new Date(), paymentFrozenReason: reason.slice(0, 500), paymentFreezeKey: key },
    });
    if (congelado.count === 0) {
      const ahora = await prisma.quote.findUnique({ where: { id: quote.id }, select: { paymentFreezeKey: true } });
      if (ahora?.paymentFreezeKey === key) return { handled: true, repetido: true, quoteNumber: quote.quoteNumber, decision, written: false, frozen: true, unfrozen: false };
      return { handled: false, reason: `presupuesto ${quote.quoteNumber} pagado entre la lectura y la congelación` };
    }
    const stripe = await expireOpenStripeSessions(quote.id);
    await avisar({
      logId,
      subject: `⛔ ${quote.quoteNumber} CONGELADO: el jurado cobra más de lo que paga el cliente (${eur(decision.marginCents)})`,
      lines: [
        ...resumen,
        `El pago está CONGELADO: /q enseña «Estamos actualizando tu presupuesto» y tarjeta, transferencia y crédito dan 409; si aun así entra un cobro, no se asigna solo al jurado. El coste NO se ha escrito en las líneas${decision.estimatedCostCents > 0 ? " (el freno de lavori al pagar sigue activo)" : " — ⚠ y no hay coste estimado: el freno de lavori al pagar NO actuaría"}.`,
        stripe.error ? `⚠ No se pudieron revisar las sesiones de Stripe abiertas: ${stripe.error}` : stripe.expired.length ? `Sesiones de Stripe abiertas expiradas: ${stripe.expired.join(", ")}` : "No había sesiones de Stripe abiertas.",
        `Decide: monta uno nuevo o «Desbloquear igualmente» (asumes la pérdida): ${ficha}`,
      ],
      sms: `${quote.quoteNumber} CONGELADO: ${miembro} ${eur(decision.realCostCents)} > cliente ${eur(decision.clientBaseCents)} base. Decide: ${ficha}`,
      smsContext: `precio_tras_envio_congelado ${quote.quoteNumber}`,
    });
    return { handled: true, repetido: false, quoteNumber: quote.quoteNumber, decision, written: false, frozen: true, unfrozen: false };
  }

  // ok / margen_bajo: el coste real entra en las líneas (si se puede repartir) y, si una
  // cifra anterior lo había congelado, se descongela solo: ya no hay pérdida. La clave se
  // borra siempre: solo «Desbloquear igualmente» la conserva (X pérdida → Y ok → X recongela).
  const wasFrozen = Boolean(quote.paymentFrozenAt);
  if (decision.unchanged && !wasFrozen) {
    if (quote.paymentFreezeKey) await prisma.quote.updateMany({ where: { id: quote.id }, data: { paymentFreezeKey: null } });
    return { handled: true, repetido: true, quoteNumber: quote.quoteNumber, decision, written: false, frozen: false, unfrozen: false };
  }
  const bajo = decision.kind === "margen_bajo";
  const titulo = bajo ? `MARGEN BAJO ${quote.quoteNumber}` : `coste real ${quote.quoteNumber}`;
  const logId = (await rastro(quote.id, titulo, resumen.join("\n")))?.id ?? null;
  const newCosts = decision.newLineCostCents;
  const written = await prisma.$transaction(async (tx) => {
    const vivo = await tx.quote.updateMany({
      where: { id: quote.id, paidAt: null, status: { in: ["SENT", "OPENED", "ACCEPTED"] }, orders: { none: { paymentStatus: "PAID" } } },
      data: { paymentFrozenAt: null, paymentFreezeKey: null },
    });
    if (vivo.count === 0) return null;
    if (!newCosts || decision.unchanged) return false;
    for (let i = 0; i < quote.lines.length; i++) {
      await tx.quoteLine.update({ where: { id: quote.lines[i].id }, data: { supplierUnitCost: newCosts[i] / 100 } });
    }
    return true;
  });
  if (written === null) return { handled: false, reason: `presupuesto ${quote.quoteNumber} pagado o cambiado entre la lectura y la escritura` };

  await avisar({
    logId,
    subject: bajo
      ? `⚠ ${quote.quoteNumber}: precio de ${miembro} tras el envío deja MARGEN BAJO (${eur(decision.marginCents)})`
      : `💶 ${quote.quoteNumber}: precio de ${miembro} recibido tras el envío — coste ${eur(decision.estimatedCostCents)} → ${eur(decision.realCostCents)}`,
    lines: [
      ...resumen,
      written
        ? `✅ Coste real escrito en las líneas (antes ${eur(decision.estimatedCostCents)}, ahora ${eur(decision.realCostCents)}); precio al cliente intacto.`
        : `⚠ Coste NO escrito en las líneas (${decision.noSpreadReason || "sin cambios"}): repártelo tú en la ficha.`,
      bajo ? `⚠ MARGEN BAJO: por debajo del mínimo; el cliente puede pagar.` : "",
      wasFrozen ? `🔓 El pago estaba congelado por una cifra anterior y se ha DESCONGELADO: ya no hay pérdida.` : "",
      `Ficha: ${ficha}`,
    ].filter(Boolean),
    sms:
      bajo || decision.marginDown
        ? `${quote.quoteNumber}${bajo ? " MARGEN BAJO" : ""}: ${miembro} ${eur(decision.realCostCents)} (estimado ${eur(decision.estimatedCostCents)}), margen ${eur(decision.marginCents)}. ${ficha}`
        : null,
    smsContext: `precio_tras_envio ${quote.quoteNumber}`,
  });
  return { handled: true, repetido: false, quoteNumber: quote.quoteNumber, decision, written: Boolean(written), frozen: false, unfrozen: wasFrozen };
}

/** Cobro registrado con el pago CONGELADO (tarjeta, Bizum/transferencia confirmados, pago
 *  manual): el dinero se acepta, pero el encargo NO va solo al jurado. Rastro + dos canales. */
export async function alertPaidWhileFrozen(input: { quoteId: string; via: string; amountEur?: number | null; reference?: string | null }): Promise<void> {
  const quote = await prisma.quote.findUnique({ where: { id: input.quoteId }, select: { quoteNumber: true, paymentFrozenReason: true } });
  if (!quote) return;
  const ficha = `${SITE}/zona-traductor/presupuestos/${input.quoteId}`;
  const aviso = `COBRADO CONGELADO: ${quote.quoteNumber}${input.reference ? ` (pedido ${input.reference})` : ""} se ha cobrado por ${input.via}${input.amountEur ? ` (${input.amountEur.toFixed(2)} €)` : ""} con el pago congelado. NO se ha asignado al jurado: revisar. ${quote.paymentFrozenReason || ""} ${ficha}`;
  const logId = (await rastro(input.quoteId, `cobrado congelado ${quote.quoteNumber}`, aviso))?.id ?? null;
  await avisar({
    logId,
    subject: `⛔ ${quote.quoteNumber} COBRADO CONGELADO: revisar antes de asignar`,
    lines: [aviso],
    sms: aviso.slice(0, 300),
    smsContext: `cobrado_congelado ${quote.quoteNumber}`,
  });
}
