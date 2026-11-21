import { PAGE_TARIFF_MARK } from "@/lib/pricing-engine/page-pricing";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { computeQuoteTotals, calculateValidUntil, PAPER_SHIPPING_BASE_EUR } from "@/lib/quotes";
import { parseUpdateQuoteInput } from "@/lib/quote-validators";
import { serializeQuote } from "@/lib/quote-serializer";
import { sealClosedPriceQuote } from "@/lib/lavori-directo";
import { unsealOnLineEdit } from "@/lib/encargo-cerrado-math";
import { checkQuoteLinesMargin, notifyMarginOverride, MARGIN_BLOCK_CODE } from "@/lib/quote-margin";
import { abs, hrefPresupuesto } from "@/lib/staff-links";
import { lockedRecheck, patchPrecheck, QUOTE_VERSION_SELECT } from "@/lib/quote-edit-hydrate";
import { quoteContentVersion } from "@/lib/quote-content-version";

class LockedRecheckError extends Error {
  constructor(public readonly result: NonNullable<ReturnType<typeof lockedRecheck>>) {
    super(result.body.error);
  }
}

export const runtime = "nodejs";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      lines: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      messageLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      accessEvents: { orderBy: { at: "desc" }, take: 30 },
      orders: { select: { reference: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, quote: serializeQuote(quote) });
}

