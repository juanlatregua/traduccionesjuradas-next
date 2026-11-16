// lib/puerta-fr-math.ts — Decisiones PURAS de la puerta FR (orden de Juan, 16-nov-2026:
// «ningún cliente de francés se va sin presupuesto o sin pagar»). Sin imports de
// servidor: se testea con node --test. La capa de BD vive en lib/puerta-fr.ts.

import { checkSegments, segmentFromAnalysis, segmentPair, type SendDecisionLike, type Segment } from "./agente-bandeja-math.ts";

export type PuertaFrMode = "off" | "draft" | "fr";

/** PUERTA_FR: off (por defecto) | draft (todo a borrador + SMS) | fr (sale solo el FR con tarifa). */
export function puertaFrMode(raw: string | null | undefined): PuertaFrMode {
  const v = String(raw || "").trim().toLowerCase();
  return v === "draft" || v === "fr" ? v : "off";
}

export const PUERTA_FR_MIN_MINUTES = 60;
export const PUERTA_FR_WINDOW_HOURS = 24;

export type WaitVerdict = "young" | "ready" | "stale";

/**
 * ≥60 min desde la ÚLTIMA subida de la sesión (así el aviso a 5-60 min de lead-nudge ya
 * pasó para todos sus documentos y los dos no coinciden); pasadas 24 h desde la primera, ya no.
 */
export function puertaWaitVerdict(createdAts: Date[], now: Date): WaitVerdict {
  if (createdAts.length === 0) return "stale";
  const times = createdAts.map((d) => d.getTime());
  if (now.getTime() - Math.min(...times) > PUERTA_FR_WINDOW_HOURS * 3_600_000) return "stale";
  return now.getTime() - Math.max(...times) >= PUERTA_FR_MIN_MINUTES * 60_000 ? "ready" : "young";
}

const TEST_EMAIL = /yopmail\.com$|mailinator\.com$|^prueba@|^test@/i;

/** Email real al que se puede escribir: ni marcador de WhatsApp ni de prueba. */
export function isRealClientEmail(email: string | null | undefined): boolean {
  const e = String(email || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !/@whatsapp\.local$/.test(e) && !TEST_EMAIL.test(e);
}

export type PuertaRow = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileHash: string | null;
  pageCount: number;
  estimatedWords: number | null;
  sourceLanguage: string | null;
  targetLanguage: string | null;
  analysisJson: unknown;
  status: string;
};

/** Quita el mismo archivo subido dos veces (hash, o nombre+palabras+páginas). */
export function dedupePuertaRows<T extends Pick<PuertaRow, "fileName" | "fileHash" | "estimatedWords" | "pageCount">>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = r.fileHash || `${r.fileName}|${r.estimatedWords}|${r.pageCount}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Filas de la puerta (DocumentAnalysis) → segmentos del carril FR. Solo con análisis completo y
 * legible; en la duda devuelve el motivo y el lead va a borrador, nunca a envío.
 */
export function segmentsFromPuertaRows(rows: PuertaRow[]): { ok: true; segments: (Segment & { fileUrl: string })[] } | { ok: false; reason: string } {
  if (rows.length === 0) return { ok: false, reason: "sesión sin documentos" };
  const segments: (Segment & { fileUrl: string })[] = [];
  for (const r of rows) {
    if (r.status !== "QUOTE_GENERATED" && r.status !== "PAYMENT_PENDING") return { ok: false, reason: `${r.fileName}: análisis sin terminar (${r.status})` };
    const json = r.analysisJson as any;
    if (!json || typeof json !== "object") return { ok: false, reason: `${r.fileName}: sin análisis guardado` };
    const analyses: any[] =
      json.segmented && Array.isArray(json.documents) ? json.documents.map((d: any) => d?.analysis).filter(Boolean) : json.document_type ? [json] : [];
    if (analyses.length === 0) return { ok: false, reason: `${r.fileName}: análisis con formato desconocido` };
    for (const a of analyses) {
      if (!a?.document_type?.specific_type) return { ok: false, reason: `${r.fileName}: tipo de documento sin determinar` };
      const seg = segmentFromAnalysis(a, r.fileName);
      if (!seg.sourceLang) seg.sourceLang = String(r.sourceLanguage || "").toLowerCase();
      if (!seg.targetLang) seg.targetLang = String(r.targetLanguage || "").toLowerCase();
      // Una sola fila = un documento: las páginas y palabras de la fila rellenan lo que el análisis no trae.
      if (analyses.length === 1) {
        seg.pages = Math.max(seg.pages, Number(r.pageCount) || 0);
        if (!seg.words) seg.words = Number(r.estimatedWords) || 0;
      }
      if (seg.pages <= 0) return { ok: false, reason: `${r.fileName}: páginas sin determinar` };
      segments.push({ ...seg, fileUrl: r.fileUrl });
    }
  }
  return { ok: true, segments };
}

/** La sesión entera es FR→ES (nunca ES→FR, nunca mezclada). */
export function puertaSegmentsAreFrEs(segments: Segment[]): { ok: true } | { ok: false; reason: string } {
  const check = checkSegments(segments);
  if (!check.ok) return check;
  if (check.pair !== "fr>es") return { ok: false, reason: `par ${check.pair}: la puerta FR solo cubre fr>es` };
  if (segments.some((s) => segmentPair(s) !== "fr>es")) return { ok: false, reason: "pares de idiomas mezclados" };
  return { ok: true };
}

export type PuertaFrAction = { action: "send" } | { action: "draft"; reasons: string[] } | { action: "skip" };

/**
 * «send» solo con modo fr, TODOS los documentos con tarifa por documento y la decisión de
 * cierre en verde. Cualquier otra cosa: borrador + aviso a Juan. Modo off: nada.
 */
export function puertaFrAction(o: { mode: PuertaFrMode; allTariffed: boolean; decision: SendDecisionLike }): PuertaFrAction {
  if (o.mode === "off") return { action: "skip" };
  if (o.mode === "draft") return { action: "draft", reasons: ["modo borrador (PUERTA_FR=draft)"] };
  if (!o.allTariffed) return { action: "draft", reasons: ["algún documento sin tarifa por documento"] };
  if (o.decision.action === "send") return { action: "send" };
  return { action: "draft", reasons: o.decision.action === "alert" ? o.decision.reasons : [o.decision.reason] };
}
