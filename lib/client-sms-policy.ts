// lib/client-sms-policy.ts — frenos de los SMS a CLIENTES (no toca los de staff).
// 8-oct-2026: 139 de 142 SMS a clientes fallan (Twilio 21612/21408) y algunos
// presupuestos acumulaban 12 reintentos.
export const SMS_FAIL_LIMIT = 2;
export const SMS_FAIL_WINDOW_DAYS = 7;

/** CLIENT_SMS=off apaga todos los SMS a clientes (por defecto on). */
export function clientSmsEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return String(env.CLIENT_SMS ?? "on").trim().toLowerCase() !== "off";
}

const digits9 = (p: string | null | undefined) => {
  const d = String(p || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : d;
};

/** ¿Tiene este número 2+ SMS FAILED en la ventana? `failedRecipients` = destinatarios de los FAILED recientes. */
export function smsBraked(failedRecipients: (string | null | undefined)[], to: string, limit = SMS_FAIL_LIMIT): boolean {
  const target = digits9(to);
  if (!target) return false;
  return failedRecipients.filter((r) => digits9(r) === target).length >= limit;
}
