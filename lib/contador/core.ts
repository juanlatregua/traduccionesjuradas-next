// lib/contador/core.ts — Contador de palabras de TraduCAT (tesseract en la VM).
// Puro: configuración, firma del callback, cliente HTTP con fetch inyectable y
// las decisiones (aplicar la cifra al análisis, a quién avisar, cuándo rendirse).
// La cifra de Haiku (lib/ai/transcribe-scan.ts) es la provisional y el respaldo;
// la del contador, cuando llega completa, pasa a mandar.

import { createHmac, timingSafeEqual } from "node:crypto";

export const CONTADOR_CALLBACK_URL = "https://www.traduccionesjuradas.net/api/contador/resultado";
export const SUBMIT_TIMEOUT_MS = 5_000;
export const GIVE_UP_MS = 10 * 60_000;
export const SIGNATURE_MAX_SKEW_MS = 5 * 60_000;
export const QUOTE_DIFF_PCT = 5;
// Imágenes sueltas: TraduCAT acepta JPG/PNG/WEBP/TIFF ≤ 20 Mpx (lib/contador/image.ts decide por los bytes).
export const CONTADOR_IMAGES = true;
// Ruta pública: solo con email de cliente y como mucho 5 trabajos por email al día.
export const PUBLIC_DAILY_PER_EMAIL = 5;
// 429/5xx: reintentos del cron con espera creciente (1, 2, 4 min), como mucho 3.
export const MAX_SUBMIT_RETRIES = 3;
export const RETRY_BASE_MS = 60_000;

export type ContadorEstado = "en_cola" | "contando" | "hecho" | "error";
// sin_confirmar = el envío caducó o se cortó sin respuesta: el trabajo pudo crearse allí.
// No se reenvía (el contrato no busca por referencia): lo resuelve el callback o el abandono.
export type TrabajoEstado = "pendiente_envio" | "sin_confirmar" | ContadorEstado | "abandonado";

export type ContadorConfig = { url: string; token: string; secret: string };

let warnedMissing = false;

/** Solo CONTADOR_TRADUCAT exactamente "on" y las tres variables activan el contador. */
export function contadorConfig(env: Record<string, string | undefined> = process.env): ContadorConfig | null {
  if (env.CONTADOR_TRADUCAT !== "on") return null;
  const url = (env.CONTADOR_URL || "").trim().replace(/\/+$/, "");
  const token = (env.CONTADOR_TOKEN || "").trim();
  const secret = (env.CONTADOR_HMAC_SECRET || "").trim();
  if (!url || !token || !secret) {
    if (!warnedMissing) {
      warnedMissing = true;
      const faltan = [!url && "CONTADOR_URL", !token && "CONTADOR_TOKEN", !secret && "CONTADOR_HMAC_SECRET"].filter(Boolean);
      console.error(`[contador] CONTADOR_TRADUCAT=on pero faltan ${faltan.join(", ")}: contador inactivo`);
    }
    return null;
  }
  return { url, token, secret };
}

/** Todo escaneado: PDF sin capa de texto (camino de visión), tenga las páginas que tenga; imágenes tras CONTADOR_IMAGES. */
export function shouldCount(doc: { mimeType: string; mode?: string; pageCount?: number | null }, images = CONTADOR_IMAGES): boolean {
  if (doc.mimeType === "application/pdf") return doc.mode === "vision";
  // No-PDF: el tipo real lo deciden los bytes (imageEligibility), no el mimeType declarado.
  return images && doc.mode === "vision";
}

export function isPublicHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !!u.hostname && u.hostname !== "localhost";
  } catch {
    return false;
  }
}

/* ---------------- Firma del callback ---------------- */

export function signCallback(secret: string, timestamp: string, rawBody: string): string {
  return "sha256=" + createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyCallback(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  now: number;
}): { ok: true } | { ok: false; reason: "sin_firma" | "marca_invalida" | "caducada" | "firma_invalida" } {
  if (!input.timestamp || !input.signature) return { ok: false, reason: "sin_firma" };
  // Segundos Unix (contrato): 10 cifras como mucho; un valor en milisegundos se rechaza.
  if (!/^\d{1,10}$/.test(input.timestamp)) return { ok: false, reason: "marca_invalida" };
  const raw = Number(input.timestamp);
  const tsMs = raw * 1000;
  if (Math.abs(input.now - tsMs) > SIGNATURE_MAX_SKEW_MS) return { ok: false, reason: "caducada" };
  const expected = Buffer.from(signCallback(input.secret, input.timestamp, input.rawBody));
  const given = Buffer.from(input.signature.trim());
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "firma_invalida" };
  return { ok: true };
}

