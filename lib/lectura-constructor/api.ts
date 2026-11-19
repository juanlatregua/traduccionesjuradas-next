import { z } from "zod";
import { centsFromEuros } from "../dinero/money.ts";
import { DOCUMENT_TYPES } from "../lectura/schema.ts";
import { applyEdit, labelOf, type EditOp, type WorkingDocument } from "./documents.ts";
import { buildLines, linesView, quotePayload, type LinesView, type QuotePayload } from "./lines.ts";
import type { StartInput, StartResult } from "./run.ts";
import type { FileRow, LecturaStore, LoteRow } from "./store.ts";

export type Auth = { ok: true; email: string } | { ok: false; error: string };
export type ApiDeps = {
  enabled(): boolean;
  auth(req: Request): Promise<Auth>;
  rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }>;
  store: LecturaStore;
  start(input: StartInput): Promise<StartResult>;
  /** Null when reading can run here; otherwise why not (e.g. no explicit RSS ceiling). */
  readyToRead(): string | null;
  findQuote(quoteId: string): Promise<{ id: string; casoId: string | null; sourceLang: string; targetLang: string } | null>;
  newId(): string;
};
export type ApiResponse = { status: number; body: unknown; headers?: Record<string, string> };

const Lang = z.string().trim().toLowerCase().regex(/^[a-z]{2,3}$/);
const Id = z.string().trim().min(1).max(120);
const Euros = z.string().trim().regex(/^\d{1,6}(?:[.,]\d{1,2})?$/, "importe en euros, p. ej. 45 o 45,50");

export const StartBody = z.strictObject({
  source: z.discriminatedUnion("kind", [
    z.strictObject({ kind: z.literal("caso"), casoId: Id }),
    z.strictObject({ kind: z.literal("session"), sessionKey: Id }),
    z.strictObject({ kind: z.literal("quote"), quoteId: Id }),
  ]),
  targetLang: Lang.nullable().optional(),
  sourceLang: Lang.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  reread: z.boolean().optional(),
});

export const EditBody = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("merge"), ids: z.array(Id).min(2).max(40) }),
  z.strictObject({ op: z.literal("split"), id: Id, at: z.number().int().min(1).max(1000) }),
  z.strictObject({ op: z.literal("setType"), id: Id, type: z.enum(DOCUMENT_TYPES), typeLabelEs: z.string().trim().min(1).max(80), sourceLang: Lang.optional() }),
  z.strictObject({ op: z.literal("exclude"), id: Id, reason: z.string().trim().min(3).max(200) }),
  z.strictObject({ op: z.literal("include"), id: Id }),
  z.strictObject({ op: z.literal("setPrice"), id: Id, price: Euros.nullable(), cost: Euros.nullable() }),
  z.strictObject({ op: z.literal("linkQuote"), quoteId: Id }),
  z.strictObject({ op: z.literal("setTargetLang"), targetLang: Lang }),
]);

const ConfirmBody = z.strictObject({ expectedUpdatedAt: z.iso.datetime() });

const json = (status: number, body: unknown, headers?: Record<string, string>): ApiResponse => ({ status, body, ...(headers ? { headers } : {}) });
const invalid = (err: z.ZodError) => json(400, { ok: false, error: "Datos no válidos.", issues: err.issues.map((i) => `${i.path.join(".") || "cuerpo"}: ${i.message}`) });
const cents = (euros: string | null) => (euros === null ? null : centsFromEuros(euros.replace(",", ".")));

async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

async function gate(req: Request, deps: ApiDeps, scope: string, limit: number): Promise<{ email: string } | ApiResponse> {
  if (!deps.enabled()) return json(404, { ok: false, error: "No disponible." });
  const access = await deps.auth(req);
  if (!access.ok) return json(403, { ok: false, error: access.error });
  const rl = await deps.rateLimit(`lectura:${scope}:${access.email}`, limit, 10 * 60 * 1000);
  if (!rl.ok) return json(429, { ok: false, error: "Demasiadas operaciones. Inténtalo en unos minutos." }, { "Retry-After": String(rl.retryAfterSec) });
  return { email: access.email };
}

