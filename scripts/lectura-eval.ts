// scripts/lectura-eval.ts — evaluación de la lectura única con expedientes reales.
//   npx tsx --env-file=.env.local scripts/lectura-eval.ts [--max-usd 15] [--only fixed|broad] [--keys REF=N,…] [--limit N] [--effort medium] [--no-fallback] [--report ruta]
//   npx tsx scripts/lectura-eval.ts --from-raw <dir>     # regenera el informe de los JSON crudos, sin llamar a la API
// Solo LECTURA: Prisma findMany/findFirst y descarga de los archivos públicos de Blob. No escribe en la BD.
// Informe sin nombres ni texto de documentos: solo estructura, clases y cifras.

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { readBatch, PROMPT_VERSION, type ModelReading, type Reading, type ReadingContext, type SourceFile } from "../lib/lectura/index.ts";
import type { Effort } from "../lib/lectura/read.ts";
import type { Part } from "../lib/lectura/schema.ts";
import { prepareBatch, sniffType } from "../lib/lectura/prepare.ts";
import { imagesToPdf, partitionOf, samePartition, shuffled, splitPdf } from "../lib/lectura/invariance.ts";

const REPORT = process.argv.includes("--report") ? process.argv[process.argv.indexOf("--report") + 1] : "/Users/nip/proyectos/tjnet-golden/lectura-eval.md";
const RAW_DIR = process.env.LECTURA_RAW_DIR || join(tmpdir(), "lectura-eval-raw");
const BROAD_SINCE = new Date("2026-10-20T00:00:00Z");
const NON_TRANSLATION_LINE = /^\s*(gastos de )?env[ií]o|urgen|recargo|descuento|impresi[oó]n|mensajer|correo postal|papel/i;

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const MAX_USD = Number(arg("max-usd") ?? 15);
const ONLY = arg("only");
const LIMIT = Number(arg("limit") ?? Infinity);
const EFFORT = (arg("effort") ?? "medium") as Effort;
const FALLBACK = !process.argv.includes("--no-fallback");
const CONCURRENCY = Number(arg("concurrency") ?? 3);

type Row = { id: string; fileUrl: string; fileName: string; mimeType: string; sessionToken: string | null; createdAt: Date; sourceLanguage: string | null; targetLanguage: string | null; neededBy: Date | null; urgency: string | null; casoId: string | null };
const ROW_SELECT = { id: true, fileUrl: true, fileName: true, mimeType: true, sessionToken: true, createdAt: true, sourceLanguage: true, targetLanguage: true, neededBy: true, urgency: true, casoId: true } as const;

type Expected = { docs: number; docsAlt?: number[]; withApostille?: number; pages?: number[]; target?: string; declaredPages?: number; missing?: number[] };
type Case = { key: string; kind: "fixed" | "broad"; files: { url: string; name: string; mime: string }[]; context: ReadingContext; expected: Expected; notes: string[]; casoId: string | null; before: Date };

function isPuertaToken(t: string | null): boolean {
  return !!t && !/^(exp|staff|merged|puerta):/.test(t);
}

async function rowsForRef(ref: string): Promise<Row[]> {
  if (ref.startsWith("EXP-")) {
    const rows = await prisma.documentAnalysis.findMany({ where: { sessionToken: { in: [`exp:${ref}`, `merged:${ref}`] } }, select: ROW_SELECT, orderBy: { createdAt: "asc" } });
    const merged = rows.filter((r) => r.sessionToken === `merged:${ref}`);
    if (merged.length === 0) return rows;
    // The merge product (a PDF built later from the merged originals) would repeat them: keep the originals.
    const lastMerged = Math.max(...merged.map((r) => r.createdAt.getTime()));
    return rows.filter((r) => r.sessionToken === `merged:${ref}` || r.createdAt.getTime() <= lastMerged);
  }
  if (ref.startsWith("puerta:")) {
    const tok = ref.slice("puerta:".length);
    return prisma.documentAnalysis.findMany({ where: { sessionToken: { in: [tok, ref] } }, select: ROW_SELECT, orderBy: { createdAt: "asc" } });
  }
  return [];
}

