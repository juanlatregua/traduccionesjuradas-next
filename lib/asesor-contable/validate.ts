// lib/asesor-contable/validate.ts — Validación de lo que devuelve Claude.
// PURO. Dos garantías:
//  1. Forma: el JSON tiene exactamente los campos esperados y los «enlaces» son
//     ids de hallazgos que existen en el dossier (no URLs inventadas).
//  2. Cifras: todo número que aparece en el texto sale del dossier. Si no,
//     la respuesta se rechaza.

import type { Dossier, Link } from "./dossier.ts";

export const GRAVEDADES = ["alta", "media", "baja", "info"] as const;
export type Gravedad = (typeof GRAVEDADES)[number];

export type Alerta = { gravedad: Gravedad; titulo: string; explicacion: string; cifra: string; enlaces: string[] };
export type Propuesta = { titulo: string; accion: string; impacto_estimado: string };
export type Analisis = { resumen: string; alertas: Alerta[]; propuestas: Propuesta[]; preguntas_gestoria: string[] };
export type Respuesta = { respuesta: string; enlaces: string[]; consultar_gestoria: boolean };

/** JSON Schema para output_config.format (structured outputs). */
export const ANALISIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["resumen", "alertas", "propuestas", "preguntas_gestoria"],
  properties: {
    resumen: { type: "string" },
    alertas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["gravedad", "titulo", "explicacion", "cifra", "enlaces"],
        properties: {
          gravedad: { type: "string", enum: [...GRAVEDADES] },
          titulo: { type: "string" },
          explicacion: { type: "string" },
          cifra: { type: "string" },
          enlaces: { type: "array", items: { type: "string" } },
        },
      },
    },
    propuestas: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "accion", "impacto_estimado"],
        properties: {
          titulo: { type: "string" },
          accion: { type: "string" },
          impacto_estimado: { type: "string" },
        },
      },
    },
    preguntas_gestoria: { type: "array", items: { type: "string" } },
  },
} as const;

export const RESPUESTA_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["respuesta", "enlaces", "consultar_gestoria"],
  properties: {
    respuesta: { type: "string" },
    enlaces: { type: "array", items: { type: "string" } },
    consultar_gestoria: { type: "boolean" },
  },
} as const;

// ── Extracción de números ───────────────────────────────────────────────────

// Fuera antes de contar: nº de factura (26_018, P26_001), referencia de pedido
// (2026-00027), fechas ISO, trimestres (T3) y nombres de modelo (303, 111…).
const STRIP_RES = [/\bP?\d{2}_\d{3,}\b/g, /\b\d{4}-\d{5}\b/g, /\b\d{4}-\d{2}-\d{2}\b/g, /\bT[1-4]\b/g];
// Siempre admitidos: 0 y 1, modelos tributarios y tipos legales habituales.
const ALWAYS_OK = new Set(["0", "1", "303", "111", "115", "130", "190", "347", "349", "390", "21", "7", "15"]);

const key = (n: number) => String(Math.round(Math.abs(n) * 100) / 100);

/** Valores posibles de un token numérico escrito en español (1.234,56 · 1234.56 · 12,5). */
function candidates(tok: string): number[] {
  const out = new Set<number>();
  const push = (s: string) => {
    const n = Number(s);
    if (Number.isFinite(n)) out.add(n);
  };
  const hasDot = tok.includes(".");
  const hasComma = tok.includes(",");
  if (hasDot && hasComma) {
    const dec = tok.lastIndexOf(",") > tok.lastIndexOf(".") ? "," : ".";
    const thou = dec === "," ? "." : ",";
    push(tok.split(thou).join("").replace(dec, "."));
  } else if (hasComma) {
    push(tok.replace(",", "."));
    if (/^\d{1,3}(,\d{3})+$/.test(tok)) push(tok.replace(/,/g, ""));
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(tok)) push(tok.replace(/\./g, ""));
    push(tok);
  } else {
    push(tok);
  }
  return [...out];
}

const TOKEN_RE = /\d+(?:[.,]\d+)*/g;

export function extractNumberTokens(text: string): string[] {
  let t = text;
  for (const re of STRIP_RES) t = t.replace(re, " ");
  return t.match(TOKEN_RE) ?? [];
}

type Allowed = { exact: Set<string>; rounded: Set<string> };

const allowedCache = new WeakMap<object, Allowed>();

export function allowedNumbers(dossier: Dossier): Allowed {
  const hit = allowedCache.get(dossier);
  if (hit) return hit;
  const exact = new Set<string>();
  const rounded = new Set<string>();
  const addNum = (n: number) => {
    exact.add(key(n));
    if (!Number.isInteger(n)) rounded.add(String(Math.round(Math.abs(n))));
  };
  const walk = (v: unknown) => {
    if (typeof v === "number") {
      if (Number.isFinite(v)) addNum(v);
    } else if (typeof v === "string") {
      // Números dentro de textos del dossier (fechas, referencias, nombres).
      for (const g of v.match(/\d+(?:[.,]\d+)*/g) ?? []) {
        for (const c of candidates(g)) addNum(c);
      }
      for (const g of v.match(/\d+/g) ?? []) addNum(Number(g));
    } else if (Array.isArray(v)) {
      v.forEach(walk);
    } else if (v && typeof v === "object") {
      Object.values(v as Record<string, unknown>).forEach(walk);
    }
  };
  walk(dossier);
  const res = { exact, rounded };
  allowedCache.set(dossier, res);
  return res;
}

