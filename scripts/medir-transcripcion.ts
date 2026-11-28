// Solo lectura: compara la estimación guardada de un LecturaLote con la transcripción completa (LECTURA_TRANSCRIBIR).
//   npx tsx --env-file=.env.local scripts/medir-transcripcion.ts            → lotes de los últimos 10 días con palabras estimadas
//   npx tsx --env-file=.env.local scripts/medir-transcripcion.ts <loteId>…  → tabla estimado vs transcrito por documento
import { PrismaClient } from "@prisma/client";
import { prepareBatch, DEFAULT_LIMITS } from "../lib/lectura/prepare.ts";
import { transcribeDocuments } from "../lib/lectura/transcribe.ts";
import { costOf } from "../lib/lectura/cost.ts";
import type { ReadDocument } from "../lib/lectura/index.ts";
import type { Part, ReadDocumentRaw } from "../lib/lectura/schema.ts";

const prisma = new PrismaClient();

async function listar() {
  const docs = await prisma.lecturaDocumento.findMany({
    where: { wordsBasis: "estimated", createdAt: { gte: new Date(Date.now() - 10 * 864e5) } },
    select: { loteId: true, type: true, pageCount: true, words: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  for (const d of docs) console.log(`${d.createdAt.toISOString().slice(0, 16)}  ${d.loteId}  ${d.type.padEnd(22)} ${String(d.pageCount).padStart(3)} pág  ${d.words} pal.`);
}

async function medir(loteId: string) {
  const lote = await prisma.lecturaLote.findUnique({
    where: { id: loteId },
    include: { files: true, documents: { orderBy: { position: "asc" } } },
  });
  if (!lote) return console.log(`${loteId}: no existe`);
  const rows = [...lote.files].sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9));
  const urls = [...new Set(rows.map((r) => r.url).filter((u): u is string => Boolean(u)))];
  const inputs = await Promise.all(urls.map(async (url) => {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    return { name: rows.find((r) => r.url === url)!.name, bytes: new Uint8Array(await res.arrayBuffer()) };
  }));
  const prepared = await prepareBatch(inputs, DEFAULT_LIMITS);
  if (prepared.status !== "ok") return console.log(`${loteId}: no se pudo preparar (${prepared.status})`);
  const batch = prepared.batch;
  const remap = new Map<number, number>();
  for (const r of rows) {
    if (r.position === null || !r.sha256) continue;
    const f = batch.files.find((x) => x.sha256 === r.sha256 && x.name === r.name) ?? batch.files.find((x) => x.sha256 === r.sha256);
    if (f) remap.set(r.position, f.index);
  }
  const fix = (parts: Part[]) => parts.map((p) => ({ fileIndex: remap.get(p.fileIndex) ?? -1, page: p.page }));
  const docs = lote.documents.map((d) => {
    const apostille = d.apostille as ReadDocumentRaw["apostille"];
    return {
      id: d.docKey, type: d.type, typeLabelEs: d.typeLabelEs, holder: d.holder, isBilingualDuplicate: d.isBilingualDuplicate,
      parts: fix(d.parts as Part[]),
      annexes: (d.annexes as ReadDocumentRaw["annexes"]).map((a) => ({ ...a, parts: fix(a.parts) })),
      apostille: apostille ? { ...apostille, parts: fix(apostille.parts) } : null,
      pageCount: d.pageCount, words: d.words, estimatedWords: d.estimatedWords, wordsBasis: d.wordsBasis === "exact" ? "exact" as const : "estimated" as const,
    } as unknown as ReadDocument;
  });
  const t0 = Date.now();
  const { documents, usages } = await transcribeDocuments(batch, docs);
  const ms = Date.now() - t0;
  const cost = costOf(usages);
  console.log(`\nLote ${loteId} (${lote.createdAt.toISOString().slice(0, 10)}) · ${ms} ms · ${cost.usd.toFixed(4)} USD (${(cost.eurCents / 100).toFixed(3)} €)`);
  console.log("doc    tipo                    pág  estimado  transcrito   dif.   base         páginas bajas/fallidas");
  for (const d of documents) {
    const t = d.transcription;
    const diff = t && d.wordsBasis === "transcribed" ? `${(((d.words - d.estimatedWords) / Math.max(1, d.estimatedWords)) * 100).toFixed(0)} %` : "—";
    const flags = t ? `${t.lowPages.length ? `bajas ${t.lowPages.join(",")}` : ""}${t.failedPages.length ? ` fallidas ${t.failedPages.join(",")}` : ""}${t.detailEs && !t.failedPages.length ? ` ${t.detailEs}` : ""}` : "(no se transcribe)";
    console.log(`${d.id.padEnd(6)} ${d.type.slice(0, 22).padEnd(22)} ${String(d.parts.length).padStart(4)} ${String(d.estimatedWords).padStart(9)} ${String(t ? d.words : "—").padStart(11)} ${diff.padStart(6)}   ${d.wordsBasis.padEnd(12)} ${flags}`);
  }
}

async function main() {
  const ids = process.argv.slice(2);
  try {
    if (ids.length === 0) await listar();
    for (const id of ids) await medir(id);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
