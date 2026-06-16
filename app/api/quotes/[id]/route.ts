import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { computeQuoteTotals, calculateValidUntil, PAPER_SHIPPING_BASE_EUR } from "@/lib/quotes";
import { parseUpdateQuoteInput } from "@/lib/quote-validators";
import { serializeQuote } from "@/lib/quote-serializer";

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
      },
    });
    if (!current) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }

    if (!["DRAFT", "SENT", "OPENED", "ACCEPTED"].includes(current.status)) {
      return NextResponse.json(
        { ok: false, error: `No se puede editar en estado ${current.status}.` },
        { status: 400 }
      );
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

    const validUntil = calculateValidUntil(current.issuedAt, parsed.data.validityDays);

    const quote = await prisma.$transaction(async (tx) => {
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
            })),
          },
        },
        include: {
          customer: true,
          lines: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { createdAt: "desc" } },
          messageLogs: { orderBy: { createdAt: "desc" }, take: 50 },
          accessEvents: { orderBy: { at: "desc" }, take: 30 },
        },
      });

      return updated;
    });

    return NextResponse.json({ ok: true, quote: serializeQuote(quote) });
  } catch (err: any) {
    console.error("[quotes:update] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo actualizar el presupuesto." },
      { status: 500 }
    );
  }
}
