// Decisiones PURAS de los avisos de dinero (lib/money-alerts.ts y el webhook de
// presupuestos). Sin imports de servidor para poder testearlo con node --test.
import { sameTranslatorName } from "./lavori-bridge.ts";

/** Entregas fallidas del mismo presupuesto a partir de las cuales se responde 200 a Stripe. */
export const BRIDGE_MAX_FAILED_DELIVERIES = 5;

/** Ya se avisó de este pedido sin coste para ESTE traductor (otro traductor = otro aviso). */
export function costAlertAlreadySent(events: { payload: unknown }[], translator: string): boolean {
  return events.some((e) => sameTranslatorName(String((e.payload as { translator?: unknown } | null)?.translator || ""), translator));
}

/** El «pago confirmado» sale una vez: si ya hay uno SENT al cliente, no se repite. */
export function shouldSendPaidConfirmation(logs: { status: string; recipient: string }[]): boolean {
  return !logs.some((l) => l.status === "SENT" && l.recipient !== "staff");
}

/** failedDeliveries cuenta también la actual. retry = 500 para que Stripe reintente. */
export function bridgeFailureAction(failedDeliveries: number): "retry" | "give_up" {
  return failedDeliveries >= BRIDGE_MAX_FAILED_DELIVERIES ? "give_up" : "retry";
}
