// lib/staff-sms-policy.ts — qué avisos al STAFF salen por SMS (13-nov-2026).
// El 89 % del gasto SMS eran avisos al staff; solo los de DINERO van por SMS, el resto por email.
// STAFF_SMS=all → todo crítico (vuelta atrás sin deploy) · STAFF_SMS=off → nada por SMS.

const CRITICAL_FIRST_TOKEN = new Set([
  "pago",
  "cobro_sin_pedido",
  "cobro_resuelto",
  "importe_no_coincide",
  "coste_sin_cifra",
  "cobrado_congelado",
  "margen",
  "margen_cero",
  "pactado_sin_margen",
  "pactado_duplicado",
  "aceptacion_frenada",
  "precio_supera_coste",
  "precio_aceptado_conflicto",
  "precio_aceptado_fallo",
  "justificante",
  "verifactu",
  "copia_fallida",
  "lavori_fallback",
  "encargo_retirado",
  "payment_reconciliation",
  "payments-confirm",
  "payment-stripe-webhook",
  "quote-stripe-webhook",
  "money-alerts",
  "payment-reconciliation",
]);

const CRITICAL_PREFIX = ["doble cobro", "segundo pago"];

export type StaffSmsMode = "policy" | "all" | "off";

export function staffSmsMode(env: Record<string, string | undefined> = process.env): StaffSmsMode {
  const v = String(env.STAFF_SMS ?? "").trim().toLowerCase();
  return v === "all" ? "all" : v === "off" ? "off" : "policy";
}

/** ¿Este aviso al staff va por SMS (true) o solo por email (false)? */
export function isCriticalStaffSms(
  context: string,
  body: string,
  env: Record<string, string | undefined> = process.env
): boolean {
  const mode = staffSmsMode(env);
  if (mode === "all") return true;
  if (mode === "off") return false;
  const ctx = String(context || "").trim().toLowerCase();
  if (CRITICAL_PREFIX.some((p) => ctx.startsWith(p))) return true;
  if (CRITICAL_FIRST_TOKEN.has(ctx.split(/\s+/)[0])) return true;
  return /^PAGO \d/.test(String(body || ""));
}
