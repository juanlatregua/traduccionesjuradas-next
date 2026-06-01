// app/api/invoices/[id]/pdf/route.ts
// STAFF: PDF de una factura por id. Borrador → marca de agua PROFORMA.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import type { InvoiceLine } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function GET(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: params.id },
    include: { order: { select: { reference: true } } },
  });
  if (!invoice) return NextResponse.json({ ok: false, error: "Factura no encontrada." }, { status: 404 });

  const lines = Array.isArray(invoice.lineItemsJson)
    ? (invoice.lineItemsJson as unknown as InvoiceLine[])
    : undefined;

  try {
    const pdfBuffer = generateInvoicePdf({
      reference: invoice.order?.reference,
      title: invoice.concept || lines?.[0]?.description || "Traducción jurada",
      amountCents: invoice.totalCents,
      baseCents: invoice.baseCents,
      vatCents: invoice.vatCents,
      vatRate: invoice.vatRate,
      draft: invoice.status !== "ISSUED",
      langPair: invoice.langPair,
      createdAt: invoice.createdAt,
      invoiceNumber: invoice.number || undefined,
      issuedAt: invoice.issuedAt,
      lines: lines && lines.length > 0 ? lines : undefined,
      billing: {
        fiscalName: invoice.fiscalName,
        nif: invoice.nif || "",
        address: invoice.address || "",
        city: invoice.city || "",
        postalCode: invoice.postalCode || "",
        country: invoice.country || "España",
        email: invoice.email || "",
      },
    });

    const filename = `${invoice.number || `borrador-${invoice.id.slice(0, 8)}`}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("[invoice-pdf-by-id] error", err);
    return NextResponse.json({ ok: false, error: "Error al generar el PDF." }, { status: 500 });
  }
}
