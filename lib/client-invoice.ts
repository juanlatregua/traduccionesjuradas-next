// lib/client-invoice.ts — Factura al cliente con numeración fiscal AA_NNN.
// La BD es el CONTADOR MAESTRO (el doble contador Excel+BD causó la colisión
// 26_010): al emitir sin número se asigna automáticamente el siguiente de la
// serie del docKind. Series separadas: facturas AA_NNN, presupuestos P·AA_NNN
// (los presupuestos históricos con número de la serie de facturas se quedan como
// están). El override manual sigue permitido, validado por formato del docKind.
//
// Dos caminos conviven:
//  - Pedido pagado (auto): el importe es el TOTAL con IVA del pedido → base = total/(1+iva).
//  - Factura manual/libre (borrador): el staff teclea LÍNEAS con su base (sin IVA),
//    elige el IVA, edita libremente y al EMITIR se le asigna el número y se congela.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { assertNotInClosedPeriod } from "@/lib/tax-close-store";
import {
  clampVatRate,
  computeLineTotals,
  isValidDocNumber,
  isValidInvoiceNumber,
  nextNumberInSeries,
  normalizeLines,
  totalsFromGross,
  type InvoiceLine,
} from "@/lib/invoice-math";

// Re-exporta la API pública que ya consumían otros módulos.
export { clampVatRate, computeLineTotals, isValidDocNumber, isValidInvoiceNumber, type InvoiceLine };

export type DocKind = "invoice" | "quote";

function yy(forYear?: number): string {
  return String((forYear ?? new Date().getFullYear()) % 100).padStart(2, "0");
}

// Error de colisión de número, detectable por código (no por el texto del mensaje).
function numberTakenError(n: string) {
  return Object.assign(new Error(`El número ${n} ya está en uso por otra factura.`), { code: "INVOICE_NUMBER_TAKEN" });
}

function invalidNumberError(docKind: DocKind) {
  return new Error(
    docKind === "quote"
      ? "Número de presupuesto inválido. Formato: P + AA_NNN (p.ej. P26_001)."
      : "Número de factura inválido. Formato: AA_NNN (p.ej. 26_018)."
  );
}

