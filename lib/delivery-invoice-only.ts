// Envío de SOLO la factura (panel «Entregar al cliente» sin archivos marcados).
// No toca el estado de entrega, ni el workflow, ni manda SMS: solo el email con la
// factura adjunta y su rastro. Las dependencias se inyectan para poder probarlo.

import { buildInvoiceOnlyText, invoiceOnlySubject, resolveInvoicePlaceholder, type DeliveryLang } from "./delivery-message.ts";

export type InvoiceOnlyDeps<A> = {
  prepare: () => Promise<{ warning?: string }>;
  attach: () => Promise<(A & { name: string }) | null>;
  record: (e: { subject: string; text: string; invoiceNumber: string }) => Promise<void>;
  send: (e: { subject: string; text: string; invoiceNumber: string; attachment: A }) => void;
};

export async function runInvoiceOnly<A>(
  deps: InvoiceOnlyDeps<A>,
  input: {
    reference: string;
    lang: DeliveryLang;
    clientName: string | null;
    reviewUrl: string;
    message?: string | null;
    subject?: string | null;
  }
): Promise<{ ok: true; invoiceNumber: string; warnings: string[] } | { ok: false; error: string }> {
  const warnings: string[] = [];
  try {
    const prepared = await deps.prepare();
    if (prepared.warning) warnings.push(prepared.warning);
  } catch (err: any) {
    warnings.push(`No se pudo preparar la factura (${err?.message || "error"}).`);
  }
  const attachment = await deps.attach();
  if (!attachment) {
    return { ok: false, error: `No hay factura que enviar. ${warnings.join(" ")}`.trim() };
  }
  const invoiceNumber = attachment.name.replace(/\.pdf$/i, "");
  const text =
    resolveInvoicePlaceholder((input.message || "").trim(), invoiceNumber).trim() ||
    buildInvoiceOnlyText({
      lang: input.lang,
      name: input.clientName,
      reference: input.reference,
      invoiceNumber,
      reviewUrl: input.reviewUrl,
    });
  const subject =
    resolveInvoicePlaceholder((input.subject || "").trim(), invoiceNumber).trim() ||
    invoiceOnlySubject(input.lang, input.reference, invoiceNumber);
  await deps.record({ subject, text, invoiceNumber });
  deps.send({ subject, text, invoiceNumber, attachment });
  return { ok: true, invoiceNumber, warnings };
}
