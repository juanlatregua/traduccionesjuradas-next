// app/api/invoices/[id]/pdf/route.ts
// STAFF: PDF de una factura por id. Borrador → marca de agua PROFORMA.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { verifactuPdfExtras } from "@/lib/verifactu/pdf";
import { loadBrandLogo, clientInvoicePdfArgs } from "@/lib/invoice-pdf-args";

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

  const logoDataUrl = await loadBrandLogo(invoice.brand);

  try {
    const pdfBuffer = generateInvoicePdf({ ...clientInvoicePdfArgs(invoice, logoDataUrl), verifactu: await verifactuPdfExtras(invoice.id) });

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
