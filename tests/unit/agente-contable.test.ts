import test from "node:test";
import assert from "node:assert/strict";
import { cierreEfectivo, decidirFacturaColaborador, esNifEspanol, type FacturaLeida } from "../../lib/agente-contable-logic.ts";

const now = new Date("2026-10-31T10:00:00Z");
const cierre = new Date("2026-10-01T00:00:00Z");
const autonoma = { fullName: "María Lourdes Yagüe Lobo", companyName: null, nif: "12345678Z", supplierType: "AUTONOMO" };
const empresa = { fullName: "Nielson Maycon de Souza Vilela", companyName: "Nielson Vilela Asesoría SL", nif: "B21633235", supplierType: "EMPRESA" };
const leida: FacturaLeida = {
  documentType: "factura",
  supplier: "María Lourdes Yagüe Lobo",
  supplierNif: "12345678-Z",
  recipientNif: "B93712784",
  supplierInvoiceNumber: "4241",
  date: "2026-10-08",
  baseEur: 70,
  vatRate: 0.21,
  irpfRate: 0.15,
  irpfEur: 10.5,
  totalEur: 84.7,
  confidence: 0.97,
};
const decidir = (over: Partial<FacturaLeida> = {}, extra: Partial<Parameters<typeof decidirFacturaColaborador>[0]> = {}) =>
  decidirFacturaColaborador({ leida: { ...leida, ...over }, colaborador: autonoma, devengoCents: 7000, lavori: { numero: null, importeCents: 7000 }, cierre, now, ...extra });
const motivo = (d: ReturnType<typeof decidir>) => (d.ok ? "ok" : d.motivo);

test("factura que cuadra: se contabiliza con los datos leídos", () => {
  const d = decidir();
  assert.equal(d.ok, true);
  if (d.ok) {
    assert.equal(d.baseCents, 7000);
    assert.equal(d.irpfPct, 0.15);
    assert.equal(d.supplierNif, "12345678Z");
  }
});

test("el total puede venir neto de retención", () => {
  assert.equal(decidir({ totalEur: 74.2 }).ok, true);
});

test("empresa sin IRPF cuadra; con IRPF se para", () => {
  const base = { supplier: "Nielson Vilela", supplierNif: "B21633235", baseEur: 37.19, totalEur: 45, irpfRate: 0, irpfEur: 0 };
  const extra = { colaborador: empresa, devengoCents: 3719, lavori: { numero: null, importeCents: 4500 } };
  assert.equal(decidir(base, extra).ok, true);
  assert.equal(motivo(decidir({ ...base, irpfRate: 0.15 }, extra)), "irpf_no_cuadra");
});

test("autónomo sin retención se para", () => {
  assert.equal(motivo(decidir({ irpfRate: 0, irpfEur: 0, totalEur: 84.7 })), "irpf_no_cuadra");
});

test("NIF portugués sin prefijo o con PT se para (Morton)", () => {
  assert.equal(esNifEspanol("123456789"), false);
  assert.equal(motivo(decidir({ supplierNif: "123456789" })), "nif_no_espanol");
  assert.equal(motivo(decidir({ supplierNif: "PT123456789" })), "nif_no_espanol");
  assert.equal(esNifEspanol("ES B93712784"), true);
});

test("base distinta del encargo se para; redondeo de 2 céntimos no (Nielson 440 frente a 402,04)", () => {
  const nielson = { supplier: "Nielson", supplierNif: "B21633235", irpfRate: 0, irpfEur: 0 };
  const lavori = (importeCents: number) => ({ numero: null, importeCents });
  assert.equal(motivo(decidir({ ...nielson, baseEur: 363.64, totalEur: 440 }, { colaborador: empresa, devengoCents: 40204, lavori: lavori(44000) })), "base_no_cuadra");
  const d = decidir({ ...nielson, baseEur: 33.06, totalEur: 40 }, { colaborador: empresa, devengoCents: 3305, lavori: lavori(4000) });
  assert.equal(d.ok, true);
  if (d.ok) assert.equal(d.diferenciaCents, 1);
});

test("sin devengo abierto se para", () => {
  assert.equal(motivo(decidir({}, { devengoCents: 0 })), "sin_devengo");
});

