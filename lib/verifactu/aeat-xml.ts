// lib/verifactu/aeat-xml.ts — Sobre SOAP de remisión VERI*FACTU (RegFactuSistemaFacturacion).
//
// PURO: sin red, sin Prisma, sin reloj. Nombres, orden y namespaces salen de los XSD
// oficiales (SuministroLR.xsd / SuministroInformacion.xsd, v1.0) y de los ejemplos de
// «Veri-Factu_Descripcion_SWeb.pdf». El orden de los hijos importa: es un xs:sequence.
//
// Si a un registro le falta un dato obligatorio lanza AeatDataError con un texto
// que Juan pueda leer: ese registro no se envía y queda explicado.

import { formatAmount } from "./hash.ts";
import type { ProviderSendInput } from "./provider.ts";

export const NS_LR = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd";
export const NS_SF = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd";

export const EMITTER_NIF = "B93712784";
export const EMITTER_NAME = "HBTJ CONSULTORES LINGÜISTICOS SL";
export const DEFAULT_DESCRIPTION = "Servicios de traducción jurada";
export const MAX_RECORDS_PER_BATCH = 1000; // maxOccurs de RegistroFactura en SuministroLR.xsd

export class AeatDataError extends Error {}

export function xmlEscape(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const el = (name: string, value: string) => `<sf:${name}>${xmlEscape(value)}</sf:${name}>`;

// ── País texto libre → ISO 3166-1 alfa-2 ────────────────────────────────────────
const EU = new Set(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK"]);

const COUNTRIES: Record<string, string> = {
  espana: "ES", spain: "ES", espagne: "ES",
  francia: "FR", france: "FR",
  portugal: "PT",
  italia: "IT", italy: "IT", italie: "IT",
  alemania: "DE", germany: "DE", deutschland: "DE", allemagne: "DE",
  "reino unido": "GB", "united kingdom": "GB", uk: "GB", "gran bretana": "GB", inglaterra: "GB", england: "GB", "royaume-uni": "GB",
  "ee.uu.": "US", eeuu: "US", "estados unidos": "US", usa: "US", "united states": "US", "etats-unis": "US",
  marruecos: "MA", morocco: "MA", maroc: "MA",
  argelia: "DZ", algeria: "DZ", algerie: "DZ",
  tunez: "TN", tunisia: "TN", tunisie: "TN",
  "paises bajos": "NL", holanda: "NL", netherlands: "NL", "the netherlands": "NL", "pays-bas": "NL",
  belgica: "BE", belgium: "BE", belgique: "BE",
  suiza: "CH", switzerland: "CH", suisse: "CH",
  irlanda: "IE", ireland: "IE",
  austria: "AT",
  luxemburgo: "LU", luxembourg: "LU",
  rumania: "RO", romania: "RO",
  polonia: "PL", poland: "PL",
  suecia: "SE", sweden: "SE",
  dinamarca: "DK", denmark: "DK",
  noruega: "NO", norway: "NO",
  finlandia: "FI", finland: "FI",
  grecia: "GR", greece: "GR",
  rusia: "RU", russia: "RU",
  ucrania: "UA", ukraine: "UA",
  mexico: "MX",
  brasil: "BR", brazil: "BR",
  argentina: "AR",
  colombia: "CO",
  senegal: "SN",
  "costa de marfil": "CI", "cote d'ivoire": "CI",
  canada: "CA",
  china: "CN",
  japon: "JP", japan: "JP",
  andorra: "AD",
  mauritania: "MR",
  "emiratos arabes unidos": "AE",
  turquia: "TR", turkey: "TR",
};

function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/** País de la factura → ISO alfa-2. Vacío → España (valor por defecto del modelo). Desconocido → null. */
export function countryToIso(raw: string | null | undefined): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return "ES";
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return COUNTRIES[fold(t)] ?? null;
}

const SPANISH_NIF = /^([0-9A-Z]\d{7}[0-9A-Z])$/;

function cleanId(s: string): string {
  return s.replace(/[\s.\-]/g, "").toUpperCase();
}

/** IDDestinatario: NIF español → NIF; extranjero → IDOtro (02 NIF-IVA UE, 06 otro documento probatorio). */
export function recipientXml(r: NonNullable<ProviderSendInput["recipient"]>): string {
  const name = String(r.name ?? "").trim();
  if (!name) throw new AeatDataError("La factura completa (F1) no tiene nombre o razón social del destinatario.");
  const iso = countryToIso(r.country);
  if (!iso) throw new AeatDataError(`País «${r.country}» no reconocido: no se puede asignar código ISO al destinatario. Corrígelo en la factura.`);
  const id = cleanId(String(r.nif ?? ""));
  if (!id) throw new AeatDataError("La factura completa (F1) no tiene NIF/identificación del destinatario.");
  let ident: string;
  if (iso === "ES") {
    if (!SPANISH_NIF.test(id)) throw new AeatDataError(`NIF español «${r.nif}» con formato no válido (9 caracteres).`);
    ident = el("NIF", id);
  } else {
    const vatPrefix = iso === "GR" ? "EL" : iso;
    const isVat = EU.has(iso) && id.startsWith(vatPrefix) && id.length > 4;
    ident = `<sf:IDOtro>${el("CodigoPais", iso)}${el("IDType", isVat ? "02" : "06")}${el("ID", id)}</sf:IDOtro>`;
  }
  return `<sf:IDDestinatario>${el("NombreRazon", name)}${ident}</sf:IDDestinatario>`;
}

function chainXml(i: ProviderSendInput): string {
  if (!i.prevHash) return `<sf:Encadenamiento><sf:PrimerRegistro>S</sf:PrimerRegistro></sf:Encadenamiento>`;
  if (!i.prev) throw new AeatDataError("Falta la identificación del registro anterior de la cadena (número y fecha).");
  return (
    `<sf:Encadenamiento><sf:RegistroAnterior>` +
    el("IDEmisorFactura", i.prev.emitterNif) +
    el("NumSerieFactura", i.prev.numSerie) +
    el("FechaExpedicionFactura", i.prev.issueDate) +
    el("Huella", i.prevHash) +
    `</sf:RegistroAnterior></sf:Encadenamiento>`
  );
}

function sistemaXml(): string {
  return (
    `<sf:SistemaInformatico>` +
    el("NombreRazon", EMITTER_NAME) +
    el("NIF", EMITTER_NIF) +
    el("NombreSistemaInformatico", "traduccionesjuradas.net") +
    el("IdSistemaInformatico", "TJ") +
    el("Version", "1.0") +
    el("NumeroInstalacion", "1") +
    el("TipoUsoPosibleSoloVerifactu", "S") +
    el("TipoUsoPosibleMultiOT", "N") +
    el("IndicadorMultiplesOT", "N") +
    `</sf:SistemaInformatico>`
  );
}

function rateXml(rate: number): string {
  return String(Number((rate * 100).toFixed(2)));
}

/** RegistroAlta o RegistroAnulacion dentro de <sum:RegistroFactura>. */
export function registroXml(i: ProviderSendInput): string {
  if (i.emitterNif.toUpperCase() !== EMITTER_NIF) throw new AeatDataError(`Emisor ${i.emitterNif} sin datos de sistema informático configurados.`);
  const ref = i.recordId ? el("RefExterna", i.recordId) : "";
  if (i.kind === "ANULACION") {
    return (
      `<sum:RegistroFactura><sf:RegistroAnulacion>` +
      el("IDVersion", "1.0") +
      `<sf:IDFactura>${el("IDEmisorFacturaAnulada", i.emitterNif)}${el("NumSerieFacturaAnulada", i.numSerie)}${el("FechaExpedicionFacturaAnulada", i.issueDate)}</sf:IDFactura>` +
      ref +
      (i.sinRegistroPrevio ? el("SinRegistroPrevio", "S") : "") +
      chainXml(i) +
      sistemaXml() +
      el("FechaHoraHusoGenRegistro", i.generatedAtIso) +
      el("TipoHuella", "01") +
      el("Huella", i.hash) +
      `</sf:RegistroAnulacion></sum:RegistroFactura>`
    );
  }

  const type = i.invoiceType;
  const isRect = /^R[1-5]$/.test(type);
  if (!/^(F1|F2|F3|R[1-5])$/.test(type)) throw new AeatDataError(`Tipo de factura «${type}» no válido.`);
  const rate = i.vatRate ?? NaN;
  if (!Number.isFinite(rate) || rate <= 0) throw new AeatDataError("Factura sin IVA o con tipo no informado: el envío con IVA 0 % (exenta/no sujeta) aún no está soportado. Revisa la factura.");

  let rect = "";
  if (isRect) {
    if (!i.rectifies?.numSerie || !i.rectifies.issueDate) throw new AeatDataError("Rectificativa sin número y fecha de la factura rectificada.");
    // Por diferencias (I): los importes de la rectificativa son la diferencia (pueden ser negativos).
    rect =
      el("TipoRectificativa", "I") +
      `<sf:FacturasRectificadas><sf:IDFacturaRectificada>${el("IDEmisorFactura", i.emitterNif)}${el("NumSerieFactura", i.rectifies.numSerie)}${el("FechaExpedicionFactura", i.rectifies.issueDate)}</sf:IDFacturaRectificada></sf:FacturasRectificadas>`;
  }

  let dest = "";
  if (type === "F1" || type === "F3" || (isRect && i.recipient?.nif)) {
    if (!i.recipient) throw new AeatDataError("Factura completa sin datos del destinatario.");
    dest = `<sf:Destinatarios>${recipientXml(i.recipient)}</sf:Destinatarios>`;
  }

  const base = i.importeTotalCents - i.cuotaTotalCents;
  return (
    `<sum:RegistroFactura><sf:RegistroAlta>` +
    el("IDVersion", "1.0") +
    `<sf:IDFactura>${el("IDEmisorFactura", i.emitterNif)}${el("NumSerieFactura", i.numSerie)}${el("FechaExpedicionFactura", i.issueDate)}</sf:IDFactura>` +
    ref +
    el("NombreRazonEmisor", EMITTER_NAME) +
    el("TipoFactura", type) +
    rect +
    el("DescripcionOperacion", i.description?.trim() || DEFAULT_DESCRIPTION) +
    dest +
    `<sf:Desglose><sf:DetalleDesglose>` +
    el("ClaveRegimen", "01") +
    el("CalificacionOperacion", "S1") +
    el("TipoImpositivo", rateXml(rate)) +
    el("BaseImponibleOimporteNoSujeto", formatAmount(base)) +
    el("CuotaRepercutida", formatAmount(i.cuotaTotalCents)) +
    `</sf:DetalleDesglose></sf:Desglose>` +
    el("CuotaTotal", formatAmount(i.cuotaTotalCents)) +
    el("ImporteTotal", formatAmount(i.importeTotalCents)) +
    chainXml(i) +
    sistemaXml() +
    el("FechaHoraHusoGenRegistro", i.generatedAtIso) +
    el("TipoHuella", "01") +
    el("Huella", i.hash) +
    `</sf:RegistroAlta></sum:RegistroFactura>`
  );
}

/** Sobre SOAP completo para un lote de registros de UN emisor. */
export function buildEnvelope(inputs: ProviderSendInput[]): string {
  if (!inputs.length) throw new AeatDataError("Lote vacío.");
  if (inputs.length > MAX_RECORDS_PER_BATCH) throw new AeatDataError(`Máximo ${MAX_RECORDS_PER_BATCH} registros por envío.`);
  const nif = inputs[0].emitterNif.toUpperCase();
  if (inputs.some((i) => i.emitterNif.toUpperCase() !== nif)) throw new AeatDataError("Un envío solo puede llevar registros de un emisor.");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="${NS_LR}" xmlns:sf="${NS_SF}">` +
    `<soapenv:Header/><soapenv:Body><sum:RegFactuSistemaFacturacion>` +
    `<sum:Cabecera><sf:ObligadoEmision>${el("NombreRazon", EMITTER_NAME)}${el("NIF", nif)}</sf:ObligadoEmision></sum:Cabecera>` +
    inputs.map(registroXml).join("") +
    `</sum:RegFactuSistemaFacturacion></soapenv:Body></soapenv:Envelope>`
  );
}
