// scripts/lectura-eval.ts — evaluación de la lectura única con expedientes reales.
//   npx tsx --env-file=.env.local scripts/lectura-eval.ts [--max-usd 15] [--only fixed|broad] [--limit N] [--effort medium] [--no-fallback]
// Solo LECTURA: Prisma findMany/findFirst y descarga de los archivos públicos de Blob. No escribe en la BD.
// Informe sin nombres ni texto de documentos: /Users/nip/proyectos/tjnet-golden/lectura-eval.md

import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "../lib/prisma";
import { readBatch, PROMPT_VERSION, type Reading, type ReadingContext, type SourceFile } from "../lib/lectura/index.ts";
import type { Effort } from "../lib/lectura/read.ts";

const REPORT = "/Users/nip/proyectos/tjnet-golden/lectura-eval.md";
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

type Expected = { docs: number; withApostille?: number; pages?: number[]; target?: string; declaredPages?: number; missing?: number[] };
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
  const spec: { number: string; expected: Expected; checked?: string; pick?: (rows: Row[]) => { rows: Row[]; note?: string } }[] = [
    {
      number: "2026-00399",
      expected: { docs: 3, withApostille: 3, target: "es" },
      checked: "comprobado a mano el 18-nov mirando las 7 páginas: en el lote solo hay UNA hoja de apostilla (archivo 2, del acta de 2017); las dos sentencias llegan sin apostilla",
    },
    {
      number: "2026-00401",
      expected: { docs: 1, pages: [4], target: "fr" },
      pick: (rows) => {
        const merged = rows.filter((r) => r.sessionToken?.startsWith("merged:"));
        return { rows: merged, note: `se leen solo las ${merged.length} imágenes originales (el expediente trae además ${rows.length - merged.length} PDF aparte, que no forma parte del caso esperado)` };
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
    if (s.checked) notes.push(s.checked);
    const casoId = q.casoId ?? rows.find((r) => r.casoId)?.casoId ?? null;
    out.push({ key: s.number, kind: "fixed", files: toFiles(rows), context: contextFrom(rows, await clientMessage(casoId, q.createdAt)), expected: s.expected, notes, casoId, before: q.createdAt });
  }
  const a = await prisma.documentAnalysis.findFirst({ where: { id: { startsWith: "cmwmd0igj" } }, select: ROW_SELECT });
  if (a) {
    const rows = a.sessionToken ? await prisma.documentAnalysis.findMany({ where: { sessionToken: a.sessionToken }, select: ROW_SELECT, orderBy: { createdAt: "asc" } }) : [a];
    out.push({
      key: "análisis cmwmd0igj", kind: "fixed", files: toFiles(rows),
      context: contextFrom(rows, await clientMessage(a.casoId, new Date())),
      expected: { docs: 1, pages: [3], declaredPages: 7, missing: [3, 4, 6, 7], target: "es" },
      notes: [
        ...(rows.length > 1 ? [`la sesión trae ${rows.length} archivos`] : []),
        "comprobado a mano el 18-nov mirando las 7 páginas del PDF: trae las páginas 1, 2, 5, 6 y 7 de las 7 que declara la resolución (faltan la 3 y la 4) y, detrás, una hoja informativa genérica de 2 páginas",
      ],
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

const initials = (s: string) => s.split(/\s+/).filter(Boolean).map((w) => `${w[0].toUpperCase()}.`).join(" ");

function sanitize(text: string, holders: string[]): string {
  let out = text;
  for (const h of holders) {
    if (!h) continue;
    out = out.split(h).join(initials(h));
    for (const w of h.split(/\s+/)) if (w.length > 2) out = out.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"), `${w[0].toUpperCase()}.`);
  }
  // Reference numbers and codes read from the documents.
  out = out.replace(/\b[A-Z]{1,6}\d[A-Z0-9/-]{2,}\b/g, "[ref]").replace(/\b\d[\d/.-]{3,}\d\b/g, "[nº]");
  // Remaining capitalised sequences of 2+ words that look like names (ALL CAPS or Capitalised), outside common words.
  return out.replace(/\b([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+|[A-ZÁÉÍÓÚÑ]{2,})(\s+(de|del|da|dos|el|y|ben|bin|van|von)?\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñü]+|[A-ZÁÉÍÓÚÑ]{2,})){1,4}\b/g, (m) =>
    /^(Certificado|Acta|Registro|Título|Apostilla|Documento|Resolución|Sentencia|Extracto|Copia|Archivo|Antecedentes|Libro|Partida)\b/.test(m) ? m : initials(m.replace(/\b(de|del|da|dos|el|y)\b/g, " ")),
  );
}

type Result = { c: Case; r: Reading | null; missingFiles: number; seconds: number; check: string[] };

function check(c: Case, r: Reading): string[] {
  if (r.status !== "ok") return [`estado ${r.status}`];
  const e = c.expected;
  const out: string[] = [];
  if (r.documents.length !== e.docs) out.push(`documentos ${r.documents.length} ≠ ${e.docs}`);
  if (e.withApostille !== undefined) {
    const n = r.documents.filter((d) => d.apostille).length;
    if (n !== e.withApostille) out.push(`con apostilla ${n} ≠ ${e.withApostille}`);
  }
  if (e.pages && JSON.stringify(r.documents.map((d) => d.parts.length)) !== JSON.stringify(e.pages)) out.push(`páginas ${JSON.stringify(r.documents.map((d) => d.parts.length))} ≠ ${JSON.stringify(e.pages)}`);
  if (e.target && r.reading.targetLang !== e.target) out.push(`destino ${r.reading.targetLang} ≠ ${e.target}`);
  if (e.declaredPages !== undefined && r.documents[0]?.declaredPages !== e.declaredPages) out.push(`declara ${r.documents[0]?.declaredPages} ≠ ${e.declaredPages}`);
  if (e.missing && JSON.stringify(r.documents[0]?.missingPages ?? []) !== JSON.stringify(e.missing)) out.push(`faltan ${JSON.stringify(r.documents[0]?.missingPages ?? [])} ≠ ${JSON.stringify(e.missing)}`);
  return out;
}

let spentUsd = 0;

async function runCase(c: Case): Promise<Result> {
  const t0 = Date.now();
  const { files, missing } = await download(c);
  if (files.length === 0) return { c, r: null, missingFiles: missing, seconds: 0, check: ["archivos borrados"] };
  const r = await readBatch(files, c.context, { effort: EFFORT, fallback: FALLBACK });
  if ("cost" in r) spentUsd += r.cost.usd;
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(join(RAW_DIR, `${c.key.replace(/[^\w-]+/g, "_")}.json`), JSON.stringify({ key: c.key, expected: c.expected, context: c.context, result: { ...r, batch: undefined } }, null, 2));
  const seconds = (Date.now() - t0) / 1000;
  const res = { c, r, missingFiles: missing, seconds, check: check(c, r) };
  const cost = "cost" in r ? `$${r.cost.usd.toFixed(3)}` : "-";
  console.log(`${c.key}: ${r.status} ${r.status === "ok" ? `${r.documents.length} docs (esperado ${c.expected.docs})` : ""} ${cost} ${seconds.toFixed(0)} s · acumulado $${spentUsd.toFixed(2)} ${res.check.length ? "✗ " + res.check.join("; ") : "✓"}`);
  return res;
}

function describe(res: Result): string[] {
  const { c, r } = res;
  const lines: string[] = [];
  lines.push(`### ${c.key} (${c.kind === "fixed" ? "fijo" : "amplio"}) — ${res.check.length === 0 ? "COINCIDE" : "NO coincide: " + res.check.join("; ")}`);
  lines.push(`- Archivos: ${c.files.length}${res.missingFiles ? ` (${res.missingFiles} ya borrados)` : ""}. Contexto: mensaje ${c.context.clientMessage ? "sí" : "no"}, destino declarado ${c.context.declaredTargetLang ?? "no"}, fecha ${c.context.deadline ?? "no"}.`);
  for (const n of c.notes) lines.push(`- Nota: ${n}`);
  lines.push(`- Esperado: ${c.expected.docs} documento(s)${c.expected.withApostille !== undefined ? `, ${c.expected.withApostille} con apostilla` : ""}${c.expected.pages ? `, páginas ${c.expected.pages.join("/")}` : ""}${c.expected.target ? `, destino ${c.expected.target}` : ""}${c.expected.missing ? `, faltan ${c.expected.missing.join(", ")}` : ""}${c.kind === "broad" ? " (líneas de traducción del presupuesto enviado)" : ""}.`);
  if (!r) return lines;
  if (r.status === "too_large" || r.status === "empty") {
    lines.push(`- Resultado: ${r.status} — ${r.reasonEs}`);
    return lines;
  }
  const b = r.batch;
  lines.push(`- Lote: ${b.files.length} archivo(s), ${b.pages.length} página(s), ${(b.requestBytes / 1024 / 1024).toFixed(1)} MB${b.duplicateFiles.length ? `, ${b.duplicateFiles.length} copia(s) exacta(s) descartada(s)` : ""}${b.skipped.length ? `, omitidos: ${b.skipped.map((s) => s.reasonEs).join("; ")}` : ""}.`);
  lines.push(`- Tokens: entrada ${r.usage.input}, salida ${r.usage.output}, caché leída ${r.usage.cacheRead}, caché escrita ${r.usage.cacheWrite} · coste $${r.cost.usd.toFixed(3)} · ${res.seconds.toFixed(0)} s · intentos ${r.attempts}${r.servedBy.some((m) => m !== "claude-opus-5-5") ? ` · servido por ${r.servedBy.join(", ")}` : ""}.`);
  if (r.status !== "ok") {
    lines.push(`- Resultado: ${r.status}${r.status === "invalid" ? ` — ${r.errors.slice(0, 6).join(" | ")}` : r.status === "error" ? ` — ${r.error.kind} ${r.error.httpStatus ?? ""}` : r.status === "refused" ? ` — ${r.category ?? ""}` : ""}`);
    return lines;
  }
  const holders = r.documents.map((d) => d.holder ?? "").filter(Boolean);
  const pageList = (ps: { fileIndex: number; page: number }[]) => ps.map((p) => `${p.fileIndex}.${p.page}`).join(" ");
  lines.push(`- Obtenido: ${r.documents.length} documento(s), destino ${r.reading.targetLang} (${r.reading.targetLangBasis}).`);
  for (const d of r.documents) {
    const holder = d.holder ? ` · titular ${initials(d.holder)}` : "";
    const ap = d.apostille ? ` · apostilla ${d.apostille.parts.length ? pageList(d.apostille.parts) : "en la página"}` : "";
    const miss = d.missingPages.length ? ` · declara ${d.declaredPages}, faltan ${d.missingPages.join(", ")}` : "";
    lines.push(`  - ${d.id} ${d.type} «${sanitize(d.typeLabelEs, holders)}» ${d.sourceLang}${holder} · págs ${pageList(d.parts)}${ap}${miss} · ${d.words} pal (${d.wordsBasis}) · conf ${d.confidence}`);
  }
  const rd = r.reading;
  if (rd.notToTranslate.length) lines.push(`  - No se traduce: ${rd.notToTranslate.map((n) => `${n.kind} [${pageList(n.parts)}]`).join("; ")}`);
  if (rd.duplicates.length) lines.push(`  - Repetidas: ${rd.duplicates.map((d) => `[${pageList(d.parts)}] → ${d.duplicateOf.documentId ?? pageList(d.duplicateOf.parts)}`).join("; ")}`);
  if (rd.instructions) lines.push(`  - Requerimiento: ${sanitize([rd.instructions.authority, rd.instructions.country, rd.instructions.procedure].filter(Boolean).join(" · "), holders)}`);
  for (const q of rd.questions) lines.push(`  - Pregunta (${q.kind}): ${sanitize(q.textEs, holders)}`);
  return lines;
}

async function main() {
  console.log(`Lectura única · ${PROMPT_VERSION} · effort ${EFFORT} · fallback ${FALLBACK ? "sí" : "no"} · tope $${MAX_USD}`);
  const fixed = ONLY === "broad" ? [] : await fixedCases();
  const { cases: broad, skipped } = ONLY === "fixed" ? { cases: [], skipped: [] } : await broadCases(new Set(fixed.map((c) => c.key)));
  const queue = [...fixed, ...broad.slice(0, LIMIT)];
  const results: Result[] = [];
  let stoppedByCap = false;
  let next = 0;
  async function worker() {
    while (next < queue.length) {
      if (spentUsd >= MAX_USD) {
        stoppedByCap = true;
        return;
      }
      const c = queue[next++];
      try {
        results.push(await runCase(c));
      } catch (err) {
        console.error(`${c.key}: fallo del script`, err);
        results.push({ c, r: null, missingFiles: 0, seconds: 0, check: [`fallo del script: ${err instanceof Error ? err.message : String(err)}`] });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));
  results.sort((a, b) => queue.indexOf(a.c) - queue.indexOf(b.c));

  const ran = results.filter((x) => x.r && "cost" in x.r);
  const costs = ran.map((x) => (x.r as Extract<Reading, { cost: unknown }>).cost.usd);
  const secs = ran.map((x) => x.seconds);
  const fixedRes = results.filter((x) => x.c.kind === "fixed");
  const broadRes = results.filter((x) => x.c.kind === "broad" && x.r);
  const deleted = results.filter((x) => x.c.kind === "broad" && !x.r);
  const md: string[] = [];
  md.push(`# Evaluación de la lectura única`, "");
  md.push(`- Fecha: ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · modelo claude-opus-5-5 · effort ${EFFORT} · prompt ${PROMPT_VERSION} · fallback de rechazo ${FALLBACK ? "activado" : "desactivado"}`);
  md.push(`- Tope de gasto $${MAX_USD}${stoppedByCap ? " — ALCANZADO: la evaluación se paró antes de terminar" : ""}. Gastado: $${spentUsd.toFixed(2)}.`);
  md.push(`- Casos fijos: ${fixedRes.filter((x) => x.check.length === 0).length}/${fixedRes.length} coinciden.`);
  md.push(`- Conjunto amplio (presupuestos enviados con expediente desde ${BROAD_SINCE.toISOString().slice(0, 10)}): ${broad.length} candidatos, ${broadRes.length} leídos, ${deleted.length} con los archivos ya borrados, ${skipped.length} sin archivos localizables${queue.length < fixed.length + broad.length ? `, ${fixed.length + broad.length - queue.length} fuera por --limit` : ""}; coinciden en nº de documentos ${broadRes.filter((x) => x.check.length === 0).length}/${broadRes.length}.`);
  if (costs.length) {
    md.push(`- Coste por lote: medio $${(costs.reduce((s, x) => s + x, 0) / costs.length).toFixed(3)}, máximo $${Math.max(...costs).toFixed(3)} · tiempo medio ${(secs.reduce((s, x) => s + x, 0) / secs.length).toFixed(0)} s, máximo ${Math.max(...secs).toFixed(0)} s.`);
  }
  md.push("", "## Casos fijos", "");
  for (const x of fixedRes) md.push(...describe(x), "");
  md.push("## Conjunto amplio", "");
  for (const x of results.filter((y) => y.c.kind === "broad")) md.push(...describe(x), "");
  if (skipped.length) md.push("## Sin archivos localizables", "", ...skipped.map((s) => `- ${s.key}: ${s.why}`), "");
  writeFileSync(REPORT, md.join("\n"));
  console.log(`Informe: ${REPORT} · crudos (con datos personales, temporales): ${RAW_DIR}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