export async function PATCH(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = parseUpdateQuoteInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const current = await prisma.quote.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        status: true,
        issuedAt: true,
        autoPricedBy: true,
        paymentFrozenAt: true,
        ...QUOTE_VERSION_SELECT,
      },
    });
    if (!current) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }

    const totals = computeQuoteTotals({
      lines: parsed.data.lines,
      discountType: parsed.data.discountType,
      discountValue: parsed.data.discountValue,
      vatRate: parsed.data.vatRate,
      deliveryType: parsed.data.deliveryType,
      shippingBase:
        parsed.data.deliveryType === "PAPER_SHIP"
          ? parsed.data.shippingBase || PAPER_SHIPPING_BASE_EUR
          : 0,
    });

    // Estado editable; obsoleto (expectedVersion ≠ versión de contenido: p. ej. la cifra del
    // jurado entró en las líneas después de abrir la página; abrir /q o descongelar no cuenta)
    // → 409 «stale»; pago CONGELADO: líneas e importe solo desde la reparación con la cifra
    // del jurado (frozenRepair). Sin escribir nada.
    const expectedVersion = (body as any)?.expectedVersion;
    const pre = patchPrecheck({
      status: current.status,
      version: quoteContentVersion(current),
      expectedVersion,
      frozen: !!current.paymentFrozenAt,
      frozenRepair: (body as any)?.frozenRepair === true,
      current: { lines: current.lines, total: current.total },
      next: { lines: totals.lines, total: totals.total },
    });
    if (pre) return NextResponse.json(pre.body, { status: pre.status });

    const validUntil = calculateValidUntil(current.issuedAt, parsed.data.validityDays);

    // FRENO DE MARGEN también al EDITAR: bajar el precio de un presupuesto ya
    // enviado por debajo del coste guardado cobraría el total nuevo en Stripe
    // sin que saltara nada (hallazgo auditoría 31-ago).
    const marginCheck = checkQuoteLinesMargin({
      sourceLang: parsed.data.sourceLang,
      targetLang: parsed.data.targetLang,
      discountCents: Math.round(Number(totals.discountAmount || 0) * 100),
      lines: parsed.data.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        supplierUnitCost: l.supplierUnitCost ?? null,
      })),
    });
    const overrideLowMargin = !!(body as any)?.overrideLowMargin;
    // Un DRAFT se guarda siempre: nada ha salido al cliente y el envío (quote-send) vuelve a frenar.
    if (!marginCheck.ok && !overrideLowMargin && current.status !== "DRAFT") {
      return NextResponse.json(
        { ok: false, code: MARGIN_BLOCK_CODE, error: `${MARGIN_BLOCK_CODE}: ${marginCheck.detail}` },
        { status: 409 }
      );
    }

    const quote = await prisma.$transaction(async (tx) => {
      // Bajo candado de fila: el estado sigue siendo editable (un pago entre la lectura y aquí
      // → 400) y, con versión, nadie ha cambiado el contenido (los rellenos de la cifra del
      // jurado actualizan la fila Quote en su transacción).
      await tx.$queryRaw`SELECT id FROM "Quote" WHERE id = ${params.id} FOR UPDATE`;
      const locked = await tx.quote.findUnique({ where: { id: params.id }, select: { status: true, ...QUOTE_VERSION_SELECT } });
      if (!locked) throw new LockedRecheckError({ status: 400, body: { ok: false, error: "Presupuesto no encontrado." } });
      const again = lockedRecheck({ status: locked.status, version: quoteContentVersion(locked), expectedVersion });
      if (again) throw new LockedRecheckError(again);
      const customer = await tx.customer.upsert({
        where: { email: parsed.data.customerEmail },
        update: {
          name: parsed.data.customerName,
          phone: parsed.data.customerPhone || undefined,
        },
        create: {
          name: parsed.data.customerName,
          email: parsed.data.customerEmail,
          phone: parsed.data.customerPhone,
        },
      });

      await tx.quoteLine.deleteMany({
        where: { quoteId: params.id },
      });

      const updated = await tx.quote.update({
        where: { id: params.id },
        data: {
          customerId: customer.id,
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail,
          customerPhone: parsed.data.customerPhone,
          sourceLang: parsed.data.sourceLang,
          targetLang: parsed.data.targetLang,
          deliveryType: parsed.data.deliveryType,
          shippingBase:
            parsed.data.deliveryType === "PAPER_SHIP"
              ? parsed.data.shippingBase || PAPER_SHIPPING_BASE_EUR
              : 0,
          vatRate: totals.vatRate,
          discountType: parsed.data.discountType,
          discountValue: parsed.data.discountValue,
          notesLegal: parsed.data.notesLegal,
          deliveryTerm: parsed.data.deliveryTerm,
          holderNames: parsed.data.holderNames,
          // Editar líneas invalida la marca de tarifa por página: hay que volver a
          // verificar la procedencia del coste (canal o override) antes de enviar.
          ...(current.autoPricedBy === PAGE_TARIFF_MARK ? { autoPricedBy: null } : {}),
          // Encargo cerrado: con las líneas cambiadas el coste ya no es el de la regla → sin sello ni jurado.
          ...(unsealOnLineEdit(current.autoPricedBy, current.lines, totals.lines) ?? {}),
          marginPct: parsed.data.marginPct,
          paymentMethods: parsed.data.paymentMethods,
          contactWhatsapp: parsed.data.contactWhatsapp,
          pdfLang: parsed.data.pdfLang,
          validityDays: parsed.data.validityDays,
          validUntil,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          shippingAmount: totals.shippingAmount,
          vatAmount: totals.vatAmount,
          total: totals.total,
          lines: {
            create: totals.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
              supplierUnitCost: line.supplierUnitCost,
              sourceFileUrl: line.sourceFileUrl,
              pageStart: line.pageStart,
              pageEnd: line.pageEnd,
              docKind: line.docKind,
            })),
          },
        },
        include: {
          customer: true,
          lines: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { createdAt: "desc" } },
          messageLogs: { orderBy: { createdAt: "desc" }, take: 50 },
          accessEvents: { orderBy: { at: "desc" }, take: 30 },
          orders: { select: { reference: true }, orderBy: { createdAt: "desc" } },
        },
      });

      return updated;
    });

    await sealClosedPriceQuote(params.id).catch((err) => console.error("[quotes:update] sellado NL/PT/DE fallo:", err));

    // En DRAFT no se avisa (nada ha salido al cliente; el freno de envio volvera a
    // saltar). En SENT/OPENED/ACCEPTED si: el enlace /q vivo cobra el total nuevo.
    if (!marginCheck.ok && overrideLowMargin && current.status !== "DRAFT") {
      await notifyMarginOverride({
        kind: "presupuesto",
        action: "guardado",
        quoteId: params.id,
        label: (quote as any).quoteNumber || params.id,
        actorEmail: access.email,
        detail: marginCheck.detail,
        url: abs(hrefPresupuesto(params.id)),
      });
    }
    // Versión tras el sellado: el token de la siguiente edición no debe chocar con lo que
    // este mismo guardado escribió.
    const fresh = await prisma.quote.findUnique({ where: { id: params.id }, select: QUOTE_VERSION_SELECT }).catch(() => null);
    return NextResponse.json({ ok: true, quote: serializeQuote(quote), contentVersion: fresh ? quoteContentVersion(fresh) : null });
  } catch (err: any) {
    if (err instanceof LockedRecheckError) {
      return NextResponse.json(err.result.body, { status: err.result.status });
    }
    console.error("[quotes:update] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo actualizar el presupuesto." },
      { status: 500 }
    );
  }
}