/* ---------------- Trabajo del contador (solo números) ---------------- */

export type ContadorJob = {
  id: string;
  estado: ContadorEstado;
  paginas_hechas: number;
  paginas_total: number;
  palabras_total: number;
  palabras_por_pagina: number[];
  paginas_sin_texto: number[];
  idioma_detectado: string | null;
  motivo_error: string | null;
  referencia: string | null;
};

const ESTADOS: ContadorEstado[] = ["en_cola", "contando", "hecho", "error"];
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
const ints = (v: unknown) => (Array.isArray(v) ? v.slice(0, 1000).map(int) : []);
const str = (v: unknown, max: number) => (typeof v === "string" && v ? v.slice(0, max) : null);

/** Normaliza la respuesta del contador: nunca guarda texto del documento, solo cifras. */
export function sanitizeJob(raw: any): ContadorJob | null {
  if (!raw || typeof raw !== "object" || typeof raw.id !== "string" || !raw.id) return null;
  if (!ESTADOS.includes(raw.estado)) return null;
  return {
    id: raw.id.slice(0, 100),
    estado: raw.estado,
    paginas_hechas: int(raw.paginas_hechas),
    paginas_total: int(raw.paginas_total),
    palabras_total: int(raw.palabras_total),
    palabras_por_pagina: ints(raw.palabras_por_pagina),
    paginas_sin_texto: ints(raw.paginas_sin_texto),
    idioma_detectado: str(raw.idioma_detectado, 10),
    motivo_error: str(raw.motivo_error, 300),
    referencia: str(raw.referencia, 100),
  };
}

/* ---------------- Cliente HTTP ---------------- */

export type FetchLike = (url: string, init?: any) => Promise<{ status: number; json: () => Promise<any> }>;

export type SubmitResult =
  | { ok: true; id: string; estado: ContadorEstado }
  | { ok: false; retry: boolean; ambiguous?: boolean; error: string };

async function withTimeout<T>(fetchImpl: FetchLike, url: string, init: any, ms: number): Promise<{ status: number; json: () => Promise<any> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function contadorClient(cfg: ContadorConfig, fetchImpl: FetchLike = fetch as any, timeoutMs = SUBMIT_TIMEOUT_MS) {
  const headers = { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" };
  return {
    async submit(input: { url: string; referencia: string; callbackUrl?: string; idiomaEsperado?: string }): Promise<SubmitResult> {
      try {
        const res = await withTimeout(
          fetchImpl,
          `${cfg.url}/trabajos`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              url: input.url,
              referencia: input.referencia.slice(0, 100),
              ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
              ...(input.idiomaEsperado ? { idioma_esperado: input.idiomaEsperado } : {}),
            }),
          },
          timeoutMs
        );
        if (res.status === 202 || res.status === 200 || res.status === 201) {
          const body = await res.json().catch(() => null);
          if (body && typeof body.id === "string" && body.id) {
            return { ok: true, id: body.id.slice(0, 100), estado: ESTADOS.includes(body.estado) ? body.estado : "en_cola" };
          }
          return { ok: false, retry: false, ambiguous: true, error: `respuesta ${res.status} sin id` };
        }
        // 429 cola llena y 5xx: se reintenta desde el cron. 401/411/413 y demás 4xx: no tiene arreglo solo.
        const retry = res.status === 429 || res.status >= 500;
        return { ok: false, retry, error: `HTTP ${res.status}` };
      } catch (err: any) {
        // Sin respuesta: la petición pudo llegar y crear el trabajo → no se reenvía.
        return { ok: false, retry: false, ambiguous: true, error: err?.name === "AbortError" ? "timeout" : String(err?.message || err).slice(0, 200) };
      }
    },
    async getJob(id: string): Promise<ContadorJob | null> {
      try {
        const res = await withTimeout(fetchImpl, `${cfg.url}/trabajos/${encodeURIComponent(id)}`, { method: "GET", headers }, timeoutMs);
        if (res.status !== 200) return null;
        return sanitizeJob(await res.json().catch(() => null));
      } catch {
        return null;
      }
    },
  };
}

export type ContadorClient = ReturnType<typeof contadorClient>;

/* ---------------- Aplicar la cifra al análisis ---------------- */

export type ApplyOutcome =
  | { applied: true; json: any; counterWords: number; haikuWords: number }
  | { applied: false; reason: "analisis_no_aplicable" | "conteo_incompleto" | "paginas_no_cuadran" };

