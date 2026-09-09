// lib/lavori-lead-match.ts — Emparejamiento puro pedido↔solicitud de precio de lavori.
// Sin Prisma: lo usan el pago (workflow-server), el alta de presupuesto y los tests.

/** Estados de una solicitud que ya llevan al jurado detrás y, por tanto, NO deben
 * provocar un encargo nuevo al pagar: PRICED (cotizada) y ACCEPTED (Juan ya la
 * confirmó en lavori antes de marcar el pago — caso Daniela/26_C3675D, 8-sep-2026). */
export const LEAD_PAIRABLE_STATUSES = ["PRICED", "ACCEPTED"] as const;

export type LeadCustomerHintRow = { customerHint: string | null; priceCents: number | null; status: string };

const norm = (x: string | null | undefined) => String(x || "").trim().toLowerCase();
const digits = (x: string | null | undefined) => String(x || "").replace(/\D/g, "").slice(-9);

/** Una solicitud "vale" para emparejar si trae cifra, o si el jurado ya aceptó
 * (ACCEPTED sin cifra: se asigna sin coste y se avisa, pero jamás se abre otro encargo). */
export function isLeadPairable(row: { priceCents: number | null; status: string }): boolean {
  return row.status === "ACCEPTED" || Boolean(row.priceCents && row.priceCents > 0);
}

/** Busca entre candidatas (mismo par, recientes, sin presupuesto atado) la que
 * nombra al cliente del pedido en su customerHint ("Nombre · teléfono · email").
 * Solo cuentan coincidencias exactas por parte; el email marcador @whatsapp.local
 * nunca empareja. */
export function matchLeadByCustomer<T extends LeadCustomerHintRow>(
  candidatas: T[],
  who: { email?: string | null; name?: string | null; phone?: string | null }
): T | null {
  const email = norm(who.email);
  const name = norm(who.name);
  const phone = digits(who.phone);
  const hit = candidatas.find((c) => {
    if (!isLeadPairable(c)) return false;
    const parts = (c.customerHint || "").split(" · ").map((x) => x.trim()).filter(Boolean);
    return parts.some(
      (part) =>
        (email && !email.endsWith("@whatsapp.local") && norm(part) === email) ||
        (phone && phone.length >= 9 && digits(part) === phone) ||
        (name && name.length >= 5 && norm(part) === name)
    );
  });
  return hit ?? null;
}
