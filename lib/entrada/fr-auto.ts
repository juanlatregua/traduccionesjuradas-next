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

export type FrAutoData = { lote: LoteRow; files: FileRow[]; documents: WorkingDocument[] };
export type FrAutoDraft = { quoteId: string; quoteNumber: string; netEur: number; totalEur: number };

export type FrAutoIO = {
  mode(): PuertaFrMode;
  /** Un solo reclamo por entrada (`puerta-fr:entrada:{id}`); false = otra ejecución ya la llevó. */
  claim(entradaId: string): Promise<boolean>;
  createDraft(e: EntradaRow, payload: QuotePayload): Promise<FrAutoDraft | { error: string }>;
  /** evaluateDraftAutoSend + tope de importe con IVA. */
  decide(quoteId: string): Promise<SendDecisionLike>;
  send(e: EntradaRow, draft: FrAutoDraft, payload: QuotePayload): Promise<void>;
  staff(text: string): Promise<void>;
};

export type FrAutoResult = { action: "none" | "drafted" | "sent"; detail: string };
const none = (detail: string): FrAutoResult => ({ action: "none", detail });

/** Motivos por los que NO sale solo aunque haya líneas. Vacío = en verde. */
export function frAutoReviewReasons(data: FrAutoData, warnings: number): string[] {
  const out: string[] = [];
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
  const lines = buildLines(data.documents, data.files, target);
  const payload = quotePayload(lines);
  if (!payload) return none(`líneas sin resolver: ${lines.blockers.map((b) => b.detail).join("; ").slice(0, 160)}`);
  if (!(await io.claim(e.id))) return none("ya reclamada");

  const draft = await io.createDraft(e, payload);
  if ("error" in draft) {
    await io.staff(`Puerta FR (entrada ${e.id}): no se pudo crear el borrador (${draft.error}). Revisar a mano.`);
    return none(draft.error);
  }
  const review = frAutoReviewReasons(data, lines.warnings.length);
  const decision: SendDecisionLike = review.length > 0 ? { action: "alert", reasons: review } : await io.decide(draft.quoteId);
  const action = puertaFrAction({ mode, allTariffed: true, decision, marketingConsent: e.marketingConsentAt !== null });
  if (action.action !== "send") {
    const why = action.action === "draft" ? action.reasons.join("; ") : "apagado";
    await io.staff(`Puerta FR (borrador): ${draft.quoteNumber} (${draft.totalEur.toFixed(2)} €) para ${e.nombre || e.email} — ${why.slice(0, 120)}.`);
    return { action: "drafted", detail: `${draft.quoteNumber}: ${why}` };
  }
  await io.send(e, draft, payload);
  await io.staff(`Puerta FR: presupuesto ${draft.quoteNumber} (${draft.totalEur.toFixed(2)} €) enviado a ${e.email}.`);
  return { action: "sent", detail: draft.quoteNumber };
}