export type LoteView = {
  lote: Pick<LoteRow, "id" | "status" | "busyAttempts" | "casoId" | "sessionKey" | "quoteId" | "targetLang" | "targetLangBasis" | "clean" | "detailEs" | "confirmedBy"> & {
    confirmedAt: string | null;
    updatedAt: string;
  };
  lotReasons: { code: string; detail: string }[];
  files: FileRow[];
  documents: (WorkingDocument & { label: string })[];
  lines: LinesView;
  ready: boolean;
  payload: QuotePayload | null;
};

export function viewOf(data: { lote: LoteRow; files: FileRow[]; documents: WorkingDocument[] }): LoteView {
  const { lote, files, documents } = data;
  const target = lote.targetLang ?? "";
  const result = buildLines(documents, files, target);
  const reasons = Array.isArray(lote.reasons) ? (lote.reasons as { code: string; detail: string; documentId?: string }[]) : [];
  const stored = lote.status === "confirmed" ? ((lote.lines as { payload?: QuotePayload } | null)?.payload ?? null) : null;
  return {
    lote: {
      id: lote.id, status: lote.status, busyAttempts: lote.busyAttempts, casoId: lote.casoId, sessionKey: lote.sessionKey, quoteId: lote.quoteId,
      targetLang: lote.targetLang, targetLangBasis: lote.targetLangBasis, clean: lote.clean, detailEs: lote.detailEs, confirmedBy: lote.confirmedBy,
      confirmedAt: lote.confirmedAt?.toISOString() ?? null, updatedAt: lote.updatedAt.toISOString(),
    },
    lotReasons: reasons.filter((r) => !r.documentId).map((r) => ({ code: r.code, detail: r.detail })),
    files,
    documents: documents.map((d) => ({ ...d, label: labelOf(d) })),
    lines: linesView(result),
    ready: result.blockers.length === 0 && result.lines.length > 0,
    payload: stored,
  };
}

export async function handleStart(req: Request, deps: ApiDeps): Promise<ApiResponse> {
  const g = await gate(req, deps, "start", 20);
  if ("status" in g) return g;
  const notReady = deps.readyToRead();
  if (notReady) return json(503, { ok: false, error: notReady });
  const parsed = StartBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  const b = parsed.data;
  const source = {
    casoId: b.source.kind === "caso" ? b.source.casoId : null,
    sessionKey: b.source.kind === "session" ? b.source.sessionKey : null,
    quoteId: b.source.kind === "quote" ? b.source.quoteId : null,
  };
  const r = await deps.start({ source, targetLang: b.targetLang ?? null, sourceLang: b.sourceLang ?? null, notes: b.notes ?? null, reread: b.reread ?? false, by: g.email });
  if (r.kind === "no_files") return json(404, { ok: false, error: "Ese caso no tiene archivos que leer." });
  if (r.kind === "in_progress") return json(409, { ok: false, error: "Ya se está leyendo este lote: espera a que termine.", loteId: r.loteId });
  if (r.kind === "busy") {
    return json(503, { ok: false, busy: true, loteId: r.loteId, attempt: r.attempt, maxRetries: r.maxRetries, error: r.reasonEs }, { "Retry-After": "60" });
  }
  const data = await deps.store.get(r.loteId);
  return json(200, { ok: true, reused: r.reused, view: data ? viewOf(data) : null });
}

export async function handleGet(req: Request, id: string, deps: ApiDeps): Promise<ApiResponse> {
  const g = await gate(req, deps, "read", 240);
  if ("status" in g) return g;
  const data = await deps.store.get(id);
  if (!data) return json(404, { ok: false, error: "Lectura no encontrada." });
  return json(200, { ok: true, view: viewOf(data) });
}

