// lib/lavori-quote-fill.ts — La cifra del jurado cae en el BORRADOR que ya existe.
//
// Problema real de Juan (17-sep-2026): monta el presupuesto en el builder, pide
// precio a lavori y no puede cerrarlo porque el coste del traductor aún no está;
// cuando el jurado cotiza, lo monta OTRA VEZ y nacen dos presupuestos del mismo
// cliente (caso Devaulx 2026-00160 / 2026-00166). Aquí la cifra entra sola en el
// borrador atado: coste real por línea y precio de venta el del MOTOR, que solo
// sube si con él el margen no llega. El presupuesto SIGUE en borrador: lo envía
// Juan. Ver [[project_solicitud_presupuesto_una_sola]].

import { prisma } from "@/lib/prisma";
import { computeQuoteTotals, decimalToNumber } from "@/lib/quotes";
import { checkQuoteLinesMargin } from "@/lib/quote-margin";
import { priceBasisForMember } from "@/lib/lavori-directo";
import { channelPriceToBaseCents, clientCentsWithMotorPrice, spreadCents } from "@/lib/lavori-directo-math";

export type FillDraftResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      quoteId: string;
      quoteNumber: string;
      costEur: number;
      totalEur: number;
      subidas: number; // líneas cuyo precio hubo que subir sobre el del motor
      margenBajo: string | null; // margen insuficiente tras descuento/envío
    };