/** Números del texto que NO salen del dossier. */
export function invalidNumbers(text: string, dossier: Dossier): string[] {
  const { exact, rounded } = allowedNumbers(dossier);
  const bad: string[] = [];
  for (const tok of extractNumberTokens(text)) {
    const cands = candidates(tok);
    const hasDecimals = /[.,]\d{1,2}$/.test(tok) && !/^\d{1,3}([.,]\d{3})+$/.test(tok);
    const ok = cands.some((c) => ALWAYS_OK.has(String(c)) || exact.has(key(c)) || (!hasDecimals && rounded.has(String(Math.round(Math.abs(c))))));
    if (!ok) bad.push(tok);
  }
  return bad;
}

// ── Validación de la forma ──────────────────────────────────────────────────

const isStr = (v: unknown): v is string => typeof v === "string";
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

function hallazgoIds(dossier: Dossier): Set<string> {
  return new Set(dossier.hallazgos.map((h) => h.id));
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[]; invalidNumbers: string[] };

export function validateAnalisis(raw: unknown, dossier: Dossier): ValidationResult<Analisis> {
  const errors: string[] = [];
  const o = raw as any;
  if (!o || typeof o !== "object") return { ok: false, errors: ["La respuesta no es un objeto."], invalidNumbers: [] };
  if (!isStr(o.resumen) || !o.resumen.trim()) errors.push("Falta «resumen».");
  if (!Array.isArray(o.alertas)) errors.push("«alertas» debe ser una lista.");
  if (!Array.isArray(o.propuestas)) errors.push("«propuestas» debe ser una lista.");
  if (!isStrArr(o.preguntas_gestoria)) errors.push("«preguntas_gestoria» debe ser una lista de textos.");
  if (errors.length) return { ok: false, errors, invalidNumbers: [] };

  const ids = hallazgoIds(dossier);
  const texts: string[] = [o.resumen];
  for (const [i, a] of (o.alertas as any[]).entries()) {
    if (!a || !GRAVEDADES.includes(a.gravedad) || !isStr(a.titulo) || !isStr(a.explicacion) || !isStr(a.cifra) || !isStrArr(a.enlaces)) {
      errors.push(`Alerta ${i + 1} mal formada.`);
      continue;
    }
    for (const id of a.enlaces) if (!ids.has(id)) errors.push(`La alerta ${i + 1} cita un hallazgo que no existe: ${id}.`);
    texts.push(a.titulo, a.explicacion, a.cifra);
  }
  for (const [i, p] of (o.propuestas as any[]).entries()) {
    if (!p || !isStr(p.titulo) || !isStr(p.accion) || !isStr(p.impacto_estimado)) {
      errors.push(`Propuesta ${i + 1} mal formada.`);
      continue;
    }
    texts.push(p.titulo, p.accion, p.impacto_estimado);
  }
  texts.push(...(o.preguntas_gestoria as string[]));
  if (errors.length) return { ok: false, errors, invalidNumbers: [] };

  const bad = [...new Set(texts.flatMap((t) => invalidNumbers(t, dossier)))];
  if (bad.length) return { ok: false, errors: [`Cifras que no están en el dossier: ${bad.join(", ")}.`], invalidNumbers: bad };

  return { ok: true, value: normalizeAnalisis(o as Analisis) };
}

export function validateRespuesta(raw: unknown, dossier: Dossier): ValidationResult<Respuesta> {
  const o = raw as any;
  if (!o || typeof o !== "object" || !isStr(o.respuesta) || !o.respuesta.trim() || !isStrArr(o.enlaces) || typeof o.consultar_gestoria !== "boolean") {
    return { ok: false, errors: ["Respuesta mal formada."], invalidNumbers: [] };
  }
  const ids = hallazgoIds(dossier);
  const errors = (o.enlaces as string[]).filter((id) => !ids.has(id)).map((id) => `Hallazgo inexistente: ${id}.`);
  if (errors.length) return { ok: false, errors, invalidNumbers: [] };
  const bad = invalidNumbers(o.respuesta, dossier);
  if (bad.length) return { ok: false, errors: [`Cifras que no están en el dossier: ${bad.join(", ")}.`], invalidNumbers: bad };
  return { ok: true, value: o as Respuesta };
}

// ── Normativa: lo que depende de la ley va a la gestoría ────────────────────

const LEGAL_RE = /deducib|deducci|art[ií]culo|\bley\b|liva|lirpf|exent|no sujet|inversi[oó]n del sujeto|regulariz|rectificativa|recargo|sanci[oó]n|bizum|operaci[oó]n(?:es)? (?:extranjer|intracomunit)|modelo \d{3}|presentar/i;

/** Una propuesta que depende de la ley se convierte en pregunta para la gestoría. */
export function normalizeAnalisis(a: Analisis): Analisis {
  const propuestas: Propuesta[] = [];
  const preguntas = [...a.preguntas_gestoria];
  for (const p of a.propuestas) {
    if (LEGAL_RE.test(`${p.titulo} ${p.accion}`)) preguntas.push(`${p.titulo}: ${p.accion}`.replace(/\s+/g, " ").trim());
    else propuestas.push(p);
  }
  return { ...a, propuestas, preguntas_gestoria: [...new Set(preguntas)] };
}

export function resolveLinks(ids: string[], dossier: Dossier): Link[] {
  const byId = new Map(dossier.hallazgos.map((h) => [h.id, h]));
  const seen = new Set<string>();
  const out: Link[] = [];
  for (const id of ids) {
    for (const l of byId.get(id)?.enlaces ?? []) {
      if (seen.has(l.url + l.label)) continue;
      seen.add(l.url + l.label);
      out.push(l);
    }
  }
  return out;
}
