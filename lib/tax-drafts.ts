// lib/tax-drafts.ts — Borradores INTERNOS de impuestos trimestrales para la
// gestoría (no presentables ante la AEAT por sí solos; la gestoría los usa de
// guía). Todo en céntimos. Régimen: estimación directa, IVA general.

function eur(cents: number): string {
  return `${(cents / 100).toFixed(2)} €`;
}

// Modelo 303 — IVA trimestral.
export type Draft303 = {
  ivaRepercutidoCents: number; // IVA de las facturas emitidas (devengado)
  ivaSoportadoDeducibleCents: number; // IVA de gastos, solo el deducible
  resultadoCents: number; // a ingresar (>0) o a compensar (<0)
};
export function build303(ivaRepercutidoCents: number, ivaSoportadoDeducibleCents: number): Draft303 {
  return {
    ivaRepercutidoCents,
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
    `IVA repercutido (facturas):      ${eur(d303.ivaRepercutidoCents)}`,
    `IVA soportado deducible (gastos): ${eur(d303.ivaSoportadoDeducibleCents)}`,
    `RESULTADO:                        ${eur(d303.resultadoCents)} ${d303.resultadoCents >= 0 ? "(a ingresar)" : "(a compensar)"}`,
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
