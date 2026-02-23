import { prisma } from "@/lib/prisma";
import { generateQuoteNumber, normalizeQuoteStatus, type QuoteStatus } from "@/lib/quotes";

export async function getQuoteByIdForAdmin(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
      messageLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      accessEvents: { orderBy: { at: "desc" }, take: 30 },
    },
  });
}

export async function getQuoteByTokenPublic(token: string) {
  return prisma.quote.findUnique({
    where: { publicToken: token },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function createNextQuoteNumber() {
  const year = new Date().getFullYear();
  const prefix = `${year}-`;
  const count = await prisma.quote.count({
    where: {
      quoteNumber: {
        startsWith: prefix,
      },
    },
  });
  return generateQuoteNumber(count + 1, new Date());
}

export async function transitionQuoteStatus(params: {
  quoteId: string;
  to: QuoteStatus;
  openedAt?: Date | null;
  paidAt?: Date | null;
  deliveredAt?: Date | null;
  sentAt?: Date | null;
  adminSentBy?: string | null;
}) {
  const current = await prisma.quote.findUnique({
    where: { id: params.quoteId },
    select: { status: true },
  });
  if (!current) {
    throw new Error("Presupuesto no encontrado.");
  }

  const status = normalizeQuoteStatus(params.to);
  return prisma.quote.update({
    where: { id: params.quoteId },
    data: {
      status,
      openedAt: params.openedAt === undefined ? undefined : params.openedAt,
      paidAt: params.paidAt === undefined ? undefined : params.paidAt,
      deliveredAt: params.deliveredAt === undefined ? undefined : params.deliveredAt,
      sentAt: params.sentAt === undefined ? undefined : params.sentAt,
      adminSentBy: params.adminSentBy === undefined ? undefined : params.adminSentBy,
    },
  });
}
