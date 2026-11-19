import { Prisma, type PrismaClient } from "@prisma/client";
import { bloquearClaves, nuevaRefCaso } from "@/lib/caso/resolver-db";
import type { CasoFila, GateTx } from "./puerta.ts";
import type { ReadingExtras } from "./view.ts";
import { sessionKeyOf, type ArchivoRow, type EntradaEstado, type EntradaRow, type EntradaStore } from "./store.ts";
import type { Canal } from "./identidad.ts";

type EntradaRecord = Prisma.EntradaGetPayload<{}>;

const toEntrada = (r: EntradaRecord): EntradaRow => ({
  id: r.id, canal: r.canal as Canal, estado: r.estado as EntradaEstado, casoId: r.casoId, loteId: r.loteId, regla: r.regla, posibles: r.posibles,
  email: r.email, phone9: r.phone9, nombre: r.nombre, sourceLang: r.sourceLang, targetLang: r.targetLang, urgency: r.urgency, neededBy: r.neededBy,
  organismo: r.organismo, notas: r.notas, confirmedAt: r.confirmedAt, createdAt: r.createdAt, updatedAt: r.updatedAt,
});

export function prismaEntradaStore(db: PrismaClient): EntradaStore {
  return {
    async create(data) {
      return toEntrada(await db.entrada.create({ data: { ...data, estado: "abierta" } }));
    },
    async byTokenHash(tokenHash) {
      const r = await db.entrada.findUnique({ where: { tokenHash } });
      return r ? toEntrada(r) : null;
    },
    async get(id) {
      const r = await db.entrada.findUnique({ where: { id } });
      return r ? toEntrada(r) : null;
    },
    async files(entradaId) {
      const rows = await db.documentAnalysis.findMany({
        where: { sessionToken: sessionKeyOf(entradaId), fileHash: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, fileUrl: true, mimeType: true, fileSize: true, fileHash: true },
      });
      return rows.map((r): ArchivoRow => ({ id: r.id, name: r.fileName, url: r.fileUrl, mimeType: r.mimeType, size: r.fileSize, sha256: r.fileHash! }));
    },
    async addFile(e, f) {
      const r = await db.documentAnalysis.create({
        data: {
          fileName: f.name, fileUrl: f.url, fileSize: f.size, mimeType: f.mimeType, fileHash: f.sha256, sessionToken: sessionKeyOf(e.id), source: "puerta-v2",
          status: "UPLOADED", gdprConsent: true, gdprConsentAt: new Date(), clientEmail: e.email, clientName: e.nombre, clientPhone: e.phone9,
          ...(e.email ? { marketingConsent: true, marketingConsentAt: new Date() } : {}),
          ...(e.sourceLang ? { sourceLanguage: e.sourceLang } : {}),
          ...(e.targetLang ? { targetLanguage: e.targetLang } : {}),
          casoId: e.casoId,
        },
        select: { id: true },
      });
      return { id: r.id, ...f };
    },
    async removeFile(entradaId, fileId) {
      const r = await db.documentAnalysis.deleteMany({ where: { id: fileId, sessionToken: sessionKeyOf(entradaId), orderId: null } });
      return r.count === 1;
    },
    async update(id, patch, onlyIn) {
      const r = await db.entrada.updateMany({ where: { id, estado: { in: [...onlyIn] } }, data: patch });
      return r.count === 1;
    },
    async linkFilesToCaso(entradaId, casoId) {
      await db.documentAnalysis.updateMany({ where: { sessionToken: sessionKeyOf(entradaId), casoId: null }, data: { casoId } });
    },
  };
}

export function prismaGateTx(tx: Prisma.TransactionClient): GateTx {
  return {
    lock: (keys) => bloquearClaves(tx, keys),
    vecinosTelefono: (phone9) => tx.caso.findMany({ where: { phone9 }, select: { email: true, phone9: true, nombre: true }, take: 50 }),
    async candidatos(q) {
      const porHuella = new Set<string>(q.ids);
      if (q.hashes.length) {
        for (const d of await tx.documentAnalysis.findMany({ where: { fileHash: { in: q.hashes }, casoId: { not: null } }, select: { casoId: true } })) porHuella.add(d.casoId!);
        for (const a of await tx.lecturaArchivo.findMany({ where: { sha256: { in: q.hashes }, lote: { casoId: { not: null } } }, select: { lote: { select: { casoId: true } } } })) porHuella.add(a.lote.casoId!);
      }
      const casos = await tx.caso.findMany({
        where: {
          OR: [
            { id: { in: [...porHuella] } },
            { estado: "ABIERTO", lastActivityAt: { gte: q.vivosDesde }, OR: [{ email: { in: q.emails } }, { phone9: { in: q.phones } }, { nombre: { not: null } }] },
          ],
        },
        orderBy: { lastActivityAt: "desc" },
        take: 300,
        select: { id: true, ref: true, estado: true, email: true, phone9: true, nombre: true, esAgencia: true, lastActivityAt: true },
      });
      const ids = casos.map((c) => c.id);
      const known = new Map<string, Set<string>>();
      const add = (casoId: string | null, h: string | null) => {
        if (!casoId || !h) return;
        known.set(casoId, (known.get(casoId) ?? new Set()).add(h));
      };
      if (ids.length) {
        for (const d of await tx.documentAnalysis.findMany({ where: { casoId: { in: ids }, fileHash: { not: null } }, select: { casoId: true, fileHash: true } })) add(d.casoId, d.fileHash);
        for (const a of await tx.lecturaArchivo.findMany({ where: { sha256: { not: null }, lote: { casoId: { in: ids } } }, select: { sha256: true, lote: { select: { casoId: true } } } })) add(a.lote.casoId, a.sha256);
      }
      return casos.map((c): CasoFila => ({ ...c, hashes: [...(known.get(c.id) ?? [])] }));
    },
    async crear(d) {
      return tx.caso.create({
        data: { ref: nuevaRefCaso(), identityKey: d.identityKey, email: d.email, phone9: d.phone9, nombre: d.nombre, pares: [], origen: d.origen, dudoso: d.dudoso, lastActivityAt: d.ahora, createdBy: d.actor },
        select: { id: true, ref: true },
      });
    },
    async unir(id, p) {
      await tx.caso.update({
        where: { id },
        data: { lastActivityAt: p.ahora, ...(p.email ? { email: p.email } : {}), ...(p.phone9 ? { phone9: p.phone9 } : {}), ...(p.reabrir ? { estado: "ABIERTO", closedAt: null } : {}) },
      });
    },
    async evento(casoId, tipo, actor, payload) {
      await tx.casoEvento.create({ data: { casoId, tipo, actor, payload: payload as Prisma.InputJsonValue } });
    },
  };
}

