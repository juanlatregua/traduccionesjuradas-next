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
import { altaHash, anulacionHash, anulacionMustWait, anulacionSinRegistroPrevio, formatGeneratedAt, formatIssueDate, shouldChain, subsanacionFlags, unresolvedRejected, type InvoiceType } from "@/lib/verifactu/hash";
import { getVerifactuProvider, verifactuEnv, type ProviderSendInput, type ProviderSendResult, type VerifactuProvider } from "@/lib/verifactu/provider";
import { AeatDataError, MAX_RECORDS_PER_BATCH, registroXml, reviewReasonOf, validateAltaData } from "@/lib/verifactu/aeat-xml";
import { alertVerifactuProblem } from "@/lib/verifactu/alerts";
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

// Modo cadena: con proveedor activo, o si el emisor YA tiene algún registro no-LOCAL (aunque la
// variable de entorno falte: rollback, errata). Nunca más LOCAL tras el primer no-LOCAL.
async function chainModeFor(tx: Tx, emitterNif: string) {
  const provider = safeProvider();
  const sent = await tx.invoiceRecord.findFirst({ where: { emitterNif, sendStatus: { not: "LOCAL" } }, orderBy: { chainIndex: "desc" }, select: { provider: true } });
  const chained = shouldChain(Boolean(provider), Boolean(sent));
  if (chained && !provider) {
    // Sin invoiceId: esta transacción aún no ha confirmado la factura y el evento la referenciaría.
    void alertVerifactuProblem({
      recordId: `no-provider:${emitterNif}:${new Date().toISOString().slice(0, 10)}`,
      invoiceId: null,
      numSerie: emitterNif,
      kind: "no_provider",
      detail: "Hay registros VeriFactu pendientes de enviar pero el proveedor no está configurado (VERIFACTU_PROVIDER / VERIFACTU_ENV). Se crean como PENDING y no se envían hasta restaurarlo.",
    });
  }
  return { chained, providerName: provider?.name ?? sent?.provider ?? null };
}

