import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { decimalToNumber } from "@/lib/quotes";
import { buildQuotePdfBuffer } from "@/lib/quote-pdf";

export const runtime = "nodejs";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return new NextResponse("Acceso denegado", { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!quote) {
    return new NextResponse("Presupuesto no encontrado", { status: 404 });
  }

  const baseUrl = (process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net").replace(/\/$/, "");
  const payUrl = `${baseUrl}/q/${quote.publicToken}`;
  const buffer = buildQuotePdfBuffer({
    quoteNumber: quote.quoteNumber,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    sourceLang: quote.sourceLang,
    targetLang: quote.targetLang,
    deliveryType: quote.deliveryType,
    issuedAt: quote.issuedAt,
    validUntil: quote.validUntil,
    subtotal: decimalToNumber(quote.subtotal),
    discountAmount: decimalToNumber(quote.discountAmount),
    shippingAmount: decimalToNumber(quote.shippingAmount),
    vatRate: decimalToNumber(quote.vatRate),
    vatAmount: decimalToNumber(quote.vatAmount),
    total: decimalToNumber(quote.total),
    payUrl,
    lines: quote.lines.map((line) => ({
      description: line.description,
      quantity: decimalToNumber(line.quantity),
      unitPrice: decimalToNumber(line.unitPrice),
      lineTotal: decimalToNumber(line.lineTotal),
    })),
    isDraft: true,
    notesLegal: quote.notesLegal,
  });

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="preview-${quote.quoteNumber}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
