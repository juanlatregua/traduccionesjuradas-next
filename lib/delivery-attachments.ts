// lib/delivery-attachments.ts — Adjuntos del email de entrega al cliente.
// Adjunta la traducción terminada y, SOLO si ya se ha emitido (ISSUED), la
// factura. No crea facturas (respeta el proceso fiscal manual de Juan).

import { isOrderSecured } from "@/lib/credit-terms";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { clientInvoicePdfArgs, loadBrandLogo } from "@/lib/invoice-pdf-args";
import { verifactuPdfExtras } from "@/lib/verifactu/pdf";
import { getOrderDetail } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import type { MailAttachment } from "@/lib/azure-mail";

const MAX_ATTACH_BYTES = 15 * 1024 * 1024; // límite prudente para email

// Descarga un fichero (blob público) y lo devuelve como adjunto base64.
export async function fetchFileAsAttachment(
  url: string,
  name: string
): Promise<MailAttachment | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_ATTACH_BYTES) return null;
    const ct = (res.headers.get("content-type") || "application/octet-stream").split(";")[0];
    return { name, contentType: ct, contentBytes: buf.toString("base64") };
  } catch (e) {
    console.error("[delivery-attach] fetch file", e);
    return null;
  }
}

// Factura como adjunto SOLO si ya está emitida (ClientInvoice ISSUED con número).
// null si no se ha generado → no se adjunta nada.
export async function buildIssuedInvoiceAttachment(
  reference: string
): Promise<MailAttachment | null> {
  try {
    const order = await getOrderDetail(reference);
    if (!order || !isOrderSecured(order) || !order.billing?.requested) return null;

    // Factura AGRUPADA del mes: se adjunta solo si ya está emitida (a fin de
    // mes); mientras es borrador el email de entrega va sin factura.
    if (order.monthlyInvoiceId) {
      const monthly = await prisma.clientInvoice.findUnique({ where: { id: order.monthlyInvoiceId } });
      if (!monthly || monthly.status !== "ISSUED" || !monthly.number) return null;
      const pdf = generateInvoicePdf({ ...clientInvoicePdfArgs(monthly, await loadBrandLogo(monthly.brand)), verifactu: await verifactuPdfExtras(monthly.id) });
      return { name: `${monthly.number}.pdf`, contentType: "application/pdf", contentBytes: Buffer.from(pdf).toString("base64") };
    }

    const invoice = await prisma.clientInvoice.findUnique({ where: { orderId: order.id } });
    if (!invoice || invoice.status !== "ISSUED" || !invoice.number) return null;

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

    const billing = {
      fiscalName: order.billing.fiscalName,
      nif: order.billing.nif,
      address: order.billing.address,
      city: order.billing.city,
      postalCode: order.billing.postalCode,
      country: order.billing.country,
      email: order.billing.email,
    };

    const pdf = generateInvoicePdf({
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      langPair: order.langPair,
      words: order.words,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      invoiceNumber: invoice.number,
      issuedAt: invoice.issuedAt,
      lines: lines.length > 0 ? lines : undefined,
      billing,
    });

    return {
      name: `${invoice.number}.pdf`,
      contentType: "application/pdf",
      contentBytes: Buffer.from(pdf).toString("base64"),
    };
  } catch (e) {
    console.error("[delivery-attach] invoice", e);
    return null;
  }
}
