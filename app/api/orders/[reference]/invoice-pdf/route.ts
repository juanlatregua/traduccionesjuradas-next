import { NextResponse } from "next/server";
import { isOrderSecured } from "@/lib/credit-terms";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { verifactuPdfExtras } from "@/lib/verifactu/pdf";
import { getOrCreateClientInvoice } from "@/lib/client-invoice";
import { sendInvoiceAutoIssuedStaffEmail, sendInvoicePendingManualStaffEmail } from "@/lib/email";
import { requireStaffAccess } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function GET(req: Request, { params }: Params) {
  // El staff (zona) puede ver/descargar cualquier factura; el cliente solo la suya.
  const staff = await requireStaffAccess(req);
  let scopedEmail: string | undefined;
  if (!staff.ok) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
    }
    scopedEmail = session.user.email;
  }

  try {
    const order = await getOrderDetail(params.reference, scopedEmail);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    if (!order.billing || !order.billing.requested) {
      return NextResponse.json(
        { ok: false, error: "No se han solicitado datos de facturacion para este pedido." },
        { status: 400 }
      );
    }

    // Crédito: la factura ya está emitida con vencimiento, y es justo lo que el
    // cliente necesita para pagarla. "Asegurado" vale como "pagado" aquí.
    if (!isOrderSecured(order)) {
      return NextResponse.json(
        { ok: false, error: "La factura solo esta disponible para pedidos pagados o autorizados a credito." },
        { status: 400 }
      );
    }

    // Emite (o recupera) la factura con numeración fiscal secuencial persistida.
    const billing = {
      fiscalName: order.billing.fiscalName,
      nif: order.billing.nif,
      address: order.billing.address,
      city: order.billing.city,
      postalCode: order.billing.postalCode,
      country: order.billing.country,
      email: order.billing.email,
    };
    // Excluido de facturación (p. ej. Bizum, regla 21-ago-2026): no se crea
    // factura al vuelo; si ya existe emitida se sirve igual.
    const excl = await prisma.order.findUnique({
      where: { id: order.id },
      select: { billingExcluded: true, clientInvoice: { select: { status: true } } },
    });
    if (excl?.billingExcluded && excl.clientInvoice?.status !== "ISSUED") {
      return NextResponse.json(
        { ok: false, error: "Pedido excluido de facturación: no hay factura que emitir." },
        { status: 409 }
      );
    }
    const { invoice, created, quotePending } = await getOrCreateClientInvoice({
      orderId: order.id,
      amountCents: order.amountCents,
      billing,
    });

    // Auto-emisión (lazy_pdf): avisar al staff sin bloquear la descarga del PDF.
    if (created) {
      sendInvoiceAutoIssuedStaffEmail({
        number: invoice.number || "(sin número)",
        reference: order.reference,
        totalCents: invoice.totalCents,
        clientEmail: billing.email,
      }).catch(console.error);
    }
    // Presupuesto vinculado: el cliente recibe la PROFORMA y el staff emite a mano
    // (el régimen de IVA del presupuesto puede no ser 21%; no se convierte solo).
    if (quotePending) {
      sendInvoicePendingManualStaffEmail({
        quoteNumber: invoice.number || "(borrador)",
        reference: order.reference,
        totalCents: invoice.totalCents,
        clientEmail: billing.email,
      }).catch(console.error);
    }

    // Líneas del expediente, si las hay (precio sin IVA por documento).
    const items = await prisma.orderDocumentItem.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    const lines = items
      .filter((it) => it.quotedCents != null && it.quotedCents > 0)
      .map((it) => {
        const dir = it.sourceLang && it.targetLang ? `${it.sourceLang}-${it.targetLang}` : "";
        const meta = [it.words ? `${it.words} palabras` : "", dir].filter(Boolean).join(" · ");
        return {
          description: it.documentType || it.fileName,
          detail: meta || undefined,
          amountCents: Math.round((it.quotedCents as number) / 1.21),
        };
      });

    const pdfBuffer = generateInvoicePdf({
      verifactu: await verifactuPdfExtras(invoice.id),
      rectifiesNumber: invoice.rectifiesNumber,
      annulled: Boolean(invoice.annulledAt),
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      langPair: order.langPair,
      words: order.words,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      invoiceNumber: quotePending ? undefined : (invoice.number ?? undefined),
      issuedAt: invoice.issuedAt,
      lines: lines.length > 0 ? lines : undefined,
      billing,
      draft: quotePending || undefined,
    });

    const filename = quotePending ? `proforma-${order.reference}.pdf` : `${invoice.number}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("[invoice-pdf] error", err);
    return NextResponse.json({ ok: false, error: "Error al generar factura." }, { status: 500 });
  }
}
