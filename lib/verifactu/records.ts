// lib/verifactu/records.ts — REGISTROS DE FACTURACIÓN encadenados (efectos con
// Prisma). Las huellas las fabrica lib/verifactu/hash.ts (puro, probado contra
// el ejemplo oficial de la AEAT).
//
// Reglas:
//   · Un registro de ALTA por factura emitida (F1/F2/R1…). Uno de ANULACIÓN si
//     se anula. Nunca se modifican ni se borran (la FK es Restrict a propósito).
//   · La cadena es POR EMISOR (NIF): chainIndex correlativo y prevHash = huella
//     del registro anterior de ese emisor. La serialización la da un bloqueo
//     de asesor de Postgres sobre el NIF, así dos emisiones a la vez no se
//     pisan el índice.
//   · Se llama DENTRO de la transacción que emite la factura: si el registro
//     falla, la emisión no ocurre. Una factura emitida sin registro sería justo
//     lo que el reglamento prohíbe.
//   · sendStatus LOCAL mientras no haya proveedor configurado; PENDING cuando
//     lo haya (lo remite flushPendingRecords).

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { altaHash, anulacionHash, formatGeneratedAt, formatIssueDate, type InvoiceType } from "@/lib/verifactu/hash";
import { getVerifactuProvider } from "@/lib/verifactu/provider";
import { getBrand } from "@/lib/invoice-brands";

type Tx = Prisma.TransactionClient;

export function emitterNifFor(invoice: { emitterNif?: string | null; brand?: string | null }): string {
  const explicit = String(invoice.emitterNif || "").trim();
  if (explicit) return explicit.toUpperCase();
  return String(getBrand(invoice.brand || undefined).cif).trim().toUpperCase();
}

export function invoiceTypeFor(invoice: { invoiceType?: string | null; simplified?: boolean | null; rectifiesId?: string | null }): InvoiceType {
  const t = String(invoice.invoiceType || "").toUpperCase();
  if (/^(F[123]|R[1-5])$/.test(t) && t !== "F1") return t as InvoiceType;
  if (invoice.rectifiesId) return "R1";
  if (invoice.simplified) return "F2";
  return "F1";
}

async function lockEmitter(tx: Tx, emitterNif: string) {
  // pg_advisory_xact_lock(hashtext(nif)): se libera solo al cerrar la transacción.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, emitterNif);
}

async function lastRecord(tx: Tx, emitterNif: string) {
  return tx.invoiceRecord.findFirst({
    where: { emitterNif },
    orderBy: { chainIndex: "desc" },
    select: { chainIndex: true, hash: true },
  });
}

/** Registro de ALTA para una factura recién emitida. Idempotente por factura. */
export async function createAltaRecord(
  tx: Tx,
  invoice: {
    id: string;
    number: string | null;
    issuedAt: Date | null;
    emitterNif?: string | null;
    brand?: string | null;
    invoiceType?: string | null;
    simplified?: boolean | null;
    rectifiesId?: string | null;
    vatCents: number;
    totalCents: number;
  },
  actor: string
) {
  if (!invoice.number) throw new Error("La factura no tiene número: no se puede registrar.");
  if (!invoice.issuedAt) throw new Error("La factura no tiene fecha de emisión: no se puede registrar.");
  const existing = await tx.invoiceRecord.findFirst({ where: { invoiceId: invoice.id, kind: "ALTA" }, select: { id: true } });
  if (existing) return existing;

  const emitterNif = emitterNifFor(invoice);
  await lockEmitter(tx, emitterNif);
  const prev = await lastRecord(tx, emitterNif);
  const generatedAt = new Date();
  const generatedAtIso = formatGeneratedAt(generatedAt);
  const invoiceType = invoiceTypeFor(invoice);
  const { canonical, hash } = altaHash({
    emitterNif,
    numSerie: invoice.number,
    issueDate: invoice.issuedAt,
    invoiceType,
    cuotaTotalCents: invoice.vatCents,
    importeTotalCents: invoice.totalCents,
    prevHash: prev?.hash ?? null,
    generatedAt: generatedAtIso,
  });
  const provider = safeProvider();
  const record = await tx.invoiceRecord.create({
    data: {
      invoiceId: invoice.id,
      kind: "ALTA",
      emitterNif,
      chainIndex: (prev?.chainIndex ?? 0) + 1,
      numSerie: invoice.number,
      issueDate: formatIssueDate(invoice.issuedAt),
      invoiceType,
      cuotaTotalCents: invoice.vatCents,
      importeTotalCents: invoice.totalCents,
      prevHash: prev?.hash ?? null,
      hash,
      canonical,
      generatedAt,
      generatedAtIso,
      sendStatus: provider ? "PENDING" : "LOCAL",
      provider: provider?.name ?? null,
    },
  });
  await tx.clientInvoice.update({ where: { id: invoice.id }, data: { emitterNif, invoiceType } });
  await tx.invoiceEvent.create({
    data: {
      invoiceId: invoice.id,
      type: "record.alta",
      actor,
      message: `Registro de alta ${record.chainIndex} del emisor ${emitterNif}: ${invoice.number}, ${invoiceType}, huella ${hash.slice(0, 12)}…`,
      payload: { recordId: record.id, chainIndex: record.chainIndex, hash, prevHash: prev?.hash ?? null, sendStatus: record.sendStatus },
    },
  });
  return record;
}