// Sugerencia = contador maestro: mayor secuencia en BD de la serie del docKind
// para el año + 1. forYear: año de la serie (= año de la emisión); por defecto el actual.
export async function suggestNextInvoiceNumber(docKind: DocKind = "invoice", forYear?: number): Promise<string> {
  const yearYY = yy(forYear);
  const prefix = docKind === "quote" ? `P${yearYY}_` : `${yearYY}_`;
  const rows = await prisma.clientInvoice.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  return nextNumberInSeries(rows.map((r) => r.number), docKind, yearYY);
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
  simplified?: boolean; // factura simplificada (≤400€, sin NIF)
}) {
  const manualNumber = (input.number || "").trim();
  if (manualNumber && !isValidDocNumber(manualNumber, "invoice")) {
    throw invalidNumberError("invoice");
  }
  // Un presupuesto vinculado NO se convierte automáticamente: su régimen de IVA
  // puede no ser 21% (extra-UE 0%) y convertirlo destruiría el documento P y su
  // número. La factura se emite a mano desde Facturas con el IVA correcto.
  const linked = await prisma.clientInvoice.findUnique({
    where: { orderId: input.orderId },
    select: { docKind: true, number: true },
  });
  if (linked?.docKind === "quote") {
    throw new Error(
      `El pedido tiene un presupuesto vinculado (${linked.number || "borrador"}): emite la factura desde /zona-traductor/facturas con el IVA que corresponda.`
    );
  }
  // Gate de trimestre cerrado (mismo criterio que issueInvoice).
  if (input.issuedAt) await assertNotInClosedPeriod(input.issuedAt);
  const forYear = (input.issuedAt ?? new Date()).getFullYear();
  const { baseCents, vatCents, totalCents } = totalsFromGross(input.amountCents, 0.21);

  // Auto-numeración con reintento anti-colisión (carrera con otra emisión); con
  // número manual no se reintenta: la colisión es un error del operador.
  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const finalNumber = manualNumber || (await suggestNextInvoiceNumber("invoice", forYear));

    // Unicidad: no permitir un número ya usado por OTRO pedido.
    const clash = await prisma.clientInvoice.findUnique({
      where: { number: finalNumber },
      select: { orderId: true },
    });
    if (clash && clash.orderId !== input.orderId) {
      if (manualNumber) throw numberTakenError(finalNumber);
      lastErr = numberTakenError(finalNumber);
      continue;
    }

    const data = {
      number: finalNumber,
      status: "ISSUED",
      // Este camino SIEMPRE emite factura: si el pedido tenía un presupuesto
      // (docKind quote), la fila pasa a factura para que serie y docKind casen.
      docKind: "invoice",
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
      ...(input.simplified !== undefined ? { simplified: input.simplified } : {}),
    };

    try {
      return await prisma.clientInvoice.upsert({
        where: { orderId: input.orderId },
        create: {
          orderId: input.orderId,
          issuedAt: input.issuedAt ?? new Date(),
          origin: input.origin ?? "manual",
          simplified: input.simplified ?? false,
          ...data,
        },
        update: data,
      });
    } catch (err: any) {
      // Colisión de número @unique desde el propio upsert (carrera con otra emisión).
      if (err?.code === "P2002") {
        if (manualNumber) throw numberTakenError(finalNumber);
        lastErr = numberTakenError(finalNumber);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Camino cliente: emite la factura si no existe (número auto AA_NNN). Idempotente.
// `created` distingue la auto-emisión (lazy_pdf) para poder avisar al staff.
export async function getOrCreateClientInvoice(input: {
  orderId: string;
  amountCents: number;
  billing: BillingSnapshot;
}) {
  const existing = await prisma.clientInvoice.findUnique({ where: { orderId: input.orderId } });
  // Un presupuesto (docKind quote) no es la factura del cliente y NO se convierte
  // solo: el cliente recibe la proforma y el staff emite la factura a mano.
  if (existing?.docKind === "quote") return { invoice: existing, created: false, quotePending: true as const };
  if (existing) return { invoice: existing, created: false };
  const invoice = await issueOrUpdateInvoice({ ...input, origin: "lazy_pdf" });
  return { invoice, created: true };
}

// ── Camino manual/libre: borrador editable, sin número hasta emitir ─────────────
export type DraftInvoiceInput = {
  brand?: string | null;
  clientName?: string | null;
  holderNames?: string | null;
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
  docKind?: string | null; // invoice | quote — quote = presupuesto: serie propia P·AA_NNN y fuera de contabilidad/303/gestoría
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
      docKind: input.docKind === "quote" ? "quote" : "invoice",
      brand: input.brand?.trim() || "traduccionesjuradas",
      clientName: input.clientName?.trim() || null,
      holderNames: input.holderNames?.trim() || null,
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
// La serie sale del docKind del documento: factura AA_NNN, presupuesto P·AA_NNN.
// issuedAt opcional: para sellar con la fecha del cobro (conciliación), no hoy.
export async function issueInvoice(id: string, opts?: { number?: string | null; issuedAt?: Date | null; origin?: string | null; simplified?: boolean }) {
  const inv = await prisma.clientInvoice.findUnique({ where: { id } });
  if (!inv) throw new Error("Factura no encontrada.");
  if (inv.status === "ISSUED") return inv;
  if (!inv.fiscalName?.trim()) throw new Error("Falta el nombre fiscal del cliente.");
  if (inv.totalCents <= 0) throw new Error("La factura no tiene importe. Añade al menos una línea.");

  const docKind: DocKind = inv.docKind === "quote" ? "quote" : "invoice";
  const manualNumber = (opts?.number || "").trim();
  if (manualNumber && !isValidDocNumber(manualNumber, docKind)) {
    throw invalidNumberError(docKind);
  }
  const issuedAt = opts?.issuedAt ?? new Date();
  // Gate de trimestre cerrado en el chokepoint: cualquier camino que retro-feche
  // una FACTURA dentro de un 303 presentado falla aquí (los presupuestos no
  // entran en contabilidad y quedan fuera del gate).
  if (opts?.issuedAt && docKind === "invoice") await assertNotInClosedPeriod(issuedAt);

  let lastErr: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    const finalNumber = manualNumber || (await suggestNextInvoiceNumber(docKind, issuedAt.getFullYear()));
    const clash = await prisma.clientInvoice.findUnique({
      where: { number: finalNumber },
      select: { id: true },
    });
    if (clash && clash.id !== id) {
      if (manualNumber) throw numberTakenError(finalNumber);
      lastErr = numberTakenError(finalNumber);
      continue;
    }

    try {
      return await prisma.clientInvoice.update({
        where: { id },
        data: {
          number: finalNumber,
          status: "ISSUED",
          issuedAt,
          ...(opts?.origin ? { origin: opts.origin } : {}),
          ...(opts?.simplified !== undefined ? { simplified: opts.simplified } : {}),
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        if (manualNumber) throw numberTakenError(finalNumber);
        lastErr = numberTakenError(finalNumber);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Fuente ÚNICA del sellado de cobro de una factura de cliente. La usan tanto la
// conciliación bancaria (app/api/bank/decision) como el marcado manual
// (app/api/invoices/[id]/paid) para que solo haya UN camino a ClientInvoice.paidAt,
// con la misma guarda de estado. `when=null` limpia el cobro (deshacer conciliación).
// Devuelve el resultado o lanza con un mensaje claro (el caller decide cómo avisar).
// `proof` opcional: patch del justificante (url/key/name) escrito en el MISMO update
// que el paidAt → sellado de cobro + adjunto son atómicos (no deja PAID-sin-proof).
// Pasar `{ url:null, key:null, name:null }` limpia el justificante. Omitirlo no lo toca.
export async function setInvoicePaid(
  id: string,
  when: Date | null = new Date(),
  proof?: { url: string | null; key: string | null; name: string | null }
) {
  const inv = await prisma.clientInvoice.findUnique({
    where: { id },
    select: { id: true, status: true, paidAt: true },
  });
  if (!inv) throw new Error("Factura no encontrada.");
  if (when && inv.status !== "ISSUED") {
    throw new Error("Emite la factura antes de marcarla como cobrada.");
  }
  const data: Prisma.ClientInvoiceUpdateInput = {};
  // Una vez sellada con fecha, NO se reescribe el paidAt en re-emparejamientos: un
  // re-guardado sin movementDate defaultea a hoy y mandaría el cobro a OTRO trimestre
  // (bug de conciliación). Para corregir la fecha: limpiar (when=null) y volver a
  // sellar con la fecha correcta. Limpiar (when=null) siempre pasa. Adjuntar un
  // justificante a una factura YA cobrada conserva su paidAt original (no lo pisa).
  if (!(when && inv.paidAt)) data.paidAt = when;
  if (proof !== undefined) {
    data.paymentProofUrl = proof?.url ?? null;
    data.paymentProofKey = proof?.key ?? null;
    data.paymentProofName = proof?.name ?? null;
  }
  if (Object.keys(data).length === 0) return inv;
  return prisma.clientInvoice.update({ where: { id }, data });
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
