import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  calculateValidUntil,
  computeQuoteTotals,
  generateQuoteNumber,
  generateQuoteToken,
  PAPER_SHIPPING_BASE_EUR,
} from "@/lib/quotes";
import { parseCreateQuoteInput } from "@/lib/quote-validators";
import { serializeQuote } from "@/lib/quote-serializer";

export const runtime = "nodejs";

async function generateUniqueQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const baseCount = await prisma.quote.count({
    where: {
      quoteNumber: {
        startsWith: prefix,
      },
    },
  });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = await generateQuoteNumber(baseCount + attempt + 1, new Date());
    const exists = await prisma.quote.findUnique({
      where: { quoteNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new Error("No se pudo generar número de presupuesto único.");
}

async function generateUniquePublicToken() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const token = generateQuoteToken(28);
    const exists = await prisma.quote.findUnique({
      where: { publicToken: token },
      select: { id: true },
    });
    if (!exists) return token;
  }
  throw new Error("No se pudo generar token público único.");
}

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `quotes:create:${access.email}:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas operaciones de alta. Inténtalo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = await req.json();
    const parsed = parseCreateQuoteInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const issuedAt = new Date();
    const validUntil = calculateValidUntil(issuedAt, parsed.data.validityDays);
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

    const [quoteNumber, publicToken] = await Promise.all([
      generateUniqueQuoteNumber(),
      generateUniquePublicToken(),
    ]);

    const created = await prisma.$transaction(async (tx) => {
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

      const quote = await tx.quote.create({
        data: {
          quoteNumber,
          status: "DRAFT",
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
          issuedAt,
          validUntil,
          publicToken,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          shippingAmount: totals.shippingAmount,
          vatAmount: totals.vatAmount,
          total: totals.total,
          adminCreatedBy: access.email,
          lines: {
            create: totals.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
        include: {
          customer: true,
          lines: true,
        },
      });

      return quote;
    });

    return NextResponse.json({ ok: true, quote: serializeQuote(created) });
  } catch (err: any) {
    console.error("[quotes:create] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo crear el presupuesto." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = String(url.searchParams.get("status") || "").toUpperCase();
  const allowedStatuses = [
    "DRAFT",
    "SENT",
    "OPENED",
    "ACCEPTED",
    "PAID",
    "IN_PROGRESS",
    "DELIVERED",
    "EXPIRED",
  ] as const;
  const where =
    status && status !== "ALL" && allowedStatuses.includes(status as any)
      ? ({
          status: status as (typeof allowedStatuses)[number],
        } as const)
      : undefined;

  const rows = await prisma.quote.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 120,
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
      messageLogs: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return NextResponse.json({
    ok: true,
    quotes: rows.map((row) => serializeQuote(row)),
  });
}