/** Registro de ANULACIÓN de una factura emitida. La factura no se borra. */
export async function createAnulacionRecord(
  tx: Tx,
  invoice: { id: string; number: string | null; issuedAt: Date | null; emitterNif?: string | null; brand?: string | null },
  actor: string,
  reason: string
) {
  if (!invoice.number || !invoice.issuedAt) throw new Error("Solo se anula una factura emitida.");
  const existing = await tx.invoiceRecord.findFirst({ where: { invoiceId: invoice.id, kind: "ANULACION" }, select: { id: true } });
  if (existing) return existing;
  const emitterNif = emitterNifFor(invoice);
  await lockEmitter(tx, emitterNif);
  const prev = await lastRecord(tx, emitterNif);
  const generatedAt = new Date();
  const generatedAtIso = formatGeneratedAt(generatedAt);
  const { canonical, hash } = anulacionHash({
    emitterNif,
    numSerie: invoice.number,
    issueDate: invoice.issuedAt,
    prevHash: prev?.hash ?? null,
    generatedAt: generatedAtIso,
  });
  const provider = safeProvider();
  const record = await tx.invoiceRecord.create({
    data: {
      invoiceId: invoice.id,
      kind: "ANULACION",
      emitterNif,
      chainIndex: (prev?.chainIndex ?? 0) + 1,
      numSerie: invoice.number,
      issueDate: formatIssueDate(invoice.issuedAt),
      invoiceType: "",
      cuotaTotalCents: 0,
      importeTotalCents: 0,
      prevHash: prev?.hash ?? null,
      hash,
      canonical,
      generatedAt,
      generatedAtIso,
      sendStatus: provider ? "PENDING" : "LOCAL",
      provider: provider?.name ?? null,
    },
  });
  await tx.clientInvoice.update({ where: { id: invoice.id }, data: { annulledAt: generatedAt } });
  await tx.invoiceEvent.create({
    data: {
      invoiceId: invoice.id,
      type: "invoice.annulled",
      actor,
      message: `Anulada (registro ${record.chainIndex}). Motivo: ${reason}`,
      payload: { recordId: record.id, hash, reason },
    },
  });
  return record;
}

/** Evento del sistema de facturación. Solo inserta. */
export async function logInvoiceEvent(
  db: Tx | typeof prisma,
  input: { invoiceId?: string | null; type: string; actor?: string | null; message?: string | null; payload?: Prisma.InputJsonValue }
) {
  return db.invoiceEvent.create({
    data: { invoiceId: input.invoiceId ?? null, type: input.type, actor: input.actor ?? null, message: input.message ?? null, payload: input.payload },
  });
}

/** Estado VeriFactu de una factura para la UI y el PDF. */
export async function verifactuStateOf(invoiceId: string) {
  const rec = await prisma.invoiceRecord.findFirst({
    where: { invoiceId, kind: "ALTA" },
    select: { chainIndex: true, hash: true, sendStatus: true, acceptedAt: true, provider: true, emitterNif: true, numSerie: true, issueDate: true, importeTotalCents: true },
  });
  return rec;
}

/** Verifica la cadena entera de un emisor en BD. Devuelve el primer índice roto o -1. */
export async function verifyEmitterChain(emitterNif: string) {
  const { verifyChain } = await import("@/lib/verifactu/hash");
  const rows = await prisma.invoiceRecord.findMany({
    where: { emitterNif: emitterNif.toUpperCase() },
    orderBy: { chainIndex: "asc" },
    select: { canonical: true, hash: true, prevHash: true },
  });
  return { count: rows.length, brokenAt: verifyChain(rows) };
}

/** Remite a la AEAT (vía proveedor) los registros en cola. Sin proveedor: no hace nada. */
export async function flushPendingRecords(limit = 50) {
  const provider = safeProvider();
  if (!provider) return { sent: 0, skipped: "no-provider" as const };
  const pending = await prisma.invoiceRecord.findMany({
    where: { sendStatus: "PENDING" },
    orderBy: [{ emitterNif: "asc" }, { chainIndex: "asc" }],
    take: limit,
    include: { invoice: { select: { fiscalName: true, nif: true, country: true, lineItemsJson: true, vatRate: true, rectifiesNumber: true } } },
  });
  let sent = 0;
  for (const r of pending) {
    try {
      const res = await provider.send({
        kind: r.kind as "ALTA" | "ANULACION",
        emitterNif: r.emitterNif,
        numSerie: r.numSerie,
        issueDate: r.issueDate,
        invoiceType: r.invoiceType,
        cuotaTotalCents: r.cuotaTotalCents,
        importeTotalCents: r.importeTotalCents,
        hash: r.hash,
        prevHash: r.prevHash,
        generatedAtIso: r.generatedAtIso,
        recipient: { name: r.invoice.fiscalName, nif: r.invoice.nif, country: r.invoice.country },
      });
      await prisma.invoiceRecord.update({
        where: { id: r.id },
        data: {
          sendStatus: res.status,
          providerRef: res.providerRef ?? null,
          providerResponse: (res.response ?? null) as Prisma.InputJsonValue,
          sentAt: new Date(),
          acceptedAt: res.status.startsWith("ACCEPTED") ? new Date() : null,
        },
      });
      await logInvoiceEvent(prisma, { invoiceId: r.invoiceId, type: `record.${res.status.toLowerCase()}`, actor: "system", message: res.error || `Registro ${r.chainIndex} remitido (${res.status}).`, payload: { recordId: r.id, providerRef: res.providerRef ?? null } });
      sent++;
    } catch (e: any) {
      await logInvoiceEvent(prisma, { invoiceId: r.invoiceId, type: "record.send_failed", actor: "system", message: String(e?.message || e), payload: { recordId: r.id } });
    }
  }
  return { sent };
}

function safeProvider() {
  try {
    return getVerifactuProvider();
  } catch (e) {
    console.error("[verifactu] proveedor mal configurado:", (e as Error).message);
    return null;
  }
}
