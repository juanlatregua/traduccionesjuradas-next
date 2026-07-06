// app/api/invoices/[id]/pdf/route.ts
// STAFF: PDF de una factura por id. Borrador → marca de agua PROFORMA.

import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { getBrand } from "@/lib/invoice-brands";
import type { InvoiceLine } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// Carga el logo de marca (PNG) como data URL si el archivo existe.
async function loadBrandLogo(brandKey: string): Promise<string | undefined> {
  const brand = getBrand(brandKey);
  if (brand.logo.kind !== "image") return undefined;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), brand.logo.path));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined; // sin archivo → el PDF usa el wordmark de respaldo
  }
}

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

  const logoDataUrl = await loadBrandLogo(invoice.brand);

  try {
    const pdfBuffer = generateInvoicePdf({
      reference: invoice.order?.reference,
      title: invoice.concept || lines?.[0]?.description || "Traducción jurada",
      amountCents: invoice.totalCents,
      baseCents: invoice.baseCents,
      vatCents: invoice.vatCents,
      vatRate: invoice.vatRate,
      brand: invoice.brand,
      logoDataUrl,
      poNumber: invoice.poNumber,
      holderNames: invoice.holderNames,
      simplified: invoice.simplified,
      draft: invoice.status !== "ISSUED",
      langPair: invoice.langPair,
      createdAt: invoice.createdAt,
      invoiceNumber: invoice.number || undefined,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
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