function contextFrom(rows: Row[], clientMessage: string | null): ReadingContext {
  const puerta = rows.find((r) => isPuertaToken(r.sessionToken));
  const needed = rows.find((r) => r.neededBy)?.neededBy;
  return {
    clientMessage,
    declaredSourceLang: puerta?.sourceLanguage ?? null,
    declaredTargetLang: puerta?.targetLanguage ?? null,
    deadline: needed ? needed.toISOString().slice(0, 10) : rows.find((r) => r.urgency && r.urgency !== "normal")?.urgency ?? null,
  };
}

async function clientMessage(casoId: string | null, before: Date): Promise<string | null> {
  if (!casoId) return null;
  const inbound = await prisma.inboundEmail.findMany({ where: { casoId, receivedAt: { lte: before } }, select: { bodyText: true, subject: true }, orderBy: { receivedAt: "asc" }, take: 3 });
  const text = inbound.map((i) => [i.subject, i.bodyText].filter(Boolean).join("\n")).join("\n---\n").trim();
  return text ? text.slice(0, 2000) : null;
}

const toFiles = (rows: Row[]) => rows.filter((r) => !/zip/i.test(r.mimeType)).map((r) => ({ url: r.fileUrl, name: r.fileName, mime: r.mimeType }));

async function fixedCases(): Promise<Case[]> {
  const out: Case[] = [];
  const spec: { number: string; expected: Expected; pick?: (rows: Row[]) => { rows: Row[]; note?: string } }[] = [
    { number: "2026-00399", expected: { docs: 3, withApostille: 1, target: "es" } },
    {
      number: "2026-00401",
      expected: { docs: 1, pages: [4], target: "fr" },
      pick: (rows) => {
        const merged = rows.filter((r) => r.sessionToken?.startsWith("merged:"));
        return { rows: merged, note: `solo las ${merged.length} imágenes originales; fuera ${rows.length - merged.length} archivo(s) del expediente` };
      },
    },
    { number: "2026-00402", expected: { docs: 1, withApostille: 1, target: "de" } },
  ];
  for (const s of spec) {
    const q = await prisma.quote.findFirst({ where: { quoteNumber: s.number }, select: { quoteNumber: true, expedienteRef: true, casoId: true, createdAt: true } });
    if (!q?.expedienteRef) {
      console.log(`${s.number}: sin presupuesto o sin expedienteRef`);
      continue;
    }
    let rows = await rowsForRef(q.expedienteRef);
    const notes: string[] = [];
    if (s.pick) {
      const picked = s.pick(rows);
      rows = picked.rows;
      if (picked.note) notes.push(picked.note);
    }
    const casoId = q.casoId ?? rows.find((r) => r.casoId)?.casoId ?? null;
    out.push({ key: s.number, kind: "fixed", files: toFiles(rows), context: contextFrom(rows, await clientMessage(casoId, q.createdAt)), expected: s.expected, notes, casoId, before: q.createdAt });
  }
  const a = await prisma.documentAnalysis.findFirst({ where: { id: { startsWith: "cmwmd0igj" } }, select: ROW_SELECT });
  if (a) {
    const rows = a.sessionToken ? await prisma.documentAnalysis.findMany({ where: { sessionToken: a.sessionToken }, select: ROW_SELECT, orderBy: { createdAt: "asc" } }) : [a];
    out.push({
      key: "análisis cmwmd0igj", kind: "fixed", files: toFiles(rows),
      context: contextFrom(rows, await clientMessage(a.casoId, new Date())),
      expected: { docs: 1, docsAlt: [2], pages: [5], declaredPages: 7, missing: [3, 4], target: "es" },
      notes: rows.length > 1 ? [`la sesión trae ${rows.length} archivos`] : [],
      casoId: a.casoId, before: new Date(),
    });
  } else console.log("análisis cmwmd0igj: no encontrado");
  return out;
}

