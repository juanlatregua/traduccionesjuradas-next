// lib/client-portal.ts — Agregación de TODO lo de un cliente por su email, para
// la zona de cliente. Matching case-insensitive (datos antiguos con mayúsculas).

import { prisma } from "@/lib/prisma";

export async function getClientPortalData(emailRaw: string) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email) return null;

  const ci = { equals: email, mode: "insensitive" as const };

  const [customer, orders, quotes, invoices] = await Promise.all([
    // findFirst + insensitive (no findUnique): la ficha fiscal debe aparecer
    // aunque el Customer.email tenga otra capitalización, igual que orders/quotes.
    prisma.customer.findFirst({ where: { email: ci } }),
    prisma.order.findMany({
      where: { clientEmail: ci },
      orderBy: { createdAt: "desc" },
      select: {
        reference: true,
        title: true,
        langPair: true,
        clientLocale: true,
        amountCents: true,
        currency: true,
        status: true,
        paymentStatus: true,
        deliveryState: true,
        dueDate: true,
        createdAt: true,
        paidAt: true,
        translatedFileUrl: true,
        finalFilename: true,
        deliveryFilesJson: true,
        trackingNumber: true,
      },
    }),
    prisma.quote.findMany({
      where: { customerEmail: ci },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        sourceLang: true,
        targetLang: true,
        total: true,
        validUntil: true,
        publicToken: true,
        createdAt: true,
        paidAt: true,
      },
    }),
    prisma.clientInvoice.findMany({
      where: { status: "ISSUED", OR: [{ email: ci }, { order: { clientEmail: ci } }] },
      orderBy: { issuedAt: "desc" },
      select: {
        id: true,
        number: true,
        issuedAt: true,
        paidAt: true,
        totalCents: true,
        concept: true,
        orderId: true,
      },
    }),
  ]);

  return { email, customer, orders, quotes, invoices };
}

export type ClientPortalData = NonNullable<Awaited<ReturnType<typeof getClientPortalData>>>;