// chainIndex sigue correlativo por emisor (unique). El registro anterior para encadenar es el
// último del emisor; en modo cadena, el último que NO sea LOCAL: los LOCAL son histórico interno
// anterior a la activación y no se envían nunca (corte de cadena).
async function lastRecord(tx: Tx, emitterNif: string, chained: boolean) {
  const last = await tx.invoiceRecord.findFirst({
    where: { emitterNif },
    orderBy: { chainIndex: "desc" },
    select: { chainIndex: true, hash: true },
  });
  const prev = chained
    ? await tx.invoiceRecord.findFirst({
        where: { emitterNif, sendStatus: { not: "LOCAL" } },
        orderBy: { chainIndex: "desc" },
        select: { hash: true },
      })
    : last;
  return { chainIndex: last?.chainIndex ?? 0, hash: prev?.hash ?? null };
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
    rectifiesNumber?: string | null;
    fiscalName?: string | null;
    nif?: string | null;
    country?: string | null;
    vatRate?: number | null;
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
  const mode = await chainModeFor(tx, emitterNif);
  const prev = await lastRecord(tx, emitterNif, mode.chained);
  const generatedAt = new Date();
  const generatedAtIso = formatGeneratedAt(generatedAt);
  const invoiceType = invoiceTypeFor(invoice);
  // Con envío a la AEAT activo, una factura que la AEAT no podría registrar NO se emite:
  // la validación es la misma que usa el XML, y el staff ve el motivo.
  if (mode.chained) {
    try {
      validateAltaData({
        invoiceType,
        vatRate: invoice.vatRate,
        recipient: { name: invoice.fiscalName ?? "", nif: invoice.nif, country: invoice.country },
        hasRectified: Boolean(invoice.rectifiesId && invoice.rectifiesNumber),
      });
    } catch (e: any) {
      if (e instanceof AeatDataError) throw new Error(`No se puede emitir ${invoice.number}: ${e.message}`);
      throw e;
    }
  }
  const { canonical, hash } = altaHash({
    emitterNif,
    numSerie: invoice.number,
    issueDate: invoice.issuedAt,
    invoiceType,
    cuotaTotalCents: invoice.vatCents,
    importeTotalCents: invoice.totalCents,
    prevHash: prev.hash,
    generatedAt: generatedAtIso,
  });
  const record = await tx.invoiceRecord.create({
    data: {
      invoiceId: invoice.id,
      kind: "ALTA",
      emitterNif,
      chainIndex: prev.chainIndex + 1,
      numSerie: invoice.number,
      issueDate: formatIssueDate(invoice.issuedAt),
      invoiceType,
      cuotaTotalCents: invoice.vatCents,
      importeTotalCents: invoice.totalCents,
      prevHash: prev.hash,
      hash,
      canonical,
      generatedAt,
      generatedAtIso,
      sendStatus: mode.chained ? "PENDING" : "LOCAL",
      provider: mode.providerName,
    },
  });
  await tx.clientInvoice.update({ where: { id: invoice.id }, data: { emitterNif, invoiceType } });
  await tx.invoiceEvent.create({
    data: {
      invoiceId: invoice.id,
      type: "record.alta",
      actor,
      message: `Registro de alta ${record.chainIndex} del emisor ${emitterNif}: ${invoice.number}, ${invoiceType}, huella ${hash.slice(0, 12)}…`,
      payload: { recordId: record.id, chainIndex: record.chainIndex, hash, prevHash: prev.hash, sendStatus: record.sendStatus },
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
  const existing = await tx.invoiceRecord.findFirst({ where: { invoiceId: invoice.id, kind: "ANULACION" }, orderBy: { chainIndex: "desc" }, select: { id: true, sendStatus: true } });
  if (existing && existing.sendStatus !== "REJECTED") return existing;
  const emitterNif = emitterNifFor(invoice);
  await lockEmitter(tx, emitterNif);
  const mode = await chainModeFor(tx, emitterNif);
  const prev = await lastRecord(tx, emitterNif, mode.chained);
  const generatedAt = new Date();
  const generatedAtIso = formatGeneratedAt(generatedAt);
  const { canonical, hash } = anulacionHash({
    emitterNif,
    numSerie: invoice.number,
    issueDate: invoice.issuedAt,
    prevHash: prev.hash,
    generatedAt: generatedAtIso,
  });
  const record = await tx.invoiceRecord.create({
    data: {
      invoiceId: invoice.id,
      kind: "ANULACION",
      emitterNif,
      chainIndex: prev.chainIndex + 1,
      numSerie: invoice.number,
      issueDate: formatIssueDate(invoice.issuedAt),
      invoiceType: "",
      cuotaTotalCents: 0,
      importeTotalCents: 0,
      prevHash: prev.hash,
      hash,
      canonical,
      generatedAt,
      generatedAtIso,
      sendStatus: mode.chained ? "PENDING" : "LOCAL",
      provider: mode.providerName,
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
    orderBy: { chainIndex: "desc" },
    select: { chainIndex: true, hash: true, sendStatus: true, acceptedAt: true, provider: true, emitterNif: true, numSerie: true, issueDate: true, importeTotalCents: true },
  });
  return rec;
}

/** Verifica la cadena entera de un emisor en BD (con el corte de activación). Devuelve el primer índice roto o -1. */
export async function verifyEmitterChain(emitterNif: string) {
  const { verifyChainWithCut } = await import("@/lib/verifactu/hash");
  const rows = await prisma.invoiceRecord.findMany({
    where: { emitterNif: emitterNif.toUpperCase() },
    orderBy: { chainIndex: "asc" },
    select: { canonical: true, hash: true, prevHash: true, sendStatus: true },
  });
  return { count: rows.length, brokenAt: verifyChainWithCut(rows) };
}

const DEFAULT_WAIT_SECONDS = 60;
class DeferredRecord extends Error {}

type PendingRow = Prisma.InvoiceRecordGetPayload<{
  include: { invoice: { select: { fiscalName: true; nif: true; country: true; vatRate: true; rectifiesId: true } } };
}>;

/** Datos para el proveedor: registro anterior de la cadena, rectificada y anulación sin alta enviada. */
async function toSendInput(r: PendingRow): Promise<ProviderSendInput> {
  const prevRec = r.prevHash ? await prisma.invoiceRecord.findUnique({ where: { hash: r.prevHash }, select: { emitterNif: true, numSerie: true, issueDate: true } }) : null;
  if (r.prevHash && !prevRec) throw new AeatDataError("No se encuentra en BD el registro anterior de la cadena.");
  let rectifies: ProviderSendInput["rectifies"] = null;
  if (r.invoiceType.startsWith("R") && r.invoice.rectifiesId) {
    const orig = await prisma.clientInvoice.findUnique({ where: { id: r.invoice.rectifiesId }, select: { number: true, issuedAt: true } });
    if (orig?.number && orig.issuedAt) rectifies = { numSerie: orig.number, issueDate: formatIssueDate(orig.issuedAt) };
  }
  let sinRegistroPrevio = false;
  let flags = { subsanacion: false, rechazoPrevio: false };
  if (r.kind === "ANULACION") {
    const altas = await prisma.invoiceRecord.findMany({ where: { invoiceId: r.invoiceId, kind: "ALTA" }, select: { sendStatus: true } });
    if (anulacionMustWait(altas.map((a) => a.sendStatus))) throw new DeferredRecord(`Anulación de ${r.numSerie} a la espera de que se confirme su alta.`);
    sinRegistroPrevio = anulacionSinRegistroPrevio(altas.map((a) => a.sendStatus));
  } else {
    const earlier = await prisma.invoiceRecord.findMany({ where: { invoiceId: r.invoiceId, kind: "ALTA", chainIndex: { lt: r.chainIndex } }, select: { sendStatus: true } });
    flags = subsanacionFlags(earlier.map((a) => a.sendStatus));
  }
  return {
    recordId: r.id,
    kind: r.kind as "ALTA" | "ANULACION",
    emitterNif: r.emitterNif,
    numSerie: r.numSerie,
    issueDate: r.issueDate,
    invoiceType: r.invoiceType,
    cuotaTotalCents: r.cuotaTotalCents,
    importeTotalCents: r.importeTotalCents,
    vatRate: r.invoice.vatRate,
    hash: r.hash,
    prevHash: r.prevHash,
    prev: prevRec,
    generatedAtIso: r.generatedAtIso,
    recipient: r.invoiceType === "F2" || r.invoiceType === "R5" ? null : { name: r.invoice.fiscalName, nif: r.invoice.nif, country: r.invoice.country },
    rectifies,
    sinRegistroPrevio,
    ...flags,
  };
}

async function markResult(r: PendingRow, res: ProviderSendResult, provider: string, extra?: Record<string, unknown>) {
  const accepted = res.status.startsWith("ACCEPTED");
  // El entorno queda guardado: un registro aceptado en pruebas no da QR en producción (ni al revés).
  const response = { ...((res.response as object) ?? {}), entorno: verifactuEnv(), ...extra };
  await prisma.invoiceRecord.update({
    where: { id: r.id },
    data: {
      sendStatus: res.status,
      provider,
      providerRef: res.providerRef ?? null,
      providerResponse: response as Prisma.InputJsonValue,
      sentAt: new Date(),
      acceptedAt: accepted ? new Date() : null,
    },
  });
  await logInvoiceEvent(prisma, {
    invoiceId: r.invoiceId,
    type: `record.${res.status.toLowerCase()}`,
    actor: "system",
    message: res.error || `Registro ${r.chainIndex} remitido (${res.status}).`,
    payload: { recordId: r.id, providerRef: res.providerRef ?? null },
  });
  if (res.status === "REJECTED") {
    await alertVerifactuProblem({ recordId: r.id, invoiceId: r.invoiceId, numSerie: r.numSerie, kind: "rejected", detail: res.error || "Rechazado sin detalle." });
  }
}

/** Segundos que faltan para poder volver a enviar (TiempoEsperaEnvio del último envío del emisor). */
async function secondsToWait(emitterNif: string, now: Date): Promise<number> {
  const lastSent = await prisma.invoiceRecord.findFirst({
    where: { emitterNif, sentAt: { not: null }, provider: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true, providerResponse: true },
  });
  if (!lastSent?.sentAt) return 0;
  const t = Number((lastSent.providerResponse as any)?.tiempoEsperaEnvio);
  const wait = Number.isFinite(t) && t >= 0 ? t : DEFAULT_WAIT_SECONDS;
  return Math.max(0, Math.ceil((lastSent.sentAt.getTime() + wait * 1000 - now.getTime()) / 1000));
}

/**
 * Remite a la AEAT (vía proveedor) los registros en cola. Sin proveedor no envía, pero si hay
 * registros en cola avisa. Un único flush a la vez (cerrojo de Postgres); con sendBatch (proveedor
 * «aeat») hace un envío por emisor y ejecución, en orden de cadena, respetando el TiempoEsperaEnvio
 * y sin saltarse un registro rechazado sin resolver o no enviable.
 */
export async function flushPendingRecords(limit = 50) {
  return prisma.$transaction(
    async (tx) => {
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext('verifactu-flush')) AS locked`;
      if (!locked) return { sent: 0, skipped: "locked" as const };
      return flushLocked(limit);
    },
    { timeout: 120_000, maxWait: 5_000 }
  );
}

async function flushLocked(limit: number) {
  const provider = safeProvider();
  if (!provider) {
    const queued = await prisma.invoiceRecord.findMany({ where: { sendStatus: "PENDING" }, select: { emitterNif: true }, distinct: ["emitterNif"] });
    for (const q of queued) {
      await alertVerifactuProblem({
        recordId: `no-provider:${q.emitterNif}:${new Date().toISOString().slice(0, 10)}`,
        invoiceId: null,
        numSerie: q.emitterNif,
        kind: "no_provider",
        detail: "Hay registros VeriFactu en cola y el proveedor no está configurado (VERIFACTU_PROVIDER / VERIFACTU_ENV).",
      });
    }
    return { sent: 0, skipped: "no-provider" as const };
  }
  const pending = await prisma.invoiceRecord.findMany({
    where: { sendStatus: "PENDING" },
    orderBy: [{ emitterNif: "asc" }, { chainIndex: "asc" }],
    take: limit,
    include: { invoice: { select: { fiscalName: true, nif: true, country: true, vatRate: true, rectifiesId: true } } },
  });
  if (!provider.sendBatch) return { sent: await flushOneByOne(provider, pending) };

  const byEmitter = new Map<string, PendingRow[]>();
  for (const r of pending) byEmitter.set(r.emitterNif, [...(byEmitter.get(r.emitterNif) ?? []), r]);
  let sent = 0;
  const notes: string[] = [];
  for (const [nif, rows] of Array.from(byEmitter)) {
    const rejected = await prisma.invoiceRecord.findMany({ where: { emitterNif: nif, sendStatus: "REJECTED", chainIndex: { lt: rows[0].chainIndex } }, select: { invoiceId: true, chainIndex: true, numSerie: true, kind: true } });
    const later = rejected.length ? await prisma.invoiceRecord.findMany({ where: { invoiceId: { in: rejected.map((x) => x.invoiceId) } }, select: { invoiceId: true, chainIndex: true, kind: true } }) : [];
    const blocked = unresolvedRejected(rejected, later)[0];
    if (blocked) {
      notes.push(`${nif}: cadena bloqueada por el registro rechazado ${blocked.numSerie} (corrige los datos y reenvía: subsanación del alta o nueva anulación)`);
      continue;
    }
    const wait = await secondsToWait(nif, new Date());
    if (wait > 0) {
      notes.push(`${nif}: esperar ${wait}s (TiempoEsperaEnvio)`);
      continue;
    }
    const batch: PendingRow[] = [];
    const inputs: ProviderSendInput[] = [];
    for (const r of rows.slice(0, MAX_RECORDS_PER_BATCH)) {
      try {
        const input = await toSendInput(r);
        const review = reviewReasonOf(input);
        if (review) throw new AeatDataError(`REVISAR, no se envía: ${review}.`);
        registroXml(input); // un dato imposible se detecta aquí, no en la AEAT
        inputs.push(input);
        batch.push(r);
      } catch (e: any) {
        if (e instanceof DeferredRecord) {
          notes.push(e.message);
          break;
        }
        if (!(e instanceof AeatDataError)) throw e;
        const msg = String(e.message);
        await logInvoiceEvent(prisma, { invoiceId: r.invoiceId, type: "record.build_error", actor: "system", message: msg, payload: { recordId: r.id } });
        await alertVerifactuProblem({ recordId: r.id, invoiceId: r.invoiceId, numSerie: r.numSerie, kind: "build_error", detail: msg });
        notes.push(`${r.numSerie}: ${msg}`);
        break; // los siguientes dependen de su huella: no se envían saltándolo
      }
    }
    if (!batch.length) continue;
    try {
      const out = await provider.sendBatch(inputs);
      for (let i = 0; i < batch.length; i++) {
        await markResult(batch[i], out.results[i], provider.name, { tiempoEsperaEnvio: out.waitSeconds ?? null });
        sent++;
      }
    } catch (e: any) {
      const msg = String(e?.message || e);
      for (const r of batch) {
        await logInvoiceEvent(prisma, { invoiceId: r.invoiceId, type: "record.send_failed", actor: "system", message: msg, payload: { recordId: r.id } });
      }
      // UN aviso por emisor y episodio de fallo (clave = primer registro del lote), no uno por registro.
      await alertVerifactuProblem({
        recordId: batch[0].id,
        invoiceId: batch[0].invoiceId,
        numSerie: batch[0].numSerie,
        kind: "send_failed",
        detail: `${batch.length} registro(s) del emisor ${nif} sin enviar. ${msg}`,
      });
      notes.push(`${nif}: envío fallido: ${msg.slice(0, 200)}`);
    }
  }
  return { sent, notes };
}

/** Proveedores sin envío en lote: un registro por llamada (comportamiento original). */
async function flushOneByOne(provider: VerifactuProvider, pending: PendingRow[]) {
  let sent = 0;
  for (const r of pending) {
    try {
      const input = await toSendInput(r);
      const review = reviewReasonOf(input);
      if (review) throw new AeatDataError(`REVISAR, no se envía: ${review}.`);
      const res = await provider.send(input);
      await markResult(r, res, provider.name);
      sent++;
    } catch (e: any) {
      if (e instanceof DeferredRecord) break;
      const msg = String(e?.message || e);
      await logInvoiceEvent(prisma, { invoiceId: r.invoiceId, type: "record.send_failed", actor: "system", message: msg, payload: { recordId: r.id } });
      await alertVerifactuProblem({ recordId: r.id, invoiceId: r.invoiceId, numSerie: r.numSerie, kind: "send_failed", detail: msg });
    }
  }
  return sent;
}

/**
 * «Reenviar como subsanación»: corrige un alta RECHAZADA (Subsanacion=S + RechazoPrevio=X) o ACEPTADA CON ERRORES
 * (Subsanacion=S). Según la doc de la AEAT el registro original no se modifica: se genera uno NUEVO con huella
 * propia, FechaHoraHusoGenRegistro nueva y encadenado con el registro inmediatamente anterior de la cadena.
 * Los datos del destinatario se corrigen antes en la factura. Una anulación RECHAZADA se reintenta con un registro de anulación nuevo. Si el registro sigue PENDING por un build_error,
 * no hace falta registro nuevo (la huella no depende de esos datos): se reenvía solo en el próximo ciclo.
 */
export async function resubmitAsSubsanacion(invoiceId: string, actor: string): Promise<{ mode: "subsanacion" | "retry" | "anulacion"; recordId: string; message: string }> {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.clientInvoice.findUnique({ where: { id: invoiceId } });
    if (!inv || inv.status !== "ISSUED" || !inv.number || !inv.issuedAt) throw new Error("Solo se subsana una factura emitida.");
    if (!safeProvider()) throw new Error("No hay proveedor VeriFactu configurado.");
    const emitterNif = emitterNifFor(inv);
    await lockEmitter(tx, emitterNif);
    if (inv.annulledAt) {
      const anul = await tx.invoiceRecord.findFirst({ where: { invoiceId, kind: "ANULACION" }, orderBy: { chainIndex: "desc" }, select: { sendStatus: true } });
      if (anul?.sendStatus !== "REJECTED") throw new Error("La factura está anulada.");
      const rec = await createAnulacionRecord(tx, inv, actor, "Reintento tras el rechazo de la anulación por la AEAT");
      return { mode: "anulacion" as const, recordId: rec.id, message: "Nueva anulación en cola tras el rechazo anterior." };
    }
    const latest = await tx.invoiceRecord.findFirst({ where: { invoiceId, kind: "ALTA" }, orderBy: { chainIndex: "desc" } });
    if (!latest) throw new Error("La factura no tiene registro de alta.");
    if (latest.sendStatus === "PENDING") {
      const failed = await tx.invoiceEvent.findFirst({ where: { invoiceId, type: "record.build_error", payload: { path: ["recordId"], equals: latest.id } }, select: { id: true } });
      if (!failed) throw new Error("El registro ya está en cola para enviarse.");
      await tx.invoiceEvent.create({ data: { invoiceId, type: "record.retry", actor, message: "Datos corregidos: se reenviará en el próximo ciclo.", payload: { recordId: latest.id } } });
      return { mode: "retry" as const, recordId: latest.id, message: "Se reenviará en el próximo ciclo del cron." };
    }
    if (latest.sendStatus !== "REJECTED" && latest.sendStatus !== "ACCEPTED_WITH_ERRORS") {
      throw new Error(`Solo se subsana un registro rechazado o aceptado con errores (estado actual: ${latest.sendStatus}).`);
    }
    const mode = await chainModeFor(tx, emitterNif);
    if (!mode.chained) throw new Error("Modo cadena inactivo.");
    try {
      validateAltaData({ invoiceType: latest.invoiceType, vatRate: inv.vatRate, recipient: { name: inv.fiscalName, nif: inv.nif, country: inv.country }, hasRectified: Boolean(inv.rectifiesId && inv.rectifiesNumber) });
    } catch (e: any) {
      if (e instanceof AeatDataError) throw new Error(`No se puede subsanar ${inv.number}: ${e.message}`);
      throw e;
    }
    const prev = await lastRecord(tx, emitterNif, true);
    const generatedAt = new Date();
    const generatedAtIso = formatGeneratedAt(generatedAt);
    const { canonical, hash } = altaHash({
      emitterNif,
      numSerie: latest.numSerie,
      issueDate: latest.issueDate,
      invoiceType: latest.invoiceType as InvoiceType,
      cuotaTotalCents: latest.cuotaTotalCents,
      importeTotalCents: latest.importeTotalCents,
      prevHash: prev.hash,
      generatedAt: generatedAtIso,
    });
    const record = await tx.invoiceRecord.create({
      data: {
        invoiceId,
        kind: "ALTA",
        emitterNif,
        chainIndex: prev.chainIndex + 1,
        numSerie: latest.numSerie,
        issueDate: latest.issueDate,
        invoiceType: latest.invoiceType,
        cuotaTotalCents: latest.cuotaTotalCents,
        importeTotalCents: latest.importeTotalCents,
        prevHash: prev.hash,
        hash,
        canonical,
        generatedAt,
        generatedAtIso,
        sendStatus: "PENDING",
        provider: mode.providerName,
      },
    });
    await tx.invoiceEvent.create({
      data: {
        invoiceId,
        type: "record.subsanacion",
        actor,
        message: `Subsanación de ${latest.numSerie} (registro ${record.chainIndex}) tras ${latest.sendStatus}.`,
        payload: { recordId: record.id, previousRecordId: latest.id, hash, prevHash: prev.hash },
      },
    });
    return { mode: "subsanacion" as const, recordId: record.id, message: `Registro de subsanación ${record.chainIndex} en cola.` };
  });
}

function safeProvider() {
  try {
    return getVerifactuProvider();
  } catch (e) {
    console.error("[verifactu] proveedor mal configurado:", (e as Error).message);
    return null;
  }
}
