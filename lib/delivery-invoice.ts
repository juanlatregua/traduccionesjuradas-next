// lib/delivery-invoice.ts — Factura en el momento de entregar (panel «Entregar al cliente»).
// Guarda los datos fiscales revisados y deja la factura lista para adjuntarla:
// emite si no existe, corrige solo el destinatario de una emitida que aún no
// salió, y nunca toca importes ni tipo.

import { prisma } from "@/lib/prisma";
import { issueOrUpdateInvoice } from "@/lib/client-invoice";
import { logInvoiceEvent } from "@/lib/verifactu/records";
import {
  invoiceWasSent,
  isSimplifiedInvoice,
  recipientDiffers,
  type BillingFields,
} from "@/lib/delivery-billing";

export function normalizeBillingInput(raw: unknown, fallbackEmail: string): BillingFields {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const v = (k: string) => String(b[k] ?? "").trim();
  return {
    fiscalName: v("fiscalName"),
    nif: v("nif"),
    address: v("address"),
    city: v("city"),
    postalCode: v("postalCode"),
    country: v("country") || "España",
    email: v("email") || fallbackEmail,
  };
}

export async function prepareDeliveryInvoice(input: {
  orderId: string;
  amountCents: number;
  billingExcluded: boolean;
  monthlyInvoiceId: string | null;
  billing: BillingFields;
  actorEmail: string;
}): Promise<{ warning?: string }> {
  const { orderId, billing } = input;
  if (!billing.fiscalName) return { warning: "Falta el nombre fiscal: se ha enviado sin factura." };

  const noInvoice = input.billingExcluded || !!input.monthlyInvoiceId;
  await prisma.billingData.upsert({
    where: { orderId },
    create: { orderId, requested: !noInvoice, ...billing },
    update: { ...billing, ...(noInvoice ? {} : { requested: true }) },
  });
  if (noInvoice) return {};

  const existing = await prisma.clientInvoice.findUnique({ where: { orderId } });
  if (existing?.docKind === "quote") {
    return { warning: "Hay un presupuesto vinculado: se ha enviado sin factura. Emítela desde Facturas." };
  }

  if (!existing || existing.status !== "ISSUED") {
    await issueOrUpdateInvoice({
      orderId,
      amountCents: input.amountCents,
      billing,
      origin: "delivery_panel",
      simplified: isSimplifiedInvoice(billing.nif, input.amountCents),
    });
    return {};
  }

  if (!recipientDiffers(existing, billing)) return {};

  const events = await prisma.orderEvent.findMany({
    where: { orderId, type: { in: ["notification.delivery_ready.sent", "notification.custom.sent"] } },
    select: { type: true, createdAt: true },
  });
  if (invoiceWasSent(events, existing.issuedAt)) {
    return {
      warning: `La factura ${existing.number} ya se envió al cliente con otros datos: no se ha modificado. Si hay que corregirla, rectifícala en Facturas.`,
    };
  }

  const data = {
    fiscalName: billing.fiscalName,
    nif: billing.nif,
    address: billing.address,
    city: billing.city,
    postalCode: billing.postalCode,
    country: billing.country,
  };
  await prisma.clientInvoice.update({ where: { id: existing.id }, data });
  await logInvoiceEvent(prisma, {
    invoiceId: existing.id,
    type: "invoice.recipient_corrected",
    actor: input.actorEmail,
    message: `Destinatario de ${existing.number} corregido antes de enviarla al cliente.`,
    payload: {
      before: {
        fiscalName: existing.fiscalName,
        nif: existing.nif,
        address: existing.address,
        city: existing.city,
        postalCode: existing.postalCode,
        country: existing.country,
      },
      after: data,
    },
  });
  return {};
}
