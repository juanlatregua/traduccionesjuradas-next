// lib/invoice-pdf-args.ts — Fuente única del mapeo ClientInvoice → generateInvoicePdf
// (compartido por la ruta /api/invoices/[id]/pdf y el paquete gestoría: un campo
// nuevo del PDF se añade UNA vez aquí). Server-only (lee el logo del filesystem).

import { promises as fs } from "fs";
import path from "path";
import { getBrand } from "@/lib/invoice-brands";
import type { ClientInvoice } from "@prisma/client";
import type { InvoiceLine } from "@/lib/client-invoice";

// Carga el logo de marca (PNG) como data URL si el archivo existe.
export async function loadBrandLogo(brandKey: string): Promise<string | undefined> {
  const brand = getBrand(brandKey);
  if (brand.logo.kind !== "image") return undefined;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), brand.logo.path));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined; // sin archivo → el PDF usa el wordmark de respaldo
  }
}

export function invoiceLinesOf(invoice: ClientInvoice): InvoiceLine[] | undefined {
  return Array.isArray(invoice.lineItemsJson) ? (invoice.lineItemsJson as unknown as InvoiceLine[]) : undefined;
}

export function clientInvoicePdfArgs(
  invoice: ClientInvoice & { order?: { reference: string } | null },
  logoDataUrl: string | undefined
) {
  const lines = invoiceLinesOf(invoice);
  return {
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
    docKind: invoice.docKind,
    draft: invoice.status !== "ISSUED",
    langPair: invoice.langPair,
    createdAt: invoice.createdAt,
    invoiceNumber: invoice.number || undefined,
    issuedAt: invoice.issuedAt,
    rectifiesNumber: invoice.rectifiesNumber,
    annulled: Boolean(invoice.annulledAt),
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
  };
}
