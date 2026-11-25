// lib/client-portal.ts — Agregación de TODO lo de un cliente por su email, para
// la zona de cliente. Matching case-insensitive (datos antiguos con mayúsculas).

import { prisma } from "@/lib/prisma";
import { pendingSolicitudes, type SolicitudRow } from "@/lib/client-solicitudes";

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
        // Trámite: pedidos que el cliente vive como uno solo (fue ampliando).
        caseRef: true,
        casoId: true,
      },
    }),
    prisma.quote.findMany({
      where: { customerEmail: ci, deletedAt: null },
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
        casoId: true,
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

export async function getClientSolicitudes(emailRaw: string, covered: Array<{ casoId: string | null }>) {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email) return [];
  const entradas = await prisma.entrada.findMany({
    where: { email: { equals: email, mode: "insensitive" }, estado: "confirmada" },
    orderBy: { confirmedAt: "desc" },
    take: 20,
    select: { id: true, casoId: true, loteId: true, lang: true, confirmedAt: true, createdAt: true, sourceLang: true, targetLang: true, targetLangs: true, urgency: true, neededBy: true },
  });
  if (!entradas.length) return [];
  const docs = await prisma.lecturaDocumento.findMany({
    where: { loteId: { in: entradas.map((e) => e.loteId).filter((l): l is string => Boolean(l)) }, included: true },
    select: { loteId: true, pageCount: true },
  });
  const rows: SolicitudRow[] = entradas.map(({ loteId, ...e }) => {
    const mine = docs.filter((d) => d.loteId === loteId);
    return { ...e, documentos: mine.length, paginas: mine.reduce((n, d) => n + d.pageCount, 0) };
  });
  return pendingSolicitudes(rows, covered);
}
