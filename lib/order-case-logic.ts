// lib/order-case-logic.ts — Lógica pura del TRÁMITE (sin BD, testeable).
// Compartida por lib/order-case.ts y el endpoint de envío.

import crypto from "crypto";

export function createCaseRef() {
  // TRAM-XXXXXX (6 alfanuméricos en mayúscula, sin caracteres ambiguos).
  // Prefijo distinto de EXP- a propósito: ningún startsWith("exp:") debe cazarlo.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `TRAM-${out}`;
}

export type ShippableMember = {
  id: string;
  reference: string;
  deliveryType: string;
  shippedAt: Date | null;
};

// Qué pedidos del trámite entran REALMENTE en el sobre. Filtra dos cosas que con
// los datos de Ana Suárez habrían dado un email mentiroso: los digitales
// (26_3259FE ya fue por PDF el 7-ago) y los ya sellados (un envío hecho no se
// reescribe — el cierre de un pedido no se reabre).
export function selectShippableMembers<T extends ShippableMember>(members: T[]): T[] {
  return members.filter((m) => m.deliveryType === "paper" && m.shippedAt == null);
}
