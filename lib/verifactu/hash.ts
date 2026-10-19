// lib/verifactu/hash.ts — Huella (hash) de los REGISTROS DE FACTURACIÓN según la
// especificación técnica de la AEAT para el RD 1007/2023 (SIF / VERI*FACTU).
//
// Módulo PURO a propósito: sin Prisma, sin fetch, sin fecha implícita. Se prueba
// con node --test contra el ejemplo oficial de la AEAT (ver tests/unit/verifactu.test.ts).
//
// Reglas de la especificación que este módulo encarna:
//   · La cadena es "campo=valor&campo=valor…" en el orden fijado, sin espacios.
//   · Los valores van tal cual figuran en el registro (importes con punto decimal,
//     fecha de expedición dd-mm-aaaa, fecha-hora de generación ISO 8601 con huso).
//   · El primer registro de la cadena lleva Huella= vacío.
//   · SHA-256 sobre la cadena en UTF-8, salida hexadecimal en MAYÚSCULAS (64 chars).
//   · La cadena de anulación usa los campos de la factura anulada.
//
// Lo que NO decide este módulo: quién envía (proveedor colaborador social o
// nosotros), ni la modalidad. Solo fabrica huellas reproducibles.

import { createHash } from "crypto";

export type InvoiceType = "F1" | "F2" | "F3" | "R1" | "R2" | "R3" | "R4" | "R5";

export type AltaRecordInput = {
  emitterNif: string; // IDEmisorFactura
  numSerie: string; // NumSerieFactura (serie + número tal cual va en la factura)
  issueDate: Date | string; // FechaExpedicionFactura → dd-mm-aaaa
  invoiceType: InvoiceType; // TipoFactura
  cuotaTotalCents: number; // CuotaTotal (IVA repercutido)
  importeTotalCents: number; // ImporteTotal
  prevHash: string | null; // Huella del registro anterior de ESTE emisor; null/"" si es el primero
  generatedAt: Date | string; // FechaHoraHusoGenRegistro → ISO 8601 con huso (+01:00 / +02:00)
  tzOffsetMinutes?: number; // huso a usar para generatedAt; por defecto el de la fecha en Europe/Madrid
};

export type AnulacionRecordInput = {
  emitterNif: string; // IDEmisorFacturaAnulada
  numSerie: string; // NumSerieFacturaAnulada
  issueDate: Date | string; // FechaExpedicionFacturaAnulada
  prevHash: string | null; // Huella del registro anterior
  generatedAt: Date | string;
  tzOffsetMinutes?: number;
};

