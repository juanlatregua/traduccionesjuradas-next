// Francés automático en la puerta nueva (orden de Juan, 20-nov-2026). Solo fr>es con UN destino y un lote leído:
// las líneas salen de lib/dinero (buildLines + quotePayload), ningún precio se calcula aquí.
// PUERTA_FR (leído en ejecución): off = nada · draft = Quote DRAFT + aviso · fr = envío solo si todo está en verde.
// Sin imports de servidor: la capa de BD vive en server.ts (FrAutoIO).
import { buildLines, quotePayload, type QuotePayload } from "../lectura-constructor/lines.ts";
import type { LoteRow, FileRow } from "../lectura-constructor/store.ts";
import type { WorkingDocument } from "../lectura-constructor/documents.ts";
import { puertaFrAction, puertaFrMode, type PuertaFrMode } from "../puerta-fr-math.ts";
import type { SendDecisionLike } from "../agente-bandeja-math.ts";
import type { EntradaRow } from "./store.ts";
import { ownLote } from "./view.ts";

export type FrAutoData = { lote: LoteRow; files: FileRow[]; documents: WorkingDocument[] };
export type FrAutoDraft = { quoteId: string; quoteNumber: string; netEur: number; totalEur: number; decision: SendDecisionLike };

export type FrAutoIO = {
  mode(): PuertaFrMode;
  /** Un solo reclamo por entrada (`puerta-fr:entrada:{id}`); false = otra ejecución ya la llevó. */
  claim(entradaId: string): Promise<boolean>;
  /** Alguien (jurado, cliente que dijo no, presupuesto vivo) ya lleva a esta persona: motivo, o null. */
  liveBlock(e: EntradaRow): Promise<string | null>;
  /** Bajo advisory lock del hilo (caso|FR>ES): si el caso ya tiene presupuesto vivo, `{skip}`; si no, crea el borrador y evalúa UNA vez. */
  createDraft(e: EntradaRow, payload: QuotePayload): Promise<FrAutoDraft | { error: string } | { skip: string }>;
  /** Confirma el lote y lo enlaza al presupuesto (lote.quoteId). */
  link(e: EntradaRow, data: FrAutoData, draft: FrAutoDraft, payload: QuotePayload): Promise<void>;
  send(e: EntradaRow, draft: FrAutoDraft, payload: QuotePayload): Promise<void>;
  staff(text: string): Promise<void>;
};

export type FrAutoResult = { action: "none" | "drafted" | "sent"; detail: string; quoteNumber?: string };
const none = (detail: string): FrAutoResult => ({ action: "none", detail });

/** ?p=regularizacion-2026 reaches the entrada as its source: the campaign tariff of lib/dinero (25 € per document up to 2 pages). */
export const REGULARIZACION_SOURCE = "regularizacion-2026";
export const isRegularizacion = (e: Pick<EntradaRow, "source">) => e.source === REGULARIZACION_SOURCE;

/** Motivos por los que NO sale solo aunque haya líneas. Vacío = en verde. */
export function frAutoReviewReasons(data: FrAutoData, warnings: number, e?: Pick<EntradaRow, "respuestas" | "notas">): string[] {
  const out: string[] = [];
  // Lo que el cliente contestó, anotó o corrigió puede cambiar el presupuesto (p. ej. «todo en una traducción con una sola firma»),
  // y el conserje le ha dicho que Juan lo confirma en el presupuesto: nunca sale solo.
  if (e?.respuestas?.length || e?.notas?.trim() || data.documents.some((d) => d.editedBy?.startsWith("cliente:"))) out.push("el cliente ha respondido/anotado: revisa");
  if (data.lote.clean !== true) out.push("la lectura no está limpia");
  const reasons = Array.isArray(data.lote.reasons) ? data.lote.reasons : [];
  if (reasons.length > 0) out.push(`${reasons.length} motivo(s) de revisión en la lectura`);
  if (data.documents.some((d) => d.included && (d.manualPriceCents !== null || d.editedBy || d.reasons.length > 0))) out.push("documento editado a mano o con motivos de revisión");
  if (warnings > 0) out.push("avisos de margen o de documentos no incluidos");
  return out;
}

export async function runFrAuto(io: FrAutoIO, e: EntradaRow, data: FrAutoData | null): Promise<FrAutoResult> {
  const mode = io.mode();
  if (mode === "off") return none("PUERTA_FR=off");
  if (!data || data.lote.status !== "ok") return none("lote sin leer");
  if (!e.email || !e.emailVerifiedAt) return none("email sin verificar");
  const targets = e.targetLangs.length ? e.targetLangs : e.targetLang ? [e.targetLang] : [];
  const target = (targets.length === 1 ? targets[0] : data.lote.targetLang ?? "").trim().toLowerCase();
  if (targets.length > 1) return none("varios destinos");
  const included = data.documents.filter((d) => d.included);
  if (included.length === 0 || target !== "es" || included.some((d) => d.sourceLang.trim().toLowerCase() !== "fr")) return none("no es fr>es (sin tarifa en lib/dinero: a mano)");
  const lines = buildLines(data.documents, data.files, target, { regularization: isRegularizacion(e) });
  const payload = quotePayload(lines);
  if (!payload) return none(`líneas sin resolver: ${lines.blockers.map((b) => b.detail).join("; ").slice(0, 160)}`);
  if (!ownLote(e, data.lote) || data.lote.quoteId) return none("lote ajeno o ya con presupuesto");
  const blocked = await io.liveBlock(e);
  if (blocked) return none(blocked);
  if (!(await io.claim(e.id))) return none("ya reclamada");

  const draft = await io.createDraft(e, payload);
  if ("skip" in draft) return none(draft.skip);
  if ("error" in draft) {
    await io.staff(`Puerta FR (entrada ${e.id}): no se pudo crear el borrador (${draft.error}). Revisar a mano.`);
    return none(draft.error);
  }
  await io.link(e, data, draft, payload).catch((err) => console.error("[entrada] frAuto: lote no enlazado", e.id, err));
  const review = frAutoReviewReasons(data, lines.warnings.length, e);
  const decision: SendDecisionLike = review.length > 0 ? { action: "alert", reasons: review } : draft.decision;
  const action = puertaFrAction({ mode, allTariffed: true, decision, marketingConsent: e.marketingConsentAt !== null });
  if (action.action !== "send") {
    const why = action.action === "draft" ? action.reasons.join("; ") : "apagado";
    await io.staff(`Puerta FR (borrador): ${draft.quoteNumber} (${draft.totalEur.toFixed(2)} €) para ${e.nombre || e.email} — ${why.slice(0, 120)}.`);
    return { action: "drafted", detail: `${draft.quoteNumber}: ${why}`, quoteNumber: draft.quoteNumber };
  }
  try {
    await io.send(e, draft, payload);
  } catch (err) {
    console.error("[entrada] frAuto: envío falló", e.id, err);
    await io.staff(`Puerta FR: el envío de ${draft.quoteNumber} a ${e.email} FALLÓ (${String((err as Error)?.message || err).slice(0, 80)}). Queda en borrador: revisar.`);
    return { action: "drafted", detail: `${draft.quoteNumber}: envío fallido`, quoteNumber: draft.quoteNumber };
  }
  await io.staff(`Puerta FR: presupuesto ${draft.quoteNumber} (${draft.totalEur.toFixed(2)} €) enviado a ${e.email}.`);
  return { action: "sent", detail: draft.quoteNumber, quoteNumber: draft.quoteNumber };
}
