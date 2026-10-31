// lib/panel-contable.ts — Cifras del panel diario de Contabilidad (puro). El IVA y las
// retenciones salen de aggregateFiscal, la misma fuente que los borradores 303/111.

import { aggregateFiscal, type FiscalExpense, type FiscalInvoice } from "./fiscal-aggregation.ts";
import { madridParts, madridStartOfMonthUtc, quarterOf } from "./period-grouping.ts";

export type PanelInvoice = FiscalInvoice & { issuedAt: Date };
export type PanelExpense = FiscalExpense & { date: Date; concept?: string };
export type PanelDevengo = { date: Date; baseCents: number };
export type PanelCobro = { date: Date; baseCents: number };

export type ResumenPanel = {
  ingresosMesCents: number;
  cobradoSinFacturaMesCents: number;
  gastosMesCents: number;
  costeSinFacturaMesCents: number;
  resultadoMesCents: number;
  ivaTrimestreCents: number;
  retencionesTrimestreCents: number;
  reservasCents: number;
  gastosSinCompletar: number; // needsReview sin las facturas de traductor, que lleva el agente
};

export function resumenPanelContable(input: {
  invoices: PanelInvoice[];
  expenses: PanelExpense[];
  devengos: PanelDevengo[];
  cobrosSinFactura: PanelCobro[]; // pedidos pagados aún sin factura: mismo ingreso que el balance
  now: Date;
}): ResumenPanel {
  const { year, month } = madridParts(input.now);
  const inicioMes = madridStartOfMonthUtc(year, month);
  const finMes = month === 12 ? madridStartOfMonthUtc(year + 1, 1) : madridStartOfMonthUtc(year, month + 1);
  const primerMes = (quarterOf(month) - 1) * 3 + 1;
  const inicioTrimestre = madridStartOfMonthUtc(year, primerMes);
  const finTrimestre = primerMes === 10 ? madridStartOfMonthUtc(year + 1, 1) : madridStartOfMonthUtc(year, primerMes + 3);
  const delMes = (d: Date) => d >= inicioMes && d < finMes;
  const delTrimestre = (d: Date) => d >= inicioTrimestre && d < finTrimestre;

  const ingresosMesCents = input.invoices.filter((i) => delMes(i.issuedAt)).reduce((a, i) => a + i.baseCents, 0);
  const cobradoSinFacturaMesCents = input.cobrosSinFactura.filter((c) => delMes(c.date)).reduce((a, c) => a + c.baseCents, 0);
  const gastosMesCents = input.expenses.filter((e) => delMes(e.date) && !e.needsReview).reduce((a, e) => a + e.baseCents, 0);
  const costeSinFacturaMesCents = input.devengos.filter((d) => delMes(d.date)).reduce((a, d) => a + d.baseCents, 0);

  const { d303, d111 } = aggregateFiscal(
    input.invoices.filter((i) => delTrimestre(i.issuedAt)),
    input.expenses.filter((e) => delTrimestre(e.date))
  );
  const ivaTrimestreCents = Math.max(0, d303.resultadoCents);
  const retencionesTrimestreCents = Math.max(0, d111.retencionesCents);

  return {
    ingresosMesCents,
    cobradoSinFacturaMesCents,
    gastosMesCents,
    costeSinFacturaMesCents,
    resultadoMesCents: ingresosMesCents + cobradoSinFacturaMesCents - gastosMesCents - costeSinFacturaMesCents,
    ivaTrimestreCents,
    retencionesTrimestreCents,
    reservasCents: ivaTrimestreCents + retencionesTrimestreCents,
    gastosSinCompletar: input.expenses.filter((e) => e.needsReview && delTrimestre(e.date) && !e.concept?.startsWith("Factura del sobre lavori")).length,
  };
}
