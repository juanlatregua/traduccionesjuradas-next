import { prisma } from "@/lib/prisma";
import {
  snapshotFromDocs,
  UnpricedSessionError,
  PAPER_SHIPPING_CENTS,
  type SessionPricingSnapshot,
} from "@/lib/session-pricing-math";

export { UnpricedSessionError, PAPER_SHIPPING_CENTS };
export type { SessionPricingSnapshot };

export const PURPOSE_REGULARIZACION_2026 = "REGULARIZACION_2026";

// Sesiones de la puerta (v2): cada documento trae su precio del pricing-engine,
// calculado por idioma (el 25 € de campaña solo se aplica a documentos FR, en
// checkout/route.ts). Si algún documento no lo trae (sesiones legacy del funnel
// viejo, o un camino futuro que se cuele sin tarificar), lanza
// UnpricedSessionError: NO existe ya el precio plano de 40 €/doc — quien llama
// debe derivar a presupuesto manual (WhatsApp).
export async function computeSessionPricing(sessionId: string): Promise<SessionPricingSnapshot> {
  const [docs, session] = await Promise.all([
    prisma.orderDocument.findMany({ where: { sessionId }, select: { quotedCents: true } }),
    prisma.orderSession.findUnique({ where: { id: sessionId }, select: { deliveryType: true } }),
  ]);

  const shippingCents = session?.deliveryType === "paper" ? PAPER_SHIPPING_CENTS : 0;

  const snapshot = snapshotFromDocs(
    docs.map((d) => d.quotedCents),
    shippingCents
  );
  if (!snapshot) {
    throw new UnpricedSessionError(
      sessionId,
      docs.filter((d) => d.quotedCents == null).length
    );
  }
  return snapshot;
}