export async function fillDraftQuoteFromLeadPrice(leadId: string): Promise<FillDraftResult> {
  const lead = await prisma.lavoriPriceRequest.findUnique({ where: { id: leadId } });
  if (!lead) return { ok: false, reason: "solicitud no encontrada" };
  if (!lead.quoteId) return { ok: false, reason: "la solicitud no tiene presupuesto atado" };
  if (!lead.priceCents || lead.priceCents <= 0) return { ok: false, reason: "solicitud sin precio" };

  const quote = await prisma.quote.findUnique({
    where: { id: lead.quoteId },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      sourceLang: true,
      targetLang: true,
      discountType: true,
      discountValue: true,
      vatRate: true,
      deliveryType: true,
      shippingBase: true,
      deliveryTerm: true,
      lines: { orderBy: { createdAt: "asc" }, select: { id: true, description: true, quantity: true, unitPrice: true, supplierUnitCost: true, sourceFileUrl: true, pageStart: true, pageEnd: true } },
    },
  });
  if (!quote) return { ok: false, reason: "presupuesto atado no encontrado" };
  // Un presupuesto ya enviado NO se toca: su cifra está en manos del cliente y
  // cambiarla por detrás es el incidente que ya avisa "cifra cambiada tras envío".
  if (quote.status !== "DRAFT") return { ok: false, reason: `el presupuesto ${quote.quoteNumber} ya no es borrador (${quote.status})` };
  if (quote.lines.length === 0) return { ok: false, reason: "el borrador no tiene líneas" };
  // Con cantidades distintas de 1 el coste por unidad se redondea y ni la suma
  // cuadra con la cifra del jurado ni el suelo de 40 € es por documento: en ese
  // caso no se toca nada y lo reparte Juan.
  if (quote.lines.some((l) => decimalToNumber(l.quantity) !== 1)) {
    return { ok: false, reason: "el borrador tiene líneas con cantidad distinta de 1: repártelo tú" };
  }

  // Dos solicitudes atadas al mismo presupuesto (dos jurados, dos pares): la
  // segunda cifra borraría el coste de la primera. Que lo reparta Juan.
  const otras = await prisma.lavoriPriceRequest.count({
    where: { quoteId: quote.id, id: { not: lead.id }, priceCents: { not: null } },
  });
  if (otras > 0) return { ok: false, reason: "hay otra solicitud con precio atada a este presupuesto: repártelo tú" };

  const baseCents = channelPriceToBaseCents(lead.priceCents, priceBasisForMember(lead.miembroId));
  // Reparto proporcional al precio que el motor ya puso en cada línea (es la
  // mejor medida de volumen que tiene el borrador); a partes iguales si no hay.
  // Las líneas a 0 € (cortesía/incluido) quedan fuera del reparto y del reprecio:
  // ni cargan coste ni se les inventa un precio mínimo.
  const conPrecio = quote.lines.filter((l) => decimalToNumber(l.unitPrice) > 0);
  if (conPrecio.length === 0) return { ok: false, reason: "el borrador no tiene líneas con precio" };
  // Pesos: el coste que ya tiene cada línea (el del motor, o el del reparto
  // anterior si el jurado corrige su cifra); el precio de venta no vale porque
  // este mismo relleno lo reescribe.
  const costesPrevios = conPrecio.map((l) => Math.round(decimalToNumber(l.supplierUnitCost) * 100));
  const pesos = costesPrevios.some((c) => c > 0)
    ? costesPrevios
    : conPrecio.map((l) => Math.round(decimalToNumber(l.unitPrice) * 100));
  const costesRepartidos = spreadCents(baseCents, pesos);
  const costePorLinea = new Map(conPrecio.map((l, i) => [l.id, costesRepartidos[i]]));

  let subidas = 0;
  const lines = quote.lines.map((l) => {
    const motorCents = Math.round(decimalToNumber(l.unitPrice) * 100);
    const reparto = costePorLinea.get(l.id);
    // Línea excluida (0 €): ni coste nuevo ni precio nuevo, se queda como está.
    if (reparto == null) {
      return {
        description: l.description,
        quantity: 1,
        unitPrice: motorCents / 100,
        supplierUnitCost: decimalToNumber(l.supplierUnitCost),
      };
    }
    const clienteCents = clientCentsWithMotorPrice(motorCents, reparto);
    if (clienteCents > motorCents) subidas++;
    return {
      description: l.description,
      quantity: 1,
      unitPrice: clienteCents / 100,
      supplierUnitCost: reparto / 100,
      ...(l.sourceFileUrl ? { sourceFileUrl: l.sourceFileUrl } : {}),
      ...(l.pageStart != null ? { pageStart: l.pageStart } : {}),
      ...(l.pageEnd != null ? { pageEnd: l.pageEnd } : {}),
    };
  });

  const totals = computeQuoteTotals({
    lines,
    discountType: quote.discountType,
    discountValue: decimalToNumber(quote.discountValue),
    vatRate: decimalToNumber(quote.vatRate),
    deliveryType: quote.deliveryType,
    shippingBase: decimalToNumber(quote.shippingBase),
  });

  // Margen real DESPUÉS del descuento y el envío: un PERCENT del 15 % puede dejar
  // el margen por debajo del mínimo aunque línea a línea pareciera bien.
  const margen = checkQuoteLinesMargin({
    sourceLang: quote.sourceLang,
    targetLang: quote.targetLang,
    lines: lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, supplierUnitCost: l.supplierUnitCost })),
    discountCents: Math.round(totals.discountAmount * 100),
  });

  const guardado = await prisma.$transaction(async (tx) => {
    // El envío puede ganar la carrera: si el presupuesto dejó de ser borrador
    // entre la lectura y ahora, NO se reescriben precios bajo el PDF del cliente.
    const sigueBorrador = await tx.quote.updateMany({
      where: { id: quote.id, status: "DRAFT", sendingAt: null },
      data: { subtotal: totals.subtotal },
    });
    if (sigueBorrador.count === 0) return false;
    for (let i = 0; i < quote.lines.length; i++) {
      await tx.quoteLine.update({
        where: { id: quote.lines[i].id },
        data: { unitPrice: lines[i].unitPrice, supplierUnitCost: lines[i].supplierUnitCost, lineTotal: totals.lines[i].lineTotal },
      });
    }
    await tx.quote.update({
      where: { id: quote.id },
      data: {
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        shippingAmount: totals.shippingAmount,
        vatAmount: totals.vatAmount,
        total: totals.total,
        // El plazo del jurado manda si el borrador no traía uno.
        ...(lead.plazoDias && !quote.deliveryTerm ? { deliveryTerm: `${lead.plazoDias}-${lead.plazoDias + 1} días hábiles` } : {}),
      },
    });
    return true;
  });
  if (!guardado) return { ok: false, reason: `el presupuesto ${quote.quoteNumber} se estaba enviando: no se ha tocado` };

  return {
    ok: true,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    costEur: baseCents / 100,
    totalEur: totals.total,
    subidas,
    margenBajo: margen.ok ? null : margen.detail,
  };
}