async function broadCases(exclude: Set<string>): Promise<{ cases: Case[]; skipped: { key: string; why: string }[] }> {
  const quotes = await prisma.quote.findMany({
    where: { sentAt: { not: null }, expedienteRef: { not: null }, createdAt: { gte: BROAD_SINCE }, deletedAt: null },
    select: { quoteNumber: true, expedienteRef: true, casoId: true, createdAt: true, lines: { select: { description: true, sourceFileUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  const cases: Case[] = [];
  const skipped: { key: string; why: string }[] = [];
  for (const q of quotes) {
    if (exclude.has(q.quoteNumber)) continue;
    let rows = await rowsForRef(q.expedienteRef!);
    let files = toFiles(rows);
    const notes: string[] = [];
    if (files.length === 0) {
      const urls = [...new Set(q.lines.map((l) => l.sourceFileUrl).filter((u): u is string => !!u))];
      files = urls.map((url, i) => ({ url, name: `archivo-${i + 1}${/\.pdf(\?|$)/i.test(url) ? ".pdf" : ""}`, mime: "" }));
      if (files.length) notes.push("archivos tomados de las líneas del presupuesto");
      rows = [];
    }
    if (files.length === 0) {
      skipped.push({ key: q.quoteNumber, why: "sin archivos localizables" });
      continue;
    }
    const translationLines = q.lines.filter((l) => !NON_TRANSLATION_LINE.test(l.description)).length;
    const casoId = q.casoId ?? rows.find((r) => r.casoId)?.casoId ?? null;
    cases.push({ key: q.quoteNumber, kind: "broad", files, context: contextFrom(rows, await clientMessage(casoId, q.createdAt)), expected: { docs: translationLines }, notes, casoId, before: q.createdAt });
  }
  return { cases, skipped };
}

async function download(c: Case): Promise<{ files: SourceFile[]; missing: number }> {
  const files: SourceFile[] = [];
  let missing = 0;
  for (const f of c.files) {
    const res = await fetch(f.url);
    if (!res.ok) {
      missing++;
      continue;
    }
    files.push({ name: f.name, mimeType: f.mime || res.headers.get("content-type"), bytes: new Uint8Array(await res.arrayBuffer()) });
  }
  return { files, missing };
}

type DocSummary = { type: string; pages: number; annexes: string[]; apostille: "none" | "sheet" | "on_page"; declared: number | null; missing: number; wordsBasis: string };
type Summary = {
  key: string; kind: "fixed" | "broad"; status: string; files: number; pages: number; missingFiles: number;
  expectedDocs: number; obtainedDocs: number | null; check: string[]; targetLang: string | null; targetBasis: string | null;
  docs: DocSummary[]; notToTranslate: string[]; duplicatePages: number; questionKinds: string[]; reviewCodes: string[];
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number } | null; costUsd: number; seconds: number; attempts: number;
};

// Annex labels are free text from the documents: the report only keeps a generic class.
function annexClass(label: string): string {
  const l = label.toLowerCase();
  if (/poder|procura|procuration|power/.test(l)) return "poder";
  if (/defunci|décès|deces|death/.test(l)) return "defunción";
  if (/[uú]ltimas voluntades|volontés|adsn|fichier central|registro central/.test(l)) return "últimas voluntades";
  if (/legaliza|apostill/.test(l)) return "legalización";
  if (/nacimiento|naissance|birth/.test(l)) return "nacimiento";
  if (/matrimonio|mariage|marriage/.test(l)) return "matrimonio";
  return "otro";
}

function check(c: Pick<Case, "expected">, r: Reading): string[] {
  if (r.status !== "ok") return [`estado ${r.status}`];
  const e = c.expected;
  const out: string[] = [];
  if (r.documents.length !== e.docs && !(e.docsAlt ?? []).includes(r.documents.length)) out.push(`documentos ${r.documents.length} ≠ ${[e.docs, ...(e.docsAlt ?? [])].join(" o ")}`);
  if (e.withApostille !== undefined) {
    const n = r.documents.filter((d) => d.apostille).length;
    if (n !== e.withApostille) out.push(`con apostilla ${n} ≠ ${e.withApostille}`);
  }
  const got = r.documents.map((d) => d.pageCount).slice(0, e.pages?.length);
  if (e.pages && JSON.stringify(got) !== JSON.stringify(e.pages)) out.push(`páginas ${JSON.stringify(got)} ≠ ${JSON.stringify(e.pages)}`);
  if (e.target && r.reading.targetLang !== e.target) out.push(`destino ${r.reading.targetLang} ≠ ${e.target}`);
  if (e.declaredPages !== undefined && r.documents[0]?.declaredPages !== e.declaredPages) out.push(`declara ${r.documents[0]?.declaredPages} ≠ ${e.declaredPages}`);
  if (e.missing && JSON.stringify(r.documents[0]?.missingPages ?? []) !== JSON.stringify(e.missing)) out.push(`faltan ${JSON.stringify(r.documents[0]?.missingPages ?? [])} ≠ ${JSON.stringify(e.missing)}`);
  return out;
}

function summarize(c: Pick<Case, "key" | "kind" | "expected">, r: Reading | null, missingFiles: number, seconds: number, checks: string[]): Summary {
  const base: Summary = {
    key: c.key, kind: c.kind, status: r ? r.status : "archivos borrados", files: 0, pages: 0, missingFiles, expectedDocs: c.expected.docs, obtainedDocs: null, check: checks,
    targetLang: null, targetBasis: null, docs: [], notToTranslate: [], duplicatePages: 0, questionKinds: [], reviewCodes: [], tokens: null, costUsd: 0, seconds, attempts: 0,
  };
  if (!r || r.status === "too_large" || r.status === "empty" || r.status === "busy") return base;
  base.files = r.batch.files.length;
  base.pages = r.batch.pages.length;
  base.tokens = r.usage;
  base.costUsd = r.cost.usd;
  base.attempts = r.attempts;
  if (r.status !== "ok" && r.status !== "nothing_to_translate") return base;
  const rd = r.reading;
  base.obtainedDocs = rd.documents.length;
  base.targetLang = rd.targetLang;
  base.targetBasis = rd.targetLangBasis;
  base.docs = (r.status === "ok" ? r.documents : []).map((d) => ({
    type: d.type, pages: d.pageCount, annexes: (d.annexes ?? []).map((a) => annexClass(a.labelEs)),
    apostille: !d.apostille ? "none" : d.apostille.parts.length ? "sheet" : "on_page", declared: d.declaredPages, missing: d.missingPages.length, wordsBasis: d.wordsBasis,
  }));
  base.notToTranslate = rd.notToTranslate.map((n) => n.kind);
  base.duplicatePages = rd.duplicates.reduce((s, d) => s + d.parts.length, 0);
  base.questionKinds = rd.questions.map((q) => q.kind);
  base.reviewCodes = [...new Set(r.assessment.reasons.map((x) => x.code))];
  return base;
}

/** Pessimistic cost of one reading (two attempts, input uncached, full max_tokens): reserved before launching. */
function maxCostUsd(pagesGuess: number): number {
  const input = 10_000 + pagesGuess * 5_000;
  return (2 * (input * 4 + 32_000 * 20)) / 1_000_000;
}

let spentUsd = 0;
let reservedUsd = 0;

/** Real page count of the batch (same preparation the reading will do), for the spending reservation. */
async function realPages(files: SourceFile[]): Promise<number> {
  const p = await prepareBatch(files);
  return p.status === "ok" ? p.batch.pages.length : 0;
}

/** Reserves the worst case before an API call; false = the cap would be passed, the call is not made. */
function reserve(pages: number): number | null {
  const amount = maxCostUsd(pages);
  if (spentUsd + reservedUsd + amount > MAX_USD) return null;
  reservedUsd += amount;
  return amount;
}

class CapReached extends Error {}

async function runCase(c: Case): Promise<Summary> {
  const t0 = Date.now();
  const { files, missing } = await download(c);
  if (files.length === 0) return summarize(c, null, missing, 0, ["archivos borrados"]);
  const held = reserve(await realPages(files));
  if (held === null) throw new CapReached();
  let r: Reading;
  try {
    r = await readBatch(files, c.context, { effort: EFFORT, fallback: FALLBACK });
  } finally {
    reservedUsd -= held;
  }
  const seconds = (Date.now() - t0) / 1000;
  const checks = check(c, r);
  const summary = summarize(c, r, missing, seconds, checks);
  spentUsd += summary.costUsd;
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(join(RAW_DIR, `${c.key.replace(/[^\w-]+/g, "_")}.json`), JSON.stringify({ summary, result: { ...r, batch: undefined } }, null, 2));
  console.log(`${c.key}: ${summary.status} ${summary.obtainedDocs ?? "-"} docs (esperado ${c.expected.docs}) $${summary.costUsd.toFixed(3)} ${seconds.toFixed(0)} s · gastado $${spentUsd.toFixed(2)} ${checks.length ? "✗ " + checks.join("; ") : "✓"}`);
  return summary;
}

function describe(s: Summary): string {
  const docs = s.docs
    .map((d) => `${d.type}·${d.pages}p${d.annexes.length ? `+anexos[${d.annexes.join(",")}]` : ""}${d.apostille !== "none" ? `+apostilla(${d.apostille === "sheet" ? "hoja" : "en página"})` : ""}${d.missing ? `·faltan ${d.missing}` : ""}`)
    .join("; ");
  const tok = s.tokens ? `${s.tokens.input}/${s.tokens.output}/${s.tokens.cacheRead}/${s.tokens.cacheWrite}` : "-";
  return `| ${s.key} | ${s.kind === "fixed" ? "fijo" : "amplio"} | ${s.status} | ${s.files}/${s.pages}${s.missingFiles ? ` (${s.missingFiles} borrados)` : ""} | ${s.expectedDocs} | ${s.obtainedDocs ?? "-"} | ${s.check.length ? "✗ " + s.check.join("; ") : "✓"} | ${docs || "-"} | ${s.notToTranslate.length ? s.notToTranslate.join(",") : "-"} | ${s.questionKinds.length ? s.questionKinds.join(",") : "-"} | ${s.reviewCodes.length ? s.reviewCodes.join(",") : s.tokens ? "limpia" : "-"} | ${s.targetLang ?? "-"} | ${tok} | ${s.costUsd.toFixed(3)} | ${s.seconds.toFixed(0)} |`;
}

function writeReport(path: string, summaries: Summary[], meta: { prompt: string; stoppedByCap: boolean; skipped: number; note?: string }) {
  const ran = summaries.filter((s) => s.tokens);
  const costs = ran.map((s) => s.costUsd);
  const secs = ran.map((s) => s.seconds);
  const fixed = summaries.filter((s) => s.kind === "fixed");
  const broad = summaries.filter((s) => s.kind === "broad" && s.tokens);
  const md = [
    "# Evaluación de la lectura única", "",
    `- Generado: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · prompt ${meta.prompt} · claude-opus-5-5 · effort ${EFFORT}${meta.note ? ` · ${meta.note}` : ""}`,
    `- Gasto: $${costs.reduce((a, b) => a + b, 0).toFixed(2)}${meta.stoppedByCap ? " · TOPE ALCANZADO, evaluación incompleta" : ""}`,
    `- Fijos: ${fixed.filter((s) => s.check.length === 0).length}/${fixed.length} coinciden · amplio: ${broad.filter((s) => s.check.length === 0).length}/${broad.length} coinciden en nº de documentos${meta.skipped ? ` · ${meta.skipped} sin archivos localizables` : ""}`,
    costs.length ? `- Coste por lote: medio $${(costs.reduce((a, b) => a + b, 0) / costs.length).toFixed(3)}, máximo $${Math.max(...costs).toFixed(3)} · tiempo medio ${(secs.reduce((a, b) => a + b, 0) / secs.length).toFixed(0)} s, máximo ${Math.max(...secs).toFixed(0)} s` : "",
    "- Solo estructura: tipos del catálogo, nº de páginas, clases de anexo, clases de pregunta y códigos de revisión. Sin nombres ni texto de documentos.",
    "",
    "| Ref. | Conjunto | Estado | Archivos/págs | Esperado | Obtenido | Comprobación | Documentos | No se traduce | Preguntas | Revisión | Destino | Tokens ent/sal/caché leída/escrita | $ | s |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...summaries.map(describe),
    "",
  ];
  writeFileSync(path, md.join("\n"));
}

/** Raw files written before summaries existed: rebuild the same fields from the stored reading. */
function summaryFromOldRaw(j: { key: string; expected: Expected; result: Record<string, unknown> }): Summary {
  const r = j.result as Record<string, any>;
  const rd = r.reading as ModelReading | undefined;
  const all = rd
    ? [...rd.documents.flatMap((d) => [...d.parts, ...(d.apostille?.parts ?? [])]), ...rd.notToTranslate.flatMap((n) => n.parts), ...rd.duplicates.flatMap((d) => d.parts), ...(rd.instructions?.parts ?? [])]
    : [];
  const kind: Summary["kind"] = /^2026-00(399|401|402)$|cmwmd0igj/.test(j.key) ? "fixed" : "broad";
  const docs: Array<Record<string, any>> = ((r.documents ?? []) as Array<Record<string, any>>).map((d) => ({ ...d, pageCount: d.parts.length, annexes: [] }));
  return {
    key: j.key, kind, status: r.status, files: new Set(all.map((p) => p.fileIndex)).size, pages: all.length, missingFiles: 0,
    expectedDocs: j.expected.docs, obtainedDocs: rd ? rd.documents.length : null,
    check: check({ expected: j.expected }, { ...r, documents: docs } as unknown as Reading),
    targetLang: rd?.targetLang ?? null, targetBasis: rd?.targetLangBasis ?? null,
    docs: docs.map((d) => ({ type: d.type, pages: d.parts.length, annexes: [], apostille: !d.apostille ? "none" : d.apostille.parts.length ? "sheet" : "on_page", declared: d.declaredPages, missing: d.missingPages.length, wordsBasis: d.wordsBasis })),
    notToTranslate: rd?.notToTranslate.map((n) => n.kind) ?? [],
    duplicatePages: rd?.duplicates.reduce((a, d) => a + d.parts.length, 0) ?? 0,
    questionKinds: rd?.questions.map((q) => q.kind) ?? [],
    reviewCodes: ["no_evaluada"],
    tokens: r.usage ?? null, costUsd: r.cost?.usd ?? 0, seconds: (r.ms ?? 0) / 1000, attempts: r.attempts ?? 0,
  };
}

function fromRaw(dir: string) {
  const summaries = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8"));
    return (j.summary as Summary | undefined) ?? summaryFromOldRaw(j);
  });
  summaries.sort((a, b) => (a.kind === b.kind ? b.key.localeCompare(a.key) : a.kind === "fixed" ? -1 : 1));
  writeReport(REPORT, summaries, { prompt: arg("prompt-label") ?? "(de los crudos)", stoppedByCap: false, skipped: 0, note: "regenerado de los JSON crudos, sin llamar a la API" });
  console.log(`Informe regenerado: ${REPORT} (${summaries.length} casos)`);
}

// Same paper, other packing: 00401 (4 images → one PDF) and 00319 (one PDF → one shuffled PDF per page).
async function invariance() {
  const fixed = (await fixedCases()).filter((c) => c.key === "2026-00401");
  const broad = (await broadCases(new Set())).cases.filter((c) => c.key === "2026-00319");
  const lines = ["# Invariancia de la lectura (mismo papel, otro empaquetado)", "", `- prompt ${PROMPT_VERSION} · claude-opus-5-5 · effort ${EFFORT}`, ""];
  for (const c of [...fixed, ...broad]) {
    const { files } = await download(c);
    let variant: SourceFile[];
    let originA: (p: Part) => string;
    let originB: (p: Part) => string;
    if (files.every((f) => sniffType(f.bytes) !== "pdf")) {
      variant = [{ name: "documento.pdf", bytes: await imagesToPdf(files.map((f) => ({ bytes: f.bytes, png: sniffType(f.bytes) === "png" }))) }];
      originA = (p) => `h${p.fileIndex}`;
      originB = (p) => `h${p.page}`;
    } else {
      const pages = await splitPdf(files[0].bytes);
      const order = shuffled(pages);
      variant = order.map((o, i) => ({ name: `escaneo_${i + 1}.pdf`, bytes: o.item }));
      originA = (p) => `p${p.page}`;
      originB = (p) => `p${order[p.fileIndex - 1].from + 1}`;
    }
    const held = reserve(2 * (await realPages(files)));
    if (held === null) {
      lines.push(`## ${c.key} — NO EJECUTADO: el tope de gasto de $${MAX_USD} no cubre las dos lecturas`, "");
      continue;
    }
    let a: Reading;
    let b: Reading;
    try {
      a = await readBatch(files, c.context, { effort: EFFORT, fallback: FALLBACK });
      b = await readBatch(variant, c.context, { effort: EFFORT, fallback: FALLBACK });
    } finally {
      reservedUsd -= held;
    }
    for (const r of [a, b]) if ("cost" in r) spentUsd += r.cost.usd;
    const pa = a.status === "ok" ? partitionOf(a.reading, originA) : null;
    const pb = b.status === "ok" ? partitionOf(b.reading, originB) : null;
    const same = !!pa && !!pb && samePartition(pa, pb);
    const show = (p: string[][] | null) => (p ? p.map((d) => `[${d.join(" ")}]`).join(" ") : "-");
    const cost = (r: Reading) => ("cost" in r ? r.cost.usd.toFixed(3) : "-");
    lines.push(
      `## ${c.key} — ${same ? "MISMOS documentos y páginas" : "DISTINTO"}`,
      `- Original (${files.length} archivo(s)): ${a.status}, ${a.status === "ok" ? a.documents.length : "-"} documento(s) ${show(pa)} · $${cost(a)}`,
      `- Variante (${variant.length} archivo(s)): ${b.status}, ${b.status === "ok" ? b.documents.length : "-"} documento(s) ${show(pb)} · $${cost(b)}`,
      "",
    );
    mkdirSync(RAW_DIR, { recursive: true });
    writeFileSync(join(RAW_DIR, `inv_${c.key}.json`), JSON.stringify({ a: { ...a, batch: undefined }, b: { ...b, batch: undefined } }, null, 2));
    console.log(lines.slice(-4).join("\n"));
  }
  writeFileSync(REPORT, lines.join("\n"));
  console.log(`Informe: ${REPORT} · gastado $${spentUsd.toFixed(2)}`);
}

async function main() {
  const raw = arg("from-raw");
  if (raw) return fromRaw(raw);
  if (process.argv.includes("--invariance")) return invariance();
  console.log(`Lectura única · ${PROMPT_VERSION} · effort ${EFFORT} · fallback ${FALLBACK ? "sí" : "no"} · tope $${MAX_USD}`);
  // --keys 2026-00363=4,2026-00328=10 : only those quotes from the broad set, with the expected count given.
  const keysArg = arg("keys");
  const keys = keysArg ? new Map(keysArg.split(",").map((kv) => { const [k, v] = kv.split("="); return [k.trim(), Number(v)] as [string, number]; })) : null;
  const fixed = ONLY === "broad" ? [] : await fixedCases();
  const loaded = ONLY === "fixed" ? { cases: [] as Case[], skipped: [] as { key: string; why: string }[] } : await broadCases(new Set(fixed.map((c) => c.key)));
  const broad = keys ? loaded.cases.filter((c) => keys.has(c.key)).map((c) => ({ ...c, expected: { docs: keys.get(c.key)! } })) : loaded.cases;
  const queue = [...fixed, ...broad.slice(0, LIMIT)];
  const results: Summary[] = [];
  let stoppedByCap = false;
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      const c = queue[next++];
      try {
        results.push(await runCase(c));
      } catch (err) {
        if (err instanceof CapReached) {
          stoppedByCap = true;
          return;
        }
        console.error(`${c.key}: fallo del script`, err instanceof Error ? err.message : err);
        results.push(summarize(c, null, 0, 0, ["fallo del script"]));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  results.sort((a, b) => queue.findIndex((c) => c.key === a.key) - queue.findIndex((c) => c.key === b.key));
  writeReport(REPORT, results, { prompt: PROMPT_VERSION, stoppedByCap, skipped: keys ? 0 : loaded.skipped.length });
  console.log(`Informe: ${REPORT} · crudos (con datos personales, temporales): ${RAW_DIR}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
