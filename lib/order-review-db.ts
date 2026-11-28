import { prisma } from "@/lib/prisma";
import { verifyOrderToken } from "@/lib/order-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { REVIEW_EVENT_TYPE, type ReviewDeps } from "@/lib/order-review";

export const reviewDeps: ReviewDeps = {
  verifyOrderToken,
  findOrder: (reference) =>
    prisma.order.findUnique({
      where: { reference },
      select: { id: true, reference: true, clientName: true, clientEmail: true, clientLocale: true },
    }),
  findReview: (orderId) =>
    prisma.orderEvent.findFirst({
      where: { orderId, type: REVIEW_EVENT_TYPE },
      orderBy: { createdAt: "asc" },
      select: { id: true, payload: true },
    }),
  createReview: async (orderId, message, payload) => {
    await prisma.orderEvent.create({ data: { orderId, type: REVIEW_EVENT_TYPE, message, payload } });
  },
  updateReview: async (id, message, payload) => {
    await prisma.orderEvent.update({ where: { id }, data: { message, payload } });
  },
  rateLimit: (key, limit, windowMs) => checkRateLimit({ key, limit, windowMs }),
  notifyStaff: async (subject, text) => {
    const { sendMail } = await import("@/lib/azure-mail");
    const { renderSimpleEmailHtml } = await import("@/lib/quote-messages");
    await sendMail({
      to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
      subject,
      text,
      html: renderSimpleEmailHtml(text),
    });
  },
};
