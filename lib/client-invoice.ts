// lib/client-invoice.ts — Factura al cliente con numeración fiscal AA_NNN.
// Formato real de HBTJ: contador anual compartido (presupuestos + facturas),
// p.ej. 26_014. La web auto-sugiere el siguiente según lo que tenga en BD, pero
// el número es EDITABLE/manual porque el contador maestro lo lleva Juan (Excel).
//
// Dos caminos conviven:
//  - Pedido pagado (auto): el importe es el TOTAL con IVA del pedido → base = total/(1+iva).
//  - Factura manual/libre (borrador): el staff teclea LÍNEAS con su base (sin IVA),
//    elige el IVA, edita libremente y al EMITIR se le asigna el número y se congela.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  clampVatRate,
  computeLineTotals,
  isValidInvoiceNumber,
  normalizeLines,
  totalsFromGross,
  type InvoiceLine,
} from "@/lib/invoice-math";

// Re-exporta la API pública que ya consumían otros módulos.
export { clampVatRate, computeLineTotals, isValidInvoiceNumber, type InvoiceLine };

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
    const m = r.number?.match(/^(\d{2})_(\d+)$/);
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

// ── Camino pedido pagado: emite/actualiza factura ya numerada (ISSUED) ──────────
// number opcional: si no se pasa, se auto-sugiere; si se pasa, se valida formato y
// unicidad. Idempotente por orderId.
export async function issueOrUpdateInvoice(input: {
  orderId: string;
  amountCents: number;
  billing: BillingSnapshot;
  number?: string | null;
  issuedAt?: Date | null; // fecha de emisión (p.ej. la del cobro); por defecto ahora
  origin?: string | null; // auditoría del origen
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

  const { baseCents, vatCents, totalCents } = totalsFromGross(input.amountCents, 0.21);
  const data = {
    number: finalNumber,
    status: "ISSUED",
    fiscalName: input.billing.fiscalName,
    nif: input.billing.nif,
    address: input.billing.address,
    city: input.billing.city,
    postalCode: input.billing.postalCode,
    country: input.billing.country,
    email: input.billing.email,
    baseCents,
    vatRate: 0.21,
    vatCents,
    totalCents,
    // origin solo se fija si se pasa explícito (no pisar el de una factura ya creada)
    ...(input.origin ? { origin: input.origin } : {}),
    // issuedAt en update solo si se pasa explícito (no re-sellar una emitida)
    ...(input.issuedAt ? { issuedAt: input.issuedAt } : {}),
  };

  try {
    return await prisma.clientInvoice.upsert({
      where: { orderId: input.orderId },
      create: {
        orderId: input.orderId,
        issuedAt: input.issuedAt ?? new Date(),
        origin: input.origin ?? "manual",
        ...data,
      },
      update: data,
    });
  } catch (err: any) {
    // Colisión de número @unique desde el propio upsert (carrera con otra emisión).
    if (err?.code === "P2002") {
      throw new Error(`El número ${finalNumber} ya está en uso por otra factura.`);
    }
    throw err;
  }
}

// Camino cliente: emite la factura si no existe (número auto AA_NNN). Idempotente.
export async function getOrCreateClientInvoice(input: {
  orderId: string;
  amountCents: number;
  billing: BillingSnapshot;
}) {
  const existing = await prisma.clientInvoice.findUnique({ where: { orderId: input.orderId } });
  if (existing) return existing;
  return issueOrUpdateInvoice({ ...input, origin: "lazy_pdf" });
}

// ── Camino manual/libre: borrador editable, sin número hasta emitir ─────────────
export type DraftInvoiceInput = {
  brand?: string | null;
  clientName?: string | null;
  fiscalName: string;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  concept?: string | null;
  poNumber?: string | null;
  langPair?: string | null;
  lines: InvoiceLine[];
  vatRate: number;
  orderId?: string | null;
};

// Campos comunes de un borrador (sin orderId: lo gestiona cada caller para no
// pisar el vínculo en una edición que no lo toca).
function draftData(input: DraftInvoiceInput) {
  const lines = normalizeLines(input.lines);
  const vatRate = clampVatRate(input.vatRate);
  const { baseCents, vatCents, totalCents } = computeLineTotals(lines, vatRate);
  return {
    lines,
    data: {
      brand: input.brand?.trim() || "traduccionesjuradas",
      clientName: input.clientName?.trim() || null,
      fiscalName: String(input.fiscalName || "").trim(),
      nif: input.nif?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      postalCode: input.postalCode?.trim() || null,
      country: input.country?.trim() || "España",
      email: input.email?.trim() || null,
      concept: input.concept?.trim() || null,
      poNumber: input.poNumber?.trim() || null,
      langPair: input.langPair?.trim() || null,
      lineItemsJson: lines as unknown as Prisma.InputJsonValue,
      baseCents,
      vatRate,
      vatCents,
      totalCents,
    },
  };
}

export async function createDraftInvoice(input: DraftInvoiceInput) {
  if (!String(input.fiscalName || "").trim()) {
    throw new Error("Falta el nombre fiscal del cliente.");
  }
  const { data } = draftData(input);
  return prisma.clientInvoice.create({
    data: { status: "DRAFT", orderId: input.orderId || null, ...data },
  });
}

export async function updateDraftInvoice(id: string, input: DraftInvoiceInput) {
  const existing = await prisma.clientInvoice.findUnique({ where: { id } });
  if (!existing) throw new Error("Factura no encontrada.");
  if (existing.status !== "DRAFT") {
    throw new Error("Una factura emitida no se modifica. Bórrala o emite una nueva.");
  }
  if (!String(input.fiscalName || "").trim()) {
    throw new Error("Falta el nombre fiscal del cliente.");
  }
  const { data } = draftData(input);
  // Solo tocar el vínculo de pedido si se pasa explícitamente (undefined = no cambiar).
  const orderPatch = input.orderId !== undefined ? { orderId: input.orderId } : {};
  return prisma.clientInvoice.update({ where: { id }, data: { ...data, ...orderPatch } });
}

// Asigna el número fiscal y congela la factura. Idempotente si ya está emitida.
// issuedAt opcional: para sellar con la fecha del cobro (conciliación), no hoy.
export async function issueInvoice(id: string, opts?: { number?: string | null; issuedAt?: Date | null; origin?: string | null }) {
  const inv = await prisma.clientInvoice.findUnique({ where: { id } });
  if (!inv) throw new Error("Factura no encontrada.");
  if (inv.status === "ISSUED") return inv;
  if (!inv.fiscalName?.trim()) throw new Error("Falta el nombre fiscal del cliente.");
  if (inv.totalCents <= 0) throw new Error("La factura no tiene importe. Añade al menos una línea.");

  const finalNumber = (opts?.number || "").trim() || (await suggestNextInvoiceNumber());
  if (!isValidInvoiceNumber(finalNumber)) {
    throw new Error("Número de factura inválido. Formato: AA_NNN (p.ej. 26_018).");
  }
  const clash = await prisma.clientInvoice.findUnique({
    where: { number: finalNumber },
    select: { id: true },
  });
  if (clash && clash.id !== id) {
    throw new Error(`El número ${finalNumber} ya está en uso por otra factura.`);
  }

  try {
    return await prisma.clientInvoice.update({
      where: { id },
      data: {
        number: finalNumber,
        status: "ISSUED",
        issuedAt: opts?.issuedAt ?? new Date(),
        ...(opts?.origin ? { origin: opts.origin } : {}),
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") throw new Error(`El número ${finalNumber} ya está en uso por otra factura.`);
    throw err;
  }
}

export async function deleteInvoice(id: string) {
  return prisma.clientInvoice.delete({ where: { id } });
}

// Importación: crea una factura ya EMITIDA a partir de un registro histórico
// (Excel/CSV). Valida número y unicidad; no genera número automático.
export type ImportInvoiceRow = {
  number: string;
  date: string; // fecha de emisión
  fiscalName: string;
  nif?: string | null;
  baseCents: number;
  vatCents: number;
  totalCents?: number;
  concept?: string | null;
  brand?: string | null;
};

export async function importIssuedInvoice(row: ImportInvoiceRow) {
  const number = String(row.number || "").trim();
  if (!isValidInvoiceNumber(number)) {
    throw new Error(`Número inválido "${number}" (formato AA_NNN).`);
  }
  const exists = await prisma.clientInvoice.findUnique({ where: { number }, select: { id: true } });
  if (exists) throw new Error(`El número ${number} ya existe.`);

  const issuedAt = new Date(row.date);
  if (isNaN(issuedAt.getTime())) throw new Error(`Fecha inválida en ${number}.`);

  const base = Math.max(0, Math.round(Number(row.baseCents) || 0));
  const vat = Math.max(0, Math.round(Number(row.vatCents) || 0));
  const total = row.totalCents ? Math.round(row.totalCents) : base + vat;
  const vatRate = base > 0 ? Math.round((vat / base) * 100) / 100 : 0.21;
  const concept = row.concept?.trim() || null;

  return prisma.clientInvoice.create({
    data: {
      number,
      status: "ISSUED",
      brand: row.brand?.trim() || "traduccionesjuradas",
      issuedAt,
      fiscalName: String(row.fiscalName || "").trim() || "—",
      nif: row.nif?.trim() || null,
      country: "España",
      concept,
      lineItemsJson: concept ? ([{ description: concept, amountCents: base }] as unknown as Prisma.InputJsonValue) : undefined,
      baseCents: base,
      vatRate,
      vatCents: vat,
      totalCents: total,
    },
  });
}