export async function handleEdit(req: Request, id: string, deps: ApiDeps): Promise<ApiResponse> {
  const g = await gate(req, deps, "edit", 240);
  if ("status" in g) return g;
  const parsed = EditBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  const data = await deps.store.get(id);
  if (!data) return json(404, { ok: false, error: "Lectura no encontrada." });
  const e = parsed.data;
  if (e.op === "linkQuote") {
    if (data.lote.status !== "confirmed") return json(409, { ok: false, error: "Primero se confirman las líneas." });
    if (data.lote.quoteId === e.quoteId) return json(200, { ok: true, view: viewOf(data) });
    if (data.lote.quoteId) return json(409, { ok: false, error: "Esta lectura ya está enlazada a otro presupuesto." });
    const quote = await deps.findQuote(e.quoteId);
    if (!quote) return json(404, { ok: false, error: "Ese presupuesto no existe." });
    const payload = (data.lote.lines as { payload?: QuotePayload } | null)?.payload;
    const lang = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    if (data.lote.casoId && quote.casoId !== data.lote.casoId) return json(409, { ok: false, error: "Ese presupuesto es de otro caso." });
    if (!payload || lang(quote.sourceLang) !== payload.sourceLang || lang(quote.targetLang) !== payload.targetLang) {
      return json(409, { ok: false, error: "Ese presupuesto es de otro par de idiomas." });
    }
    if (!(await deps.store.linkQuote(id, e.quoteId))) return json(409, { ok: false, error: "Esta lectura ya está enlazada a otro presupuesto." });
    const after = await deps.store.get(id);
    return json(200, { ok: true, view: after ? viewOf(after) : null });
  }
  if (data.lote.status !== "ok") return json(409, { ok: false, error: data.lote.status === "confirmed" ? "Las líneas ya están confirmadas: no se cambian." : "Esta lectura no se puede corregir." });
  if (e.op === "setTargetLang") {
    if (!(await deps.store.setTargetLang(id, e.targetLang))) return json(409, { ok: false, error: "La lectura ha cambiado de estado: recárgala." });
    const after = await deps.store.get(id);
    return json(200, { ok: true, view: after ? viewOf(after) : null });
  }
  let op: EditOp;
  try {
    op = e.op === "setPrice" ? { op: "setPrice", id: e.id, priceCents: cents(e.price), costCents: cents(e.cost) } : e;
  } catch {
    return json(400, { ok: false, error: "Importe no válido." });
  }
  const result = applyEdit(data.documents, op, g.email, deps.newId);
  if (!result.ok) return json(422, { ok: false, error: result.error });
  if (!(await deps.store.replaceDocuments(id, result.documents))) return json(409, { ok: false, error: "La lectura ha cambiado de estado: recárgala." });
  const after = await deps.store.get(id);
  return json(200, { ok: true, view: after ? viewOf(after) : null });
}

export async function handleConfirm(req: Request, id: string, deps: ApiDeps): Promise<ApiResponse> {
  const g = await gate(req, deps, "confirm", 60);
  if ("status" in g) return g;
  const parsed = ConfirmBody.safeParse((await body(req)) ?? {});
  if (!parsed.success) return invalid(parsed.error);
  const data = await deps.store.get(id);
  if (!data) return json(404, { ok: false, error: "Lectura no encontrada." });
  if (data.lote.status === "confirmed") return json(200, { ok: true, view: viewOf(data) });
  if (data.lote.status !== "ok") return json(409, { ok: false, error: "Solo se confirma una lectura terminada." });
  const seen = new Date(parsed.data.expectedUpdatedAt);
  if (seen.getTime() !== data.lote.updatedAt.getTime()) return json(409, { ok: false, error: "El lote cambió desde que lo viste: recarga y revisa antes de confirmar.", view: viewOf(data) });
  const result = buildLines(data.documents, data.files, data.lote.targetLang ?? "");
  const payload = quotePayload(result);
  if (!payload) return json(422, { ok: false, error: "Hay líneas sin resolver.", view: viewOf(data) });
  const snapshot = { payload, documents: result.lines.map((l) => ({ documentId: l.documentId, priceSource: l.priceSource, tariffCents: l.tariffCents, unitPriceCents: l.unitPriceCents })) };
  if (!(await deps.store.confirm(id, g.email, snapshot, data.lote.updatedAt))) return json(409, { ok: false, error: "El lote cambió mientras confirmabas: recarga y revisa." });
  const after = await deps.store.get(id);
  return json(200, { ok: true, view: after ? viewOf(after) : null });
}