test("factura a otro receptor o de otro emisor se para", () => {
  assert.equal(motivo(decidir({ recipientNif: "B00000000" })), "receptor_ajeno");
  assert.equal(motivo(decidir({ recipientNif: null })), "receptor_ajeno");
  assert.equal(motivo(decidir({ supplierNif: "87654321X" })), "emisor_distinto");
});

test("sin NIF en ficha se para: nunca se aprende de un PDF", () => {
  assert.equal(motivo(decidir({}, { colaborador: { ...autonoma, nif: null } })), "sin_nif_ficha");
});

test("proforma o documento sin tipo se para", () => {
  assert.equal(motivo(decidir({ documentType: "proforma" })), "no_es_factura");
  assert.equal(motivo(decidir({ documentType: null })), "no_es_factura");
});

test("un PDF que no coincide con lo declarado en lavori se para", () => {
  assert.equal(motivo(decidir({}, { lavori: { numero: null, importeCents: 9900 } })), "lavori_no_cuadra");
  assert.equal(motivo(decidir({}, { lavori: { numero: "9999", importeCents: 7000 } })), "lavori_no_cuadra");
  assert.equal(decidir({ supplierInvoiceNumber: "26/4241" }, { lavori: { numero: "4241", importeCents: 8470 } }).ok, true);
});

test("número de factura con caracteres raros se para", () => {
  assert.equal(motivo(decidir({ supplierInvoiceNumber: "<a href=x>4241</a>" })), "lectura_dudosa");
});

test("retención leída distinta de la calculada se para", () => {
  assert.equal(motivo(decidir({ irpfEur: 4.9 })), "irpf_no_cuadra");
  assert.equal(motivo(decidir({ irpfEur: null })), "irpf_no_cuadra");
});

test("empresa con NIF personal se para: sería un autónomo sin retención", () => {
  const mal = { ...autonoma, supplierType: "EMPRESA" };
  assert.equal(motivo(decidir({ irpfRate: 0, irpfEur: 0 }, { colaborador: mal })), "irpf_no_cuadra");
});

test("IVA distinto del 21 % o total incoherente se para", () => {
  assert.equal(motivo(decidir({ vatRate: 0 })), "iva_no_general");
  assert.equal(motivo(decidir({ totalEur: 99 })), "total_no_cuadra");
});

test("fecha futura, ausente o en trimestre presentado se para", () => {
  assert.equal(motivo(decidir({ date: "2026-12-01" })), "fecha_invalida");
  assert.equal(motivo(decidir({ date: null })), "fecha_invalida");
  assert.equal(motivo(decidir({ date: "2026-09-31" })), "fecha_invalida");
  assert.equal(motivo(decidir({ date: "2026-09-30" })), "periodo_cerrado");
});

test("lectura incompleta o poco segura se para", () => {
  assert.equal(motivo(decidir({ confidence: 0.6 })), "lectura_dudosa");
  assert.equal(motivo(decidir({ confidence: undefined })), "lectura_dudosa");
  assert.equal(motivo(decidir({ supplierInvoiceNumber: " " })), "lectura_dudosa");
  assert.equal(motivo(decidir({ baseEur: null })), "lectura_dudosa");
});

test("cierreEfectivo: lo anterior al trimestre en curso nunca entra solo", () => {
  const t2 = new Date("2026-07-01T00:00:00Z");
  const inicioT4 = new Date("2026-09-30T22:00:00Z");
  assert.deepEqual(cierreEfectivo(t2, new Date("2026-10-02T10:00:00Z")), inicioT4);
  assert.deepEqual(cierreEfectivo(new Date("2026-12-01T00:00:00Z"), new Date("2026-12-02T10:00:00Z")), new Date("2026-12-01T00:00:00Z"));
});

test("sin importe declarado en lavori no hay contraste: se para", () => {
  assert.equal(motivo(decidir({}, { lavori: { numero: null, importeCents: 0 } })), "lavori_no_cuadra");
  assert.equal(motivo(decidir({}, { lavori: { numero: null, importeCents: null } })), "lavori_no_cuadra");
});

test("un número que solo acaba igual no vale", () => {
  assert.equal(motivo(decidir({ supplierInvoiceNumber: "14241" }, { lavori: { numero: "4241", importeCents: 7000 } })), "lavori_no_cuadra");
});
