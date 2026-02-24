import type { OrderSession, OrderDocument } from "@prisma/client";

export type OrderSessionWithDocs = OrderSession & { docs: OrderDocument[] };

export function serializeOrderSession(session: OrderSessionWithDocs) {
  return {
    id: session.id,
    reference: session.reference,
    step: session.step,
    purpose: session.purpose,
    authState: session.authState,
    userId: session.userId,
    pricing: {
      subtotalCents: session.subtotalCents,
      vatCents: session.vatCents,
      totalCents: session.totalCents,
      currency: session.currency,
    },
    payment: {
      isPaid: session.isPaid,
      paidAt: session.paidAt,
      paymentMethod: session.paymentMethod,
    },
    documents: session.docs.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      sourceLang: doc.sourceLang,
      targetLang: doc.targetLang,
      createdAt: doc.createdAt,
    })),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

