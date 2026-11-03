// lib/delivery-invoice.ts — Factura en el momento de entregar (panel «Entregar al cliente»).
// Guarda los datos fiscales revisados y deja la factura lista para adjuntarla:
// emite si no existe, corrige solo el destinatario de una emitida que aún no
// salió, y nunca toca importes ni tipo.

import { prisma } from "@/lib/prisma";
import { issueOrUpdateInvoice } from "@/lib/client-invoice";
import { logInvoiceEvent } from "@/lib/verifactu/records";
import { assertNotInClosedPeriod } from "@/lib/tax-close-store";
import { buildSignedOrderUrl } from "@/lib/order-token";
import { isOrderSecured } from "@/lib/credit-terms";
import { runInvoiceOnly } from "@/lib/delivery-invoice-only";
import { buildIssuedInvoiceAttachment } from "@/lib/delivery-attachments";
import { composeInvoiceOnlyEmail, sendInvoiceOnlyEmail } from "@/lib/email";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { getReviewUrl, greetingName, toDeliveryLang } from "@/lib/delivery-message";
import {
  ANONYMOUS_CLIENT_NAME,
  billingDataMissing,
  NIF_REQUIRED_MESSAGE,
  decideInvoiceAction,
  needsNif,
  invoiceWasSent,
  isSimplifiedInvoice,
  recipientDiffers,
  recipientLockReasonOf,
  recordNeedsFixOf,
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

type Existing = NonNullable<Awaited<ReturnType<typeof prisma.clientInvoice.findUnique>>>;

async function recipientLockReason(inv: Existing, orderId: string): Promise<string | null> {
  let periodClosed = false;
  if (inv.issuedAt) {
    try {
      await assertNotInClosedPeriod(inv.issuedAt);
    } catch {
      periodClosed = true;
    }
  }
  const [rectification, record, events] = await Promise.all([
    prisma.clientInvoice.findFirst({ where: { rectifiesId: inv.id }, select: { id: true } }),
    prisma.invoiceRecord.findFirst({ where: { invoiceId: inv.id, kind: "ALTA" }, orderBy: { chainIndex: "desc" }, select: { id: true, sendStatus: true } }),
    prisma.orderEvent.findMany({
      where: { orderId, type: { startsWith: "notification." } },
      select: { type: true, createdAt: true },
    }),
  ]);
  const buildErrors = record?.sendStatus === "PENDING" ? await prisma.invoiceEvent.count({ where: { invoiceId: inv.id, type: "record.build_error", payload: { path: ["recordId"], equals: record.id } } }) : 0;
  return recipientLockReasonOf({
    recordNeedsFix: recordNeedsFixOf(record?.sendStatus, buildErrors),
    annulled: !!inv.annulledAt,
    issuedAt: inv.issuedAt,
    hasRectification: !!rectification,
    periodClosed,
    recordSendStatus: record?.sendStatus,
    sentToClient: invoiceWasSent(events, inv.issuedAt),
  });
}

export async function prepareDeliveryInvoice(input: {
  orderId: string;
  amountCents: number;
  billingExcluded: boolean;
  paymentMethod?: string | null;
  monthlyInvoiceId: string | null;
  billing: BillingFields;
  actorEmail: string;
}): Promise<{ warning?: string }> {
  const { orderId } = input;
  // Una simplificada sin nombre sale a nombre de «Cliente» (como las anteriores).
  const billing = {
    ...input.billing,
    fiscalName:
      input.billing.fiscalName ||
      (isSimplifiedInvoice(input.billing.nif, input.amountCents) ? ANONYMOUS_CLIENT_NAME : ""),
  };
  if (!billing.fiscalName) return { warning: "Falta el nombre fiscal: se ha enviado sin factura." };

  const noInvoice = input.billingExcluded || !!input.monthlyInvoiceId;
  await prisma.billingData.upsert({
    where: { orderId },
    create: { orderId, requested: !noInvoice, ...billing },
    update: { ...billing, ...(noInvoice ? {} : { requested: true }) },
  });
  if (noInvoice) return {};

  const existing = await prisma.clientInvoice.findUnique({ where: { orderId } });
  const action = decideInvoiceAction({ existing, amountCents: input.amountCents, paymentMethod: input.paymentMethod });
  switch (action) {
    case "quote":
      return { warning: "Hay un presupuesto vinculado: se ha enviado sin factura. Emítela desde Facturas." };
    case "zero":
      return { warning: "El pedido es de 0 €: se ha enviado sin factura." };
    case "bizum":
      return { warning: "Pedido pagado por Bizum: no se emite factura automática. Se ha enviado sin ella." };
    case "annulled":
      return { warning: `La factura ${existing?.number || ""} está anulada: se ha enviado sin factura.` };
    case "draft":
      return { warning: "Hay un borrador en Facturas: emítelo allí. Se ha enviado sin factura." };
    case "issue":
      if (needsNif(billing.nif, input.amountCents)) return { warning: `${NIF_REQUIRED_MESSAGE}. Se ha enviado sin factura.` };
      await issueOrUpdateInvoice({
        orderId,
        amountCents: input.amountCents,
        billing,
        origin: "delivery_panel",
        simplified: isSimplifiedInvoice(billing.nif, input.amountCents),
      });
      return {};
  }
  if (!existing) return {};

  if (!recipientDiffers(existing, billing)) return {};

  const lock = await recipientLockReason(existing, orderId);
  if (lock) {
    return {
      warning: `La factura ${existing.number} ${lock}: no se ha modificado su destinatario. Si hay que corregirla, rectifícala en Facturas.`,
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

// Entrega sin factura porque faltan documento o dirección (más de 400 €): enlace
// al formulario de facturación del área de cliente para pedirlos en el mismo email.
export async function billingRequestUrlFor(orderId: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { reference: true, amountCents: true, billingExcluded: true, monthlyInvoiceId: true, paymentMethod: true, billing: true, clientInvoice: true },
  });
  if (!order || order.billingExcluded || order.monthlyInvoiceId) return null;
  if (decideInvoiceAction({ existing: order.clientInvoice, amountCents: order.amountCents, paymentMethod: order.paymentMethod }) !== "issue") return null;
  if (!billingDataMissing(order.billing?.nif, order.billing?.address, order.amountCents)) return null;
  return buildSignedOrderUrl(order.reference, "detalle");
}

// El cliente completa los datos que pidió el email de entrega: se emite la factura
// y se le envía sola. Solo si esa entrega los pidió y la factura no ha salido aún.
export async function sendInvoiceAfterClientBilling(orderId: string, actorEmail: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { billing: true, clientInvoice: true },
  });
  if (!order || !order.billing?.requested || !isOrderSecured(order)) return;
  const b = order.billing;
  if (!b.fiscalName.trim() || billingDataMissing(b.nif, b.address, order.amountCents)) return;
  const events = await prisma.orderEvent.findMany({
    where: { orderId, type: { in: ["notification.delivery_ready.sent", "notification.invoice.sent"] } },
    select: { type: true, createdAt: true, payload: true },
  });
  const asked = events.some((e) => e.type === "notification.delivery_ready.sent" && (e.payload as any)?.billingRequested === true);
  if (!asked || events.some((e) => e.type === "notification.invoice.sent")) return;

  const result = await runInvoiceOnly(
    {
      prepare: () =>
        prepareDeliveryInvoice({
          orderId,
          amountCents: order.amountCents,
          billingExcluded: order.billingExcluded,
          paymentMethod: order.paymentMethod,
          monthlyInvoiceId: order.monthlyInvoiceId,
          billing: normalizeBillingInput(b, order.clientEmail),
          actorEmail,
        }),
      attach: () => buildIssuedInvoiceAttachment(order.reference),
      record: async ({ subject, text, invoiceNumber }) => {
        const composed = composeInvoiceOnlyEmail(subject, text);
        await prisma.orderEvent.create({
          data: {
            orderId,
            type: "notification.invoice.sent",
            message: `Factura ${invoiceNumber} enviada al cliente tras completar sus datos de facturación.`,
            payload: { actorEmail, channel: "EMAIL", toEmail: order.clientEmail, subject: composed.subject, bodyHtml: composed.html, invoiceAttached: true, invoiceNumber },
          },
        });
      },
      send: ({ subject, text, attachment }) => {
        void sendEmailWithRetry(() => sendInvoiceOnlyEmail({ toEmail: order.clientEmail, subject, text, attachments: [attachment] })).catch((e) =>
          console.error("[client-billing] invoice email failed", e)
        );
      },
    },
    {
      reference: order.reference,
      lang: toDeliveryLang(order.clientLocale),
      clientName: greetingName(order.clientName, order.clientEmail),
      reviewUrl: getReviewUrl(),
    }
  );
  if (!result.ok) {
    await prisma.orderEvent.create({
      data: { orderId, type: "billing.auto_invoice_failed", message: `El cliente completó sus datos pero la factura no salió: ${result.error}` },
    });
  }
}
