// lib/tax-drafts.ts — Borradores INTERNOS de impuestos trimestrales para la
// gestoría (no presentables ante la AEAT por sí solos; la gestoría los usa de
// guía). Todo en céntimos. Régimen: estimación directa, IVA general.

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

// Modelo 303 — IVA trimestral, con desglose del IVA devengado por tipo (las
// casillas 01-09 del modelo) y el IVA soportado deducible (casillas 28-29).
export type Draft303Rate = { ratePct: number; baseCents: number; cuotaCents: number };
export type Draft303 = {
  devengado: Draft303Rate[]; // IVA repercutido desglosado por tipo
  ivaRepercutidoCents: number; // total cuota devengada (casilla 27)
  baseDeducibleCents: number; // base de las cuotas soportadas deducibles (casilla 28)
  ivaSoportadoDeducibleCents: number; // cuota soportada deducible (casilla 29)
  resultadoCents: number; // resultado (casilla 71): a ingresar (>0) o a compensar (<0)
};
export function build303(
  devengado: Draft303Rate[],
  baseDeducibleCents: number,
  ivaSoportadoDeducibleCents: number
): Draft303 {
  const ivaRepercutidoCents = devengado.reduce((a, r) => a + r.cuotaCents, 0);
  return {
    devengado: devengado.filter((r) => r.baseCents > 0 || r.cuotaCents > 0),
    ivaRepercutidoCents,
    baseDeducibleCents,
    ivaSoportadoDeducibleCents,
    resultadoCents: ivaRepercutidoCents - ivaSoportadoDeducibleCents,
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

// Modelo 130 — pago fraccionado del IRPF (estimación directa), ACUMULADO del
// año hasta el trimestre. Pago = 20% del rendimiento neto acumulado − pagos
// fraccionados de trimestres anteriores − retenciones soportadas del año.
export type Draft130 = {
  ingresosYtdCents: number;
  gastosYtdCents: number;
  rendimientoNetoCents: number;
  pagoFraccionado20Cents: number; // 20% del rendimiento neto acumulado
  pagosPreviosCents: number; // 130 de trimestres anteriores (lo aporta Juan/gestoría)
  retencionesSoportadasCents: number; // IRPF que clientes hayan retenido a Juan
  aIngresarCents: number;
};
export function build130(
  ingresosYtdCents: number,
  gastosYtdCents: number,
  pagosPreviosCents = 0,
  retencionesSoportadasCents = 0
): Draft130 {
  const rendimiento = ingresosYtdCents - gastosYtdCents;
  const pago20 = Math.round(Math.max(0, rendimiento) * 0.2);
  const aIngresar = Math.max(0, pago20 - pagosPreviosCents - retencionesSoportadasCents);
  return {
    ingresosYtdCents,
    gastosYtdCents,
    rendimientoNetoCents: rendimiento,
    pagoFraccionado20Cents: pago20,
    pagosPreviosCents,
    retencionesSoportadasCents,
    aIngresarCents: aIngresar,
  };
}

// Texto descargable del borrador del trimestre (para pasar a la gestoría).
export function draftToText(period: string, d303: Draft303, d111: Draft111, d130: Draft130): string {
  return [
    `BORRADOR DE IMPUESTOS — ${period}`,
    `HBTJ Consultores Lingüísticos S.L. · uso interno (la gestoría presenta)`,
    ``,
    `== MODELO 303 (IVA) ==`,
    `IVA devengado (repercutido) por tipo:`,
    ...(d303.devengado.length
      ? d303.devengado.map((r) => `  · ${r.ratePct}%  base ${eur(r.baseCents)}  →  cuota ${eur(r.cuotaCents)}`)
      : ["  (sin facturas en el periodo)"]),
    `  Total IVA devengado (casilla 27):   ${eur(d303.ivaRepercutidoCents)}`,
    `IVA soportado deducible (gastos):`,
    `  Base (casilla 28):                  ${eur(d303.baseDeducibleCents)}`,
    `  Cuota deducible (casilla 29):       ${eur(d303.ivaSoportadoDeducibleCents)}`,
    `RESULTADO (casilla 71):               ${eur(d303.resultadoCents)} ${d303.resultadoCents >= 0 ? "(a ingresar)" : "(a compensar)"}`,
    ``,
    `== MODELO 111 (retenciones IRPF a colaboradores) ==`,
    `Base de las retenciones:  ${eur(d111.baseRetencionesCents)}`,
    `Retenciones practicadas:  ${eur(d111.retencionesCents)}`,
    `Nº de perceptores:        ${d111.numPerceptores}`,
    ``,
    `== MODELO 130 (IRPF pago fraccionado, acumulado del año) ==`,
    `Ingresos acumulados:        ${eur(d130.ingresosYtdCents)}`,
    `Gastos acumulados:          ${eur(d130.gastosYtdCents)}`,
    `Rendimiento neto:           ${eur(d130.rendimientoNetoCents)}`,
    `Pago fraccionado (20%):     ${eur(d130.pagoFraccionado20Cents)}`,
    `− Pagos de trimestres ant.: ${eur(d130.pagosPreviosCents)} (a completar)`,
    `− Retenciones soportadas:   ${eur(d130.retencionesSoportadasCents)}`,
    `A INGRESAR (130):           ${eur(d130.aIngresarCents)}`,
    ``,
    `Nota: confirma con tu gestoría si presentas el 130 (puede no aplicar si >70% de`,
    `tus ingresos llevan retención). Los pagos de trimestres anteriores y las`,
    `retenciones soportadas debes añadirlos tú.`,
  ].join("\n");
}