type Media = { url?: unknown; size?: unknown };

export async function filesWithoutHash(db: PrismaClient, q: { sizes: number[]; desde: Date; limit: number }, own: (url: string) => boolean) {
  const sizes = new Set(q.sizes);
  const docs = await db.documentAnalysis.findMany({
    where: { fileHash: null, casoId: { not: null }, createdAt: { gte: q.desde }, OR: [{ fileSize: { in: q.sizes } }, { fileSize: 0 }] },
    orderBy: { createdAt: "desc" },
    take: q.limit,
    select: { casoId: true, fileUrl: true, fileSize: true },
  });
  const inbound = await db.inboundEmail.findMany({
    where: { casoId: { not: null }, receivedAt: { gte: q.desde }, mediaJson: { not: Prisma.AnyNull } },
    orderBy: { receivedAt: "desc" },
    take: 100,
    select: { casoId: true, mediaJson: true },
  });
  const rows: { casoId: string; url: string; sized: boolean }[] = [
    ...docs.map((d) => ({ casoId: d.casoId!, url: d.fileUrl, sized: sizes.has(d.fileSize) })),
    ...inbound.flatMap((m) =>
      (Array.isArray(m.mediaJson) ? (m.mediaJson as Media[]) : [])
        .filter((x) => typeof x?.url === "string" && (typeof x.size !== "number" || sizes.has(x.size)))
        .map((x) => ({ casoId: m.casoId!, url: x.url as string, sized: typeof x.size === "number" })),
    ),
  ];
  const seen = new Set<string>();
  return rows
    .filter((r) => own(r.url) && !seen.has(r.url) && Boolean(seen.add(r.url)))
    .sort((a, b) => Number(b.sized) - Number(a.sized))
    .slice(0, q.limit)
    .map(({ casoId, url }) => ({ casoId, url }));
}

type ReadingJson = {
  notToTranslate?: { parts?: { fileIndex: number; page: number }[]; reason?: string }[];
  duplicates?: { parts?: { fileIndex: number; page: number }[] }[];
  questions?: { textEs?: string }[];
  documents?: { id?: string; missingPages?: number[] }[];
};

export async function readingExtras(db: PrismaClient, loteId: string): Promise<ReadingExtras | null> {
  const r = await db.lecturaLote.findUnique({ where: { id: loteId }, select: { readingJson: true } });
  const j = (r?.readingJson ?? null) as ReadingJson | null;
  if (!j) return null;
  return {
    notToTranslate: (j.notToTranslate ?? []).map((n) => ({ parts: n.parts ?? [], reason: n.reason ?? "no hace falta traducirlo" })),
    duplicates: (j.duplicates ?? []).map((d) => ({ parts: d.parts ?? [] })),
    questions: (j.questions ?? []).map((q) => ({ textEs: q.textEs ?? "" })),
    missing: Object.fromEntries((j.documents ?? []).filter((d) => d.id && d.missingPages?.length).map((d) => [d.id!, d.missingPages!])),
  };
}

export async function reusableLote(db: PrismaClient, casoId: string, hashes: string[]): Promise<string | null> {
  const want = new Set(hashes);
  const lotes = await db.lecturaLote.findMany({
    where: { casoId, status: { in: ["ok", "confirmed"] } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, files: { where: { state: { in: ["ok", "duplicate"] } }, select: { sha256: true } } },
  });
  for (const l of lotes) {
    const have = new Set(l.files.map((f) => f.sha256).filter((s): s is string => Boolean(s)));
    if (have.size === want.size && [...want].every((h) => have.has(h))) return l.id;
  }
  return null;
}