/** Importe en formato AEAT: punto decimal, dos decimales, sin separador de miles. */
export function formatAmount(cents: number): string {
  const n = Math.round(Number(cents) || 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Fecha de expedición en dd-mm-aaaa (fecha civil española). */
export function formatIssueDate(d: Date | string): string {
  if (typeof d === "string" && /^\d{2}-\d{2}-\d{4}$/.test(d)) return d;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha de expedición inválida.");
  const parts = madridParts(date);
  return `${parts.day}-${parts.month}-${parts.year}`;
}

/** Fecha-hora de generación ISO 8601 con huso horario explícito (sin milisegundos). */
export function formatGeneratedAt(d: Date | string, tzOffsetMinutes?: number): string {
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(d)) return d;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha-hora de generación inválida.");
  const offset = tzOffsetMinutes ?? madridOffsetMinutes(date);
  const local = new Date(date.getTime() + offset * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  const sign = offset >= 0 ? "+" : "-";
  const a = Math.abs(offset);
  return (
    `${local.getUTCFullYear()}-${p(local.getUTCMonth() + 1)}-${p(local.getUTCDate())}` +
    `T${p(local.getUTCHours())}:${p(local.getUTCMinutes())}:${p(local.getUTCSeconds())}` +
    `${sign}${p(Math.floor(a / 60))}:${p(a % 60)}`
  );
}

/** Cadena canónica del registro de ALTA (la que se hashea). */
export function buildAltaString(input: AltaRecordInput): string {
  const pairs: [string, string][] = [
    ["IDEmisorFactura", clean(input.emitterNif).toUpperCase()],
    ["NumSerieFactura", clean(input.numSerie)],
    ["FechaExpedicionFactura", formatIssueDate(input.issueDate)],
    ["TipoFactura", input.invoiceType],
    ["CuotaTotal", formatAmount(input.cuotaTotalCents)],
    ["ImporteTotal", formatAmount(input.importeTotalCents)],
    ["Huella", (input.prevHash || "").trim().toUpperCase()],
    ["FechaHoraHusoGenRegistro", formatGeneratedAt(input.generatedAt, input.tzOffsetMinutes)],
  ];
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

/** Cadena canónica del registro de ANULACIÓN. */
export function buildAnulacionString(input: AnulacionRecordInput): string {
  const pairs: [string, string][] = [
    ["IDEmisorFacturaAnulada", clean(input.emitterNif).toUpperCase()],
    ["NumSerieFacturaAnulada", clean(input.numSerie)],
    ["FechaExpedicionFacturaAnulada", formatIssueDate(input.issueDate)],
    ["Huella", (input.prevHash || "").trim().toUpperCase()],
    ["FechaHoraHusoGenRegistro", formatGeneratedAt(input.generatedAt, input.tzOffsetMinutes)],
  ];
  return pairs.map(([k, v]) => `${k}=${v}`).join("&");
}

/** SHA-256 en hexadecimal MAYÚSCULAS sobre la cadena en UTF-8. */
export function sha256Upper(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").toUpperCase();
}

export function altaHash(input: AltaRecordInput): { canonical: string; hash: string } {
  const canonical = buildAltaString(input);
  return { canonical, hash: sha256Upper(canonical) };
}

export function anulacionHash(input: AnulacionRecordInput): { canonical: string; hash: string } {
  const canonical = buildAnulacionString(input);
  return { canonical, hash: sha256Upper(canonical) };
}

/**
 * Verifica una cadena de registros de un emisor: cada huella debe reproducirse
 * desde su cadena canónica y enlazar con la anterior. Devuelve el primer índice
 * roto o -1 si la cadena es íntegra.
 */
export function verifyChain(records: { canonical: string; hash: string; prevHash: string | null }[]): number {
  let prev = "";
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if ((r.prevHash || "") !== prev) return i;
    if (sha256Upper(r.canonical) !== r.hash) return i;
    prev = r.hash;
  }
  return -1;
}

/**
 * Como verifyChain, pero con el CORTE de activación del envío directo: el primer
 * registro no-LOCAL puede llevar prevHash vacío y reinicia la cadena (los LOCAL
 * anteriores quedan como histórico interno, nunca enviado). Un registro no-LOCAL
 * encadena con el último no-LOCAL (o, si no hay corte posible, con el anterior).
 */
export function verifyChainWithCut(records: { canonical: string; hash: string; prevHash: string | null; sendStatus: string }[]): number {
  let prev = "";
  let prevSent: string | null = null;
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const p = r.prevHash || "";
    if (sha256Upper(r.canonical) !== r.hash) return i;
    if (r.sendStatus === "LOCAL") {
      if (p !== prev) return i;
    } else {
      const ok = prevSent === null ? p === "" || p === prev : p === prevSent || p === prev;
      if (!ok) return i;
      prevSent = r.hash;
    }
    prev = r.hash;
  }
  return -1;
}

/** ¿Se encadena y envía el registro nuevo? Con proveedor, o si el emisor ya tiene algún registro no-LOCAL: nunca vuelve a haber LOCAL tras el primer no-LOCAL. */
export function shouldChain(providerActive: boolean, hasNonLocal: boolean): boolean {
  return providerActive || hasNonLocal;
}

/** Rechazados SIN resolver: ningún alta posterior de la misma factura (la subsanación) los releva. */
export function unresolvedRejected<T extends { invoiceId: string; chainIndex: number }>(rejected: T[], altas: { invoiceId: string; chainIndex: number }[]): T[] {
  return rejected.filter((r) => !altas.some((a) => a.invoiceId === r.invoiceId && a.chainIndex > r.chainIndex));
}

/**
 * Marcas de un alta según los altas anteriores de la MISMA factura: Subsanacion=S si hay alguno,
 * y RechazoPrevio=X si ninguno llegó a registrarse en la AEAT (todos rechazados o sin enviar).
 */
export function subsanacionFlags(earlierStatuses: string[]): { subsanacion: boolean; rechazoPrevio: boolean } {
  if (!earlierStatuses.length) return { subsanacion: false, rechazoPrevio: false };
  return { subsanacion: true, rechazoPrevio: !earlierStatuses.some((s) => s === "ACCEPTED" || s === "ACCEPTED_WITH_ERRORS") };
}

/** Una anulación lleva SinRegistroPrevio=S si ningún alta de la factura está registrado en la AEAT. */
export function anulacionSinRegistroPrevio(altaStatuses: string[]): boolean {
  return !altaStatuses.some((s) => s === "ACCEPTED" || s === "ACCEPTED_WITH_ERRORS");
}

function clean(s: string): string {
  return String(s ?? "").trim();
}

// ── Europe/Madrid sin dependencias: offset por fecha (CET/CEST) ────────────────
function madridOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Madrid",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second)
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

function madridParts(date: Date): { day: string; month: string; year: string } {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return { day: parts.day, month: parts.month, year: parts.year };
}
