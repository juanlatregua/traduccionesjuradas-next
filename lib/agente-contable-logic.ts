// lib/agente-contable-logic.ts — Decisión PURA del agente de contabilidad (sin BD ni
// IA): Claude solo lee la factura; aquí se decide con reglas si cuadra. Lo leído de un
// PDF es dato externo: se contrasta con la ficha, el encargo y lo que declaró lavori.
// Ante cualquier duda se para y lo pregunta (Juan, 30-oct-2026).

import { madridParts, madridStartOfMonthUtc, quarterOf } from "./period-grouping.ts";

export const HBTJ_NIF = "B93712784";
const CONFIANZA_MIN = 0.85;
const TOLERANCIA_CENTS = 2; // redondeos de ÷1,21 entre el devengo y la factura

export type FacturaLeida = {
  documentType?: string | null;
  supplier?: string | null;
  supplierNif?: string | null;
  recipientNif?: string | null;
  supplierInvoiceNumber?: string | null;
  date?: string | null;
  baseEur?: number | null;
  vatRate?: number | null;
  irpfRate?: number | null;
  irpfEur?: number | null;
  totalEur?: number | null;
  confidence?: number;
};

export type ColaboradorFiscal = {
  fullName: string;
  companyName: string | null;
  nif: string | null;
  supplierType: string | null;
};

export type MotivoParada =
  | "lectura_dudosa"
  | "no_es_factura"
  | "receptor_ajeno"
  | "sin_nif_ficha"
  | "emisor_distinto"
  | "nif_no_espanol"
  | "lavori_no_cuadra"
  | "iva_no_general"
  | "irpf_no_cuadra"
  | "total_no_cuadra"
  | "sin_devengo"
  | "base_no_cuadra"
  | "fecha_invalida"
  | "periodo_cerrado";

export const MOTIVO_TEXTO: Record<MotivoParada, string> = {
  lectura_dudosa: "no se ha podido leer con seguridad",
  no_es_factura: "el documento no es una factura ordinaria",
  receptor_ajeno: "la factura no va a nombre de HBTJ",
  sin_nif_ficha: "falta el NIF en la ficha del traductor",
  emisor_distinto: "el NIF del emisor no coincide con la ficha del traductor",
  nif_no_espanol: "el NIF no es español: falta saber cómo tratarla",
  lavori_no_cuadra: "lo leído no coincide con lo que declaró en lavori",
  iva_no_general: "no lleva el 21 % de IVA",
  irpf_no_cuadra: "la retención no encaja con el proveedor o con la factura",
  total_no_cuadra: "base, IVA y total no cuadran entre sí",
  sin_devengo: "el pedido no tiene coste abierto de este traductor",
  base_no_cuadra: "la base no coincide con el coste del encargo",
  fecha_invalida: "la fecha falta, no existe o es futura",
  periodo_cerrado: "la fecha cae en un trimestre ya presentado",
};

export type DecisionFactura =
  | { ok: true; number: string; date: string; baseCents: number; vatRate: number; irpfPct: number; supplierNif: string; diferenciaCents: number; taxTreatment: "general" | "isp_intracom" }
  | { ok: false; motivo: MotivoParada; detalle: string };

export const referenciaPedido = (concept: string) => /\(pedido ([^)]+)\)/.exec(concept)?.[1] ?? null;

export function normalizarNif(nif: string | null | undefined): string {
  return String(nif || "").replace(/[\s.\-]/g, "").toUpperCase().replace(/^ES/, "");
}

// Formato español (DNI, NIE o CIF). Un NIF portugués de 9 cifras no pasa.
export function esNifEspanol(nif: string | null | undefined): boolean {
  return /^([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z]|[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J])$/.test(normalizarNif(nif));
}

