import type { Prisma, PrismaClient } from "@prisma/client";
import type { WorkingDocument } from "./documents.ts";
import { ActiveConflict, type FileRow, type LecturaStore, type LoteRow, type LoteStatus } from "./store.ts";

type Db = Pick<PrismaClient, "lecturaLote" | "lecturaArchivo" | "lecturaDocumento" | "$transaction">;
type Tx = Prisma.TransactionClient;

const json = (v: unknown) => (v === null || v === undefined ? undefined : (v as Prisma.InputJsonValue));

type LoteRecord = Prisma.LecturaLoteGetPayload<{}>;
type DocRecord = Prisma.LecturaDocumentoGetPayload<{}>;
type FileRecord = Prisma.LecturaArchivoGetPayload<{}>;

function toLote(r: LoteRecord): LoteRow {
  return {
    id: r.id, fingerprint: r.fingerprint, activeKey: r.activeKey, status: r.status as LoteStatus, busyAttempts: r.busyAttempts,
    casoId: r.casoId, sessionKey: r.sessionKey, quoteId: r.quoteId, targetLang: r.targetLang, targetLangBasis: r.targetLangBasis,
    promptVersion: r.promptVersion, clean: r.clean, reasons: r.reasonsJson, detailEs: r.detailEs, createdBy: r.createdBy,
    confirmedBy: r.confirmedBy, confirmedAt: r.confirmedAt, lines: r.linesJson, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

function toDoc(r: DocRecord): WorkingDocument {
  return {
    id: r.id, position: r.position, docKey: r.docKey, type: r.type, category: r.category, typeLabelEs: r.typeLabelEs, holder: r.holder,
    sourceLang: r.sourceLang, parts: r.parts as WorkingDocument["parts"], annexes: r.annexes as WorkingDocument["annexes"],
    apostille: (r.apostille ?? null) as WorkingDocument["apostille"], pageCount: r.pageCount, words: r.words,
    wordsBasis: r.wordsBasis === "exact" ? "exact" : "estimated", estimatedWords: r.estimatedWords, legibility: r.legibility,
    confidence: r.confidence, isBilingualDuplicate: r.isBilingualDuplicate, reasons: r.reasonsJson as WorkingDocument["reasons"],
    included: r.included, excludedReason: r.excludedReason, manualPriceCents: r.manualPriceCents, manualCostCents: r.manualCostCents, editedBy: r.editedBy,
  };
}

const toFile = (r: FileRecord): FileRow => ({
  position: r.position, name: r.name, url: r.url, sha256: r.sha256, pageCount: r.pageCount, state: r.state as FileRow["state"], reasonEs: r.reasonEs,
});

const docData = (loteId: string, d: WorkingDocument): Prisma.LecturaDocumentoCreateManyInput => ({
  id: d.id, loteId, position: d.position, docKey: d.docKey, type: String(d.type), category: d.category, typeLabelEs: d.typeLabelEs,
  holder: d.holder, sourceLang: d.sourceLang, parts: d.parts as Prisma.InputJsonValue, annexes: d.annexes as Prisma.InputJsonValue,
  apostille: json(d.apostille), pageCount: d.pageCount, words: d.words, wordsBasis: d.wordsBasis, estimatedWords: d.estimatedWords,
  legibility: d.legibility, confidence: d.confidence, isBilingualDuplicate: d.isBilingualDuplicate, reasonsJson: d.reasons as Prisma.InputJsonValue,
  included: d.included, excludedReason: d.excludedReason, manualPriceCents: d.manualPriceCents, manualCostCents: d.manualCostCents, editedBy: d.editedBy,
});

const fileData = (loteId: string, f: FileRow): Prisma.LecturaArchivoCreateManyInput => ({
  loteId, position: f.position, name: f.name.slice(0, 255), url: f.url, sha256: f.sha256, pageCount: f.pageCount, state: f.state, reasonEs: f.reasonEs,
});

async function replaceFiles(tx: Tx, loteId: string, files: FileRow[]) {
  await tx.lecturaArchivo.deleteMany({ where: { loteId } });
  if (files.length) await tx.lecturaArchivo.createMany({ data: files.map((f) => fileData(loteId, f)) });
}

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === "P2002";

export function prismaLecturaStore(db: Db): LecturaStore {
  return {
    async findActive(fingerprint) {
      const r = await db.lecturaLote.findUnique({ where: { activeKey: fingerprint } });
      return r ? toLote(r) : null;
    },
    async findLatestDone(fingerprint) {
      const r = await db.lecturaLote.findFirst({ where: { fingerprint, activeKey: null }, orderBy: { createdAt: "desc" } });
      return r ? toLote(r) : null;
    },
    async createRunning(input) {
      try {
        const r = await db.lecturaLote.create({
          data: { ...input, activeKey: input.fingerprint, status: "running", busyAttempts: 0 },
        });
        return toLote(r);
      } catch (err) {
        if (isUniqueViolation(err)) throw new ActiveConflict("lectura en curso para esta huella");
        throw err;
      }
    },
    async claim(id, staleBefore) {
      const r = await db.lecturaLote.updateMany({
        where: { id, activeKey: { not: null }, OR: [{ status: "busy" }, { status: "running", updatedAt: { lt: staleBefore } }] },
        data: { status: "running" },
      });
      return r.count === 1;
    },
    async markBusy(id, attempts, files, detailEs) {
      await db.$transaction(async (tx) => {
        await tx.lecturaLote.update({ where: { id }, data: { status: "busy", busyAttempts: attempts, detailEs } });
        await replaceFiles(tx, id, files);
      });
    },
    async finish(id, o) {
      await db.$transaction(async (tx) => {
        await tx.lecturaLote.update({
          where: { id },
          data: {
            status: o.status, activeKey: null, targetLang: o.targetLang ?? undefined, targetLangBasis: o.targetLangBasis, clean: o.clean,
            reasonsJson: json(o.reasons), readingJson: json(o.reading), detailEs: o.detailEs, costJson: json(o.cost),
          },
        });
        await replaceFiles(tx, id, o.files);
        await tx.lecturaDocumento.deleteMany({ where: { loteId: id } });
        if (o.documents.length) await tx.lecturaDocumento.createMany({ data: o.documents.map((d) => docData(id, d)) });
      });
    },
    async get(id) {
      const r = await db.lecturaLote.findUnique({
        where: { id },
        include: { files: { orderBy: [{ position: "asc" }, { name: "asc" }] }, documents: { orderBy: { position: "asc" } } },
      });
      if (!r) return null;
      return { lote: toLote(r), files: r.files.map(toFile), documents: r.documents.map(toDoc) };
    },
    async replaceDocuments(id, documents) {
      return db.$transaction(async (tx) => {
        const open = await tx.lecturaLote.updateMany({ where: { id, status: "ok" }, data: { updatedAt: new Date() } });
        if (open.count !== 1) return false;
        await tx.lecturaDocumento.deleteMany({ where: { loteId: id } });
        if (documents.length) await tx.lecturaDocumento.createMany({ data: documents.map((d) => docData(id, d)) });
        return true;
      });
    },
    async confirm(id, by, lines, seenUpdatedAt) {
      const r = await db.lecturaLote.updateMany({
        where: { id, status: "ok", updatedAt: seenUpdatedAt },
        data: { status: "confirmed", confirmedBy: by, confirmedAt: new Date(), linesJson: json(lines) },
      });
      return r.count === 1;
    },
    async setTargetLang(id, targetLang) {
      const r = await db.lecturaLote.updateMany({ where: { id, status: "ok" }, data: { targetLang } });
      return r.count === 1;
    },
    async linkQuote(id, quoteId) {
      const r = await db.lecturaLote.updateMany({ where: { id, status: "confirmed", quoteId: null }, data: { quoteId } });
      return r.count === 1;
    },
  };
}