/**
 * Escribe la cifra del contador en el analysisJson (solo si contó TODAS las páginas):
 * words_basis="contador_traducat", la cifra de Haiku queda en words_haiku para auditoría.
 * Mitad bilingüe igual que transcribe-scan (round(w/2) por página).
 */
export function applyCounterToAnalysis(json: any, job: ContadorJob, opts: { image?: boolean } = {}): ApplyOutcome {
  if (!json || typeof json !== "object" || json.segmented || !json.document_metrics) {
    return { applied: false, reason: "analisis_no_aplicable" };
  }
  const total = job.paginas_total;
  const complete =
    job.estado === "hecho" && total > 0 && job.paginas_hechas >= total && job.palabras_por_pagina.length === total;
  if (!complete) return { applied: false, reason: "conteo_incompleto" };
  const m = json.document_metrics;
  // Imagen: las páginas las da el contador (TIFF multipágina = un frame por página).
  if (!opts.image && m.pages && m.pages !== total) return { applied: false, reason: "paginas_no_cuadran" };

  const bil = m.is_bilingual_duplicate === true;
  const perPage = job.palabras_por_pagina.map((w) => (bil ? Math.round(w / 2) : w));
  const counterWords = perPage.reduce((a, b) => a + b, 0);
  const haikuWords = m.words_basis === "contador_traducat" ? m.words_haiku ?? 0 : m.estimated_words || 0;

  const metrics = {
    ...m,
    estimated_words: counterWords,
    words_basis: "contador_traducat",
    words_haiku: haikuWords,
    words_haiku_basis: m.words_basis === "contador_traducat" ? m.words_haiku_basis ?? null : m.words_basis ?? null,
    words_per_page: perPage,
    low_pages: job.paginas_sin_texto,
  };
  const out: any = { ...json, document_metrics: metrics };
  if (json.price_risk && Array.isArray(json.price_risk.reasons)) {
    const reasons = json.price_risk.reasons.filter((r: string) => r !== "scan_not_fully_counted");
    out.price_risk = { ...json.price_risk, reasons, risky: reasons.length > 0 };
  }
  return { applied: true, json: out, counterWords, haikuWords };
}

/* ---------------- Presupuestos que ya usaron la cifra de Haiku ---------------- */

export const ALERT_QUOTE_STATUSES = ["SENT", "OPENED", "ACCEPTED", "PAID", "IN_PROGRESS", "DELIVERED"];

export type QuoteRef = { id: string; quoteNumber: string; status: string };
export type QuoteImpact = {
  diffPct: number;
  differs: boolean;
  alertQuotes: QuoteRef[]; // enviados/abiertos/aceptados/pagados: aviso a staff, el precio no se toca
  draftQuotes: QuoteRef[]; // borradores: se anota y se ve en la ficha
};

/** El presupuesto se hizo con la cifra de Haiku: si la del contador difiere >5 %, se avisa; nunca se reprecia. */
export function quoteImpact(haikuWords: number, counterWords: number, quotes: QuoteRef[]): QuoteImpact {
  const diffPct = haikuWords > 0 ? (Math.abs(counterWords - haikuWords) / haikuWords) * 100 : counterWords > 0 ? 100 : 0;
  const differs = diffPct > QUOTE_DIFF_PCT;
  return {
    diffPct: Math.round(diffPct * 10) / 10,
    differs,
    alertQuotes: differs ? quotes.filter((q) => ALERT_QUOTE_STATUSES.includes(q.status)) : [],
    draftQuotes: differs ? quotes.filter((q) => q.status === "DRAFT") : [],
  };
}

/* ---------------- Cron de respaldo ---------------- */

export type CronTrabajo = { estado: string; jobId: string | null; intentos: number; createdAt: Date; updatedAt: Date; aplicadoAt: Date | null };

export function retryDelayMs(intentos: number): number {
  return intentos <= 0 ? 0 : RETRY_BASE_MS * 2 ** (intentos - 1);
}

export function cronAction(t: CronTrabajo, now: number): "nada" | "abandonar" | "enviar" | "consultar" {
  if (t.aplicadoAt || t.estado === "hecho" || t.estado === "error" || t.estado === "abandonado") return "nada";
  if (now - t.createdAt.getTime() > GIVE_UP_MS) return "abandonar";
  if (t.estado === "sin_confirmar") return "nada";
  if (t.estado === "pendiente_envio" || !t.jobId) {
    if (t.intentos > MAX_SUBMIT_RETRIES) return "abandonar";
    return now - t.updatedAt.getTime() >= retryDelayMs(t.intentos) ? "enviar" : "nada";
  }
  return "consultar";
}
