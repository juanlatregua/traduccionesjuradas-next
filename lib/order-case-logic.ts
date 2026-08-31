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
  paymentStatus: string;
};

// Qué pedidos del trámite entran REALMENTE en el sobre. Filtra tres cosas que
// habrían dado un email mentiroso al cliente:
//  · los digitales — 26_3259FE ya fue por PDF el 7-ago; anunciarlo por
//    mensajería sería mentir;
//  · los ya sellados — un envío hecho no se reescribe;
//  · los NO COBRADOS — misma regla que /api/orders/[ref]/delivery y
//    lib/client-delivery.ts:18: no se entrega sin cobrar. Un hermano recién
//    creado y aún sin pagar se queda fuera EN SILENCIO (no se le pone
//    shippedAt), así que sigue siendo enviable en cuanto entre su pago.
export function selectShippableMembers<T extends ShippableMember>(members: T[]): T[] {
  return members.filter((m) => m.deliveryType === "paper" && m.shippedAt == null && m.paymentStatus === "PAID");
}
