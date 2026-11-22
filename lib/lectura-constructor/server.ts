import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { isOwnBlobUrl } from "@/lib/q-journey";
import { DEFAULT_LIMITS, readBatch } from "@/lib/lectura/index.ts";
import type { ApiDeps } from "./api.ts";
import { explicitRssCeilingMb, lecturaConstructorOn } from "./flag.ts";
import { prismaLecturaStore } from "./prisma-store.ts";
import { startReading, type SourceRef, type StartDeps } from "./run.ts";
import type { LoteSource } from "./store.ts";
import { REGULARIZACION_SOURCE } from "../entrada/fr-auto.ts";

const MAX_FILES = DEFAULT_LIMITS.maxFiles;
const MAX_BYTES = DEFAULT_LIMITS.maxRequestBytes;

export const lecturaStore = prismaLecturaStore(prisma);

/** Lote of an entrada that came with ?p=regularizacion-2026 (its source). */
export async function regularizationOfSession(sessionKey: string | null): Promise<boolean> {
  if (!sessionKey?.startsWith("entrada:")) return false;
  const e = await prisma.entrada.findUnique({ where: { id: sessionKey.slice("entrada:".length) }, select: { source: true } });
  return e?.source === REGULARIZACION_SOURCE;
}

const fromUrl = (url: string) => decodeURIComponent(url.split("?")[0].split("/").pop() || "documento");

export async function filesOfSource(source: LoteSource): Promise<SourceRef[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  let rows: SourceRef[] = [];
  if (source.casoId || source.sessionKey) {
    const docs = await prisma.documentAnalysis.findMany({
      where: source.casoId ? { casoId: source.casoId } : { sessionToken: source.sessionKey! },
      orderBy: { createdAt: "asc" },
      select: { fileName: true, fileUrl: true, mimeType: true },
    });
    rows = docs.map((d) => ({ name: d.fileName, url: d.fileUrl, mimeType: d.mimeType }));
  } else if (source.quoteId) {
    const lines = await prisma.quoteLine.findMany({
      where: { quoteId: source.quoteId, sourceFileUrl: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { sourceFileUrl: true },
    });
    rows = lines.map((l) => ({ name: fromUrl(l.sourceFileUrl!), url: l.sourceFileUrl!, mimeType: null }));
  }
  const seen = new Set<string>();
  return rows.filter((r) => isOwnBlobUrl(r.url, token) && !seen.has(r.url) && Boolean(seen.add(r.url))).slice(0, MAX_FILES);
}

export async function download(ref: SourceRef): Promise<Uint8Array> {
  if (!isOwnBlobUrl(ref.url, process.env.BLOB_READ_WRITE_TOKEN)) throw new Error(`«${ref.name}» no está en nuestro almacén`);
  const res = await fetch(ref.url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`«${ref.name}»: HTTP ${res.status}`);
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error(`«${ref.name}» pasa de ${MAX_BYTES / 1024 / 1024} MB`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error(`«${ref.name}» pasa de ${MAX_BYTES / 1024 / 1024} MB`);
  return bytes;
}

export const startDeps: StartDeps = {
  store: lecturaStore,
  listFiles: filesOfSource,
  download,
  read: (files, context, { attempt }) => {
    const ceiling = explicitRssCeilingMb();
    if (ceiling === null) throw new Error("falta LECTURA_RSS_CEILING_MB");
    return readBatch(files, context, { attempt, limits: { ...DEFAULT_LIMITS, rssCeilingMb: ceiling } });
  },
  now: () => new Date(),
  newId: randomUUID,
};

export const apiDeps: ApiDeps = {
  enabled: () => lecturaConstructorOn(),
  auth: requireStaffAccess,
  rateLimit: (key, limit, windowMs) => checkRateLimit({ key, limit, windowMs }),
  store: lecturaStore,
  start: (input) => startReading(startDeps, input),
  regularization: regularizationOfSession,
  readyToRead: () =>
    explicitRssCeilingMb() === null
      ? "La lectura no está configurada en este servidor (falta LECTURA_RSS_CEILING_MB)."
      : !process.env.ANTHROPIC_API_KEY
        ? "Falta ANTHROPIC_API_KEY."
        : null,
  findQuote: (quoteId) =>
    prisma.quote.findFirst({ where: { id: quoteId, deletedAt: null }, select: { id: true, casoId: true, sourceLang: true, targetLang: true } }),
  newId: randomUUID,
};
