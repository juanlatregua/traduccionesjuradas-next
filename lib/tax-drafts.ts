// lib/tax-drafts.ts — Borradores INTERNOS de impuestos trimestrales para la
// gestoría (no presentables ante la AEAT por sí solos; la gestoría los usa de
// guía). Todo en céntimos. Régimen: S.L., IVA general con ISP (art. 84 LIVA).

const ISP_RATE = 0.21;

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

// Modelo 303 — IVA trimestral, con desglose del IVA devengado por tipo (las
// casillas 01-09 del modelo), el IVA autorrepercutido por ISP (inversión del
// sujeto pasivo, art. 84 LIVA: suma al devengado Y al deducible — neto 0 si es
// 100% deducible, pero las casillas deben reflejarlo) y el IVA soportado
// deducible (casillas 28-29).
export type Draft303Rate = { ratePct: number; baseCents: number; cuotaCents: number };
export type Isp303Input = {
  intracomBaseCents?: number; // ISP adquis. intracomunitarias de servicios (toda la base: devenga)
  intracomDeducibleBaseCents?: number; // parte deducible (por defecto toda; art. 96 LIVA si no)
  importBaseCents?: number; // ISP importación de servicios (extra-UE)
  importDeducibleBaseCents?: number;
};
export type Draft303 = {
  devengado: Draft303Rate[]; // IVA repercutido desglosado por tipo
  ispIntracomBaseCents: number;
  ispIntracomCuotaCents: number;
  ispImportBaseCents: number;
  ispImportCuotaCents: number;
  ispCuotaDeducibleCents: number; // cuota ISP deducible (≤ devengada si hay ISP no deducible)
  ivaRepercutidoCents: number; // total cuota devengada (incluye cuotas ISP)
  baseDeducibleCents: number; // base de las cuotas soportadas deducibles (sin ISP)
  ivaSoportadoDeducibleCents: number; // cuota soportada deducible (incluye cuota ISP deducible)
  resultadoCents: number; // resultado (casilla 71): a ingresar (>0) o a compensar (<0)
};
export function build303(
  devengado: Draft303Rate[],
  baseDeducibleCents: number,
  ivaSoportadoDeducibleCents: number,
  isp: Isp303Input = {}
): Draft303 {
  const ispIntracomBaseCents = isp.intracomBaseCents ?? 0;
  const ispImportBaseCents = isp.importBaseCents ?? 0;
  const ispIntracomCuotaCents = Math.round(ispIntracomBaseCents * ISP_RATE);
  const ispImportCuotaCents = Math.round(ispImportBaseCents * ISP_RATE);
  // La cuota ISP se devenga SIEMPRE; solo se deduce la parte deducible (un gasto
  // ISP "no deducible" sube el resultado en el 21% de su base, no queda neutro).
  const ispCuotaDeducibleCents =
    Math.round((isp.intracomDeducibleBaseCents ?? ispIntracomBaseCents) * ISP_RATE) +
    Math.round((isp.importDeducibleBaseCents ?? ispImportBaseCents) * ISP_RATE);
  const ivaRepercutidoCents =
    devengado.reduce((a, r) => a + r.cuotaCents, 0) + ispIntracomCuotaCents + ispImportCuotaCents;
  const soportadoCents = ivaSoportadoDeducibleCents + ispCuotaDeducibleCents;
  return {
    devengado: devengado.filter((r) => r.baseCents > 0 || r.cuotaCents > 0),
    ispIntracomBaseCents,
    ispIntracomCuotaCents,
    ispImportBaseCents,
    ispImportCuotaCents,
    ispCuotaDeducibleCents,
    ivaRepercutidoCents,
    baseDeducibleCents,
    ivaSoportadoDeducibleCents: soportadoCents,
    resultadoCents: ivaRepercutidoCents - soportadoCents,
  };
}

// Modelo 111 — retenciones e ingresos a cuenta del IRPF (a colaboradores
// profesionales). Base = base de los gastos con retención; retención = IRPF.
export type Draft111 = {
  baseRetencionesCents: number;
  retencionesCents: number;
  numPerceptores: number;
};
export function build111(baseRetencionesCents: number, retencionesCents: number, numPerceptores: number): Draft111 {
  return { baseRetencionesCents, retencionesCents, numPerceptores };
}

// Texto descargable del borrador del trimestre (para pasar a la gestoría).
export function draftToText(period: string, d303: Draft303, d111: Draft111): string {
  const ispCuotaDevengada = d303.ispIntracomCuotaCents + d303.ispImportCuotaCents;
  const ispCuota = d303.ispCuotaDeducibleCents;
  const hasIsp = d303.ispIntracomBaseCents > 0 || d303.ispImportBaseCents > 0;
  return [
    `BORRADOR DE IMPUESTOS — ${period}`,
    `HBTJ Consultores Lingüísticos S.L. · uso interno (la gestoría presenta)`,
    ``,
    `== MODELO 303 (IVA) ==`,
    `IVA devengado (repercutido) por tipo:`,
    ...(d303.devengado.length
      ? d303.devengado.map((r) => `  · ${r.ratePct}%  base ${eur(r.baseCents)}  →  cuota ${eur(r.cuotaCents)}`)
      : ["  (sin facturas en el periodo)"]),
    ...(hasIsp
      ? [
          `IVA devengado por ISP (autorrepercutido, art. 84 LIVA):`,
          ...(d303.ispIntracomBaseCents > 0
            ? [`  · Adquis. intracomunitarias de servicios: base ${eur(d303.ispIntracomBaseCents)}  →  cuota ${eur(d303.ispIntracomCuotaCents)}`]
            : []),
          ...(d303.ispImportBaseCents > 0
            ? [`  · Importación de servicios: base ${eur(d303.ispImportBaseCents)}  →  cuota ${eur(d303.ispImportCuotaCents)}`]
            : []),
          `  (casillas exactas: validar con gestoría)`,
        ]
      : []),
    `  Total IVA devengado:                ${eur(d303.ivaRepercutidoCents)}`,
    `IVA soportado deducible (gastos):`,
    `  Base (facturas interiores):         ${eur(d303.baseDeducibleCents)}`,
    `  Cuota deducible (facturas):         ${eur(d303.ivaSoportadoDeducibleCents - ispCuota)}`,
    ...(hasIsp
      ? [
          `  Cuota deducible por ISP:            ${eur(ispCuota)} (casillas exactas: validar con gestoría)`,
          ...(ispCuota < ispCuotaDevengada
            ? [`  ⚠ ISP no deducible: ${eur(ispCuotaDevengada - ispCuota)} devengados sin deducción (art. 96 LIVA)`]
            : []),
          `  Total cuota deducible:              ${eur(d303.ivaSoportadoDeducibleCents)}`,
        ]
      : []),
    `RESULTADO:                            ${eur(d303.resultadoCents)} ${d303.resultadoCents >= 0 ? "(a ingresar)" : "(a compensar)"}`,
    ``,
    `== MODELO 111 (retenciones IRPF a colaboradores) ==`,
    `Base de las retenciones:  ${eur(d111.baseRetencionesCents)}`,
    `Retenciones practicadas:  ${eur(d111.retencionesCents)}`,
    `Nº de perceptores:        ${d111.numPerceptores}`,
    ``,
    `== IMPUESTO DE SOCIEDADES ==`,
    `S.L.: pagos fraccionados del IS por modelo 202 (lo presenta la gestoría).`,
  ].join("\n");
}
