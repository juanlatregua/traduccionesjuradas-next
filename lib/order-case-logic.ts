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

// ---------------------------------------------------------------------------
// AMPLIACIÓN de un pedido (3-sep-2026): el cliente añade un documento después de
// pagar. Decisión de Juan: NO se toca el pedido cobrado (1 pedido = 1 factura);
// se hace un presupuesto hermano y, al nacer su pedido, se agrupa en el mismo
// trámite. El lote de entrada del presupuesto hermano lleva el prefijo AMPL- y
// la referencia del pedido padre; es la única pista que hace falta para agrupar
// en createOrderShellFromQuote sin tocar el esquema. Cada ampliación tiene su
// propio lote (sufijo temporal): dos Order con el MISMO expedienteRef
// duplicarían sus OrderDocumentItem (ver 61ee169).
// ---------------------------------------------------------------------------

const EXTENSION_PREFIX = "AMPL-";

export function buildExtensionLote(parentReference: string, now: Date = new Date()): string {
  const ref = String(parentReference || "").trim();
  if (!ref) throw new Error("Referencia del pedido padre vacía.");
  return `${EXTENSION_PREFIX}${ref}-${now.getTime().toString(36)}`;
}

/** Referencia del pedido padre si el lote es una ampliación; null si no lo es. */
export function parseExtensionLote(expedienteRef: string | null | undefined): string | null {
  const s = String(expedienteRef || "").trim();
  if (!s.startsWith(EXTENSION_PREFIX)) return null;
  const body = s.slice(EXTENSION_PREFIX.length);
  const cut = body.lastIndexOf("-");
  if (cut <= 0 || cut === body.length - 1) return null;
  const parent = body.slice(0, cut);
  const suffix = body.slice(cut + 1);
  if (!/^[a-z0-9]+$/.test(suffix)) return null;
  return parent;
}