// NIF-IVA de otro Estado de la UE (prefijo de país + 2 a 12 caracteres). Grecia usa EL.
const PREFIJOS_UE = ["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "FI", "FR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"];
export function esNifIvaUe(nif: string | null | undefined): boolean {
  const n = normalizarNif(nif);
  return PREFIJOS_UE.includes(n.slice(0, 2)) && /^[A-Z]{2}[0-9A-Z]{2,12}$/.test(n);
}

const esCif = (nif: string) => /^[ABCDEFGHJNPQRSUVW]/.test(nif);

// El 303 solo se cierra en la app a mano y puede presentarse antes de cerrarlo: lo
// anterior al trimestre en curso nunca se contabiliza solo.
export function cierreEfectivo(cierre: Date, now: Date): Date {
  const { year, month } = madridParts(now);
  const inicio = madridStartOfMonthUtc(year, (quarterOf(month) - 1) * 3 + 1);
  return inicio > cierre ? inicio : cierre;
}

const aCents = (eur: number) => Math.round(eur * 100);
const esNumero = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
// «26/4241» vale por «4241», pero «14241» no.
const mismoNumero = (leido: string, declarado: string) => {
  const [l, d] = [leido, declarado].map((n) => n.trim().toUpperCase());
  return l === d || (l.endsWith(d) && !/[A-Z0-9]/.test(l[l.length - d.length - 1]));
};
const cerca = (a: number, b: number) => Math.abs(a - b) <= TOLERANCIA_CENTS;

export function decidirFacturaColaborador(input: {
  leida: FacturaLeida;
  colaborador: ColaboradorFiscal;
  devengoCents: number; // suma de los devengos abiertos del pedido y traductor
  lavori: { numero: string | null; importeCents: number | null }; // lo declarado al subirla
  cierre: Date; // resultado de cierreEfectivo
  now: Date;
}): DecisionFactura {
  const { leida, colaborador, devengoCents, lavori, cierre, now } = input;
  const parar = (motivo: MotivoParada, detalle: string): DecisionFactura => ({ ok: false, motivo, detalle });

  const number = String(leida.supplierInvoiceNumber || "").trim();
  if (!/^[\w\/.\- ]{1,40}$/.test(number) || !esNumero(leida.baseEur) || leida.baseEur <= 0 || !esNumero(leida.vatRate) || !esNumero(leida.totalEur)) {
    return parar("lectura_dudosa", "faltan número, base, IVA o total");
  }
  if (!esNumero(leida.confidence) || leida.confidence < CONFIANZA_MIN) {
    return parar("lectura_dudosa", `confianza ${leida.confidence ?? "desconocida"}`);
  }
  if (leida.documentType !== "factura") return parar("no_es_factura", `documento: ${leida.documentType || "sin tipo"}`);
  if (normalizarNif(leida.recipientNif) !== HBTJ_NIF) return parar("receptor_ajeno", `receptor ${leida.recipientNif || "sin NIF"}`);

  const nifFicha = normalizarNif(colaborador.nif);
  // La factura puede traer el NIF-IVA sin el prefijo de país («245167838» por PT245167838):
  // solo se completa con el de la ficha, nunca se deduce el país de un PDF.
  const leidoCrudo = normalizarNif(leida.supplierNif);
  const nifLeido = esNifIvaUe(nifFicha) && leidoCrudo === nifFicha.slice(2) ? nifFicha : leidoCrudo;
  // Proveedor de otro Estado de la UE (Morton, NIF PT): servicio intracomunitario con
  // inversión del sujeto pasivo, factura sin IVA y sin retención española.
  const intracom = esNifIvaUe(nifLeido);
  if (!intracom && !esNifEspanol(nifLeido)) return parar("nif_no_espanol", `NIF ${leida.supplierNif || "sin leer"}`);
  if (!nifFicha) return parar("sin_nif_ficha", colaborador.fullName);
  if (nifFicha !== nifLeido) return parar("emisor_distinto", `${leida.supplier || "emisor sin leer"} (${nifLeido})`);

  const vatRate = intracom ? 0 : 0.21;
  if (Math.abs(leida.vatRate - vatRate) > 0.0001) return parar("iva_no_general", `IVA ${leida.vatRate}${intracom ? " en factura intracomunitaria" : ""}`);

  const irpf = esNumero(leida.irpfRate) ? leida.irpfRate : 0;
  const irpfValido = intracom
    ? irpf === 0
    : colaborador.supplierType === "EMPRESA"
      ? irpf === 0 && esCif(nifLeido)
      : colaborador.supplierType === "AUTONOMO"
        ? Math.abs(irpf - 0.15) < 0.0001 || Math.abs(irpf - 0.07) < 0.0001
        : false;
  if (!irpfValido) return parar("irpf_no_cuadra", `IRPF ${irpf} en proveedor ${intracom ? "UE" : colaborador.supplierType || "sin tipo"} ${nifLeido}`);

  const baseCents = aCents(leida.baseEur);
  const vatCents = Math.round(baseCents * vatRate);
  const irpfCents = Math.round(baseCents * irpf);
  if (!cerca(aCents(esNumero(leida.irpfEur) ? leida.irpfEur : 0), irpfCents)) {
    return parar("irpf_no_cuadra", `retención leída ${leida.irpfEur ?? "ninguna"} · calculada ${irpfCents}`);
  }
  const totalCents = aCents(leida.totalEur);
  if (!cerca(totalCents, baseCents + vatCents) && !cerca(totalCents, baseCents + vatCents - irpfCents)) {
    return parar("total_no_cuadra", `base ${baseCents} · IVA ${vatCents} · total ${totalCents}`);
  }

  if (lavori.numero && !mismoNumero(number, lavori.numero)) {
    return parar("lavori_no_cuadra", `nº leído ${number} · lavori ${lavori.numero}`);
  }
  if (!lavori.importeCents) return parar("lavori_no_cuadra", "lavori no declaró importe");
  if (![baseCents, baseCents + vatCents, baseCents + vatCents - irpfCents].some((c) => cerca(c, lavori.importeCents as number))) {
    return parar("lavori_no_cuadra", `base leída ${baseCents} · lavori ${lavori.importeCents}`);
  }

  if (devengoCents <= 0) return parar("sin_devengo", "sin devengo abierto");
  if (!cerca(baseCents, devengoCents)) return parar("base_no_cuadra", `factura ${baseCents} · encargo ${devengoCents}`);

  const date = String(leida.date || "");
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00Z`) : null;
  if (!fecha || isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== date || fecha.getTime() > now.getTime() + 86_400_000) {
    return parar("fecha_invalida", date || "sin fecha");
  }
  if (fecha < cierre) return parar("periodo_cerrado", date);

  return { ok: true, number, date, baseCents, vatRate, irpfPct: irpf, supplierNif: nifLeido, diferenciaCents: baseCents - devengoCents, taxTreatment: intracom ? "isp_intracom" : "general" };
}
