// lib/client-invoice.ts — Factura al cliente con numeración fiscal AA_NNN.
// Formato real de HBTJ: contador anual compartido (presupuestos + facturas),
// p.ej. 26_014. La web auto-sugiere el siguiente según lo que tenga en BD, pero
// el número es EDITABLE/manual porque el contador maestro lo lleva Juan (Excel).

import { prisma } from "@/lib/prisma";

export function isValidInvoiceNumber(n: string): boolean {
  return /^\d{2}_\d{3,}$/.test(n.trim());
}

function yy(): string {
  return String(new Date().getFullYear() % 100).padStart(2, "0");
}

// Sugerencia: mayor secuencia conocida en BD para el año + 1. OJO: no conoce los
// números que Juan haya asignado a mano en el Excel → es solo un punto de partida.
export async function suggestNextInvoiceNumber(): Promise<string> {
  const prefix = `${yy()}_`;
  const rows = await prisma.clientInvoice.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  let max = 0;
  for (const r of rows) {
    const m = r.number.match(/^(\d{2})_(\d+)$/);
    if (m) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

type BillingSnapshot = {
  fiscalName: string;
  nif: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
};

function vatBreakdown(totalCents: number) {
  const base = Math.round(totalCents / 1.21);
  return { base, vat: totalCents - base };
}

// Emite o actualiza la factura de un pedido. number opcional: si no se pasa, se
// auto-sugiere; si se pasa, se valida formato y unicidad (puede editarse el de
// una factura ya emitida). Idempotente por orderId.
export async function issueOrUpdateInvoice(input: {
  orderId: string;
  amountCents: number;
  billing: BillingSnapshot;
  number?: string | null;
}) {
  const finalNumber = (input.number || "").trim() || (await suggestNextInvoiceNumber());
  if (!isValidInvoiceNumber(finalNumber)) {
    throw new Error("Número de factura inválido. Formato: AA_NNN (p.ej. 26_018).");
  }

  // Unicidad: no permitir un número ya usado por OTRO pedido.
  const clash = await prisma.clientInvoice.findUnique({
    where: { number: finalNumber },
    select: { orderId: true },
  });
  if (clash && clash.orderId !== input.orderId) {
    throw new Error(`El número ${finalNumber} ya está en uso por otra factura.`);
  }

  const { base, vat } = vatBreakdown(input.amountCents);
  const data = {
    number: finalNumber,
    fiscalName: input.billing.fiscalName,
    nif: input.billing.nif,
    address: input.billing.address,
    city: input.billing.city,
    postalCode: input.billing.postalCode,
    country: input.billing.country,
    email: input.billing.email,
    baseCents: base,
    vatRate: 0.21,
    vatCents: vat,
    totalCents: input.amountCents,
  };

  return prisma.clientInvoice.upsert({
    where: { orderId: input.orderId },
    create: { orderId: input.orderId, ...data },
    update: data,
  });
}

// Camino cliente: emite la factura si no existe (número auto AA_NNN). Idempotente.
export async function getOrCreateClientInvoice(input: {
  orderId: string;
  amountCents: number;
  billing: BillingSnapshot;
}) {
  const existing = await prisma.clientInvoice.findUnique({ where: { orderId: input.orderId } });
  if (existing) return existing;
  return issueOrUpdateInvoice(input);
}
