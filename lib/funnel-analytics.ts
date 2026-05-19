import { prisma } from "@/lib/prisma";

export type FunnelStep = "upload" | "review" | "checkout" | "confirmation";

/* Registra que una sesion del funnel ha alcanzado un paso. Idempotente:
   un evento por (sesion, paso), asi el conteo es de sesiones unicas. */
export async function recordFunnelStep(
  session: { id: string; reference: string },
  step: FunnelStep,
) {
  try {
    await prisma.funnelEvent.upsert({
      where: { sessionId_step: { sessionId: session.id, step } },
      create: { sessionId: session.id, reference: session.reference, step },
      update: {},
    });
  } catch (err) {
    console.error("[funnel-analytics] recordFunnelStep failed:", err);
  }
}
