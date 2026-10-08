import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDossier,
  dossierForModel,
  periodFromTag,
  previousPeriodTag,
  type DossierInput,
  type RawExpense,
  type RawInvoice,
  type RawOrder,
} from "../../lib/asesor-contable/dossier.ts";
import { aggregateFiscal } from "../../lib/fiscal-aggregation.ts";
import { invalidNumbers, normalizeAnalisis, validateAnalisis, validateRespuesta } from "../../lib/asesor-contable/validate.ts";

const T3 = periodFromTag("2026-T3")!;
const T2 = periodFromTag("2026-T2")!;

const inv = (o: Partial<RawInvoice> = {}): RawInvoice => ({
  id: "i1", number: "26_001", brand: "traduccionesjuradas", issuedAt: new Date("2026-07-10T10:00:00Z"), createdAt: new Date("2026-07-10T10:00:00Z"),
  baseCents: 10000, vatCents: 2100, totalCents: 12100, paidAt: null, orderPaid: false, dueDate: null, annulledAt: null,
  rectifiesId: null, orderReference: null, fiscalName: "Cliente SL", ...o,
});
const exp = (o: Partial<RawExpense> = {}): RawExpense => ({
  id: "e1", date: new Date("2026-08-05T10:00:00Z"), brand: "traduccionesjuradas", supplier: "Vercel", supplierNif: "X1", supplierInvoiceNumber: null,
  concept: "Hosting", category: "software", baseCents: 2000, vatCents: 420, totalCents: 2420, ivaDeducible: true, taxTreatment: "general",
  irpfCents: 0, isAccrual: false, settledById: null, needsReview: false, attachmentUrl: "https://blob/x.pdf", orderReference: null, ...o,
});
const ord = (o: Partial<RawOrder> = {}): RawOrder => ({
  reference: "2026-00001", paidAt: new Date("2026-08-01T10:00:00Z"), createdAt: new Date("2026-08-01T09:00:00Z"), amountCents: 12100,
  paymentMethod: "STRIPE", billingExcluded: false, billingExcludedReason: null, invoiceIssued: false, monthlyInvoiceIssued: false,
  supplierCostCents: 5000, assignedTo: null, langPair: "fr-es", ...o,
});
const input = (o: Partial<DossierInput> = {}): DossierInput => ({
  period: T3, previousPeriod: T2, today: "2026-10-08", invoices: [], openInvoices: [], expenses: [], orders: [], ...o,
});

test("periodos: etiqueta y trimestre anterior", () => {
  assert.equal(previousPeriodTag("2026-T1"), "2025-T4");
  assert.equal(previousPeriodTag("2026-01"), "2025-12");
  assert.equal(T3.tag, "2026-T3");
  assert.equal(periodFromTag("2026-13"), null);
});

test("ingresos por marca: anuladas fuera y rectificativa resta", () => {
  const d = buildDossier(input({
    invoices: [
      inv({ id: "a", number: "26_001" }),
      inv({ id: "b", number: "26_002", brand: "holabonjour", baseCents: 5000, vatCents: 1050, totalCents: 6050 }),
      inv({ id: "c", number: "26_003", annulledAt: new Date("2026-07-12T10:00:00Z") }),
      inv({ id: "r", number: "26_004", rectifiesId: "a", baseCents: -2000, vatCents: -420, totalCents: -2420 }),
    ],
  }));
  assert.equal(d.ingresos_facturados.base_eur, 130);
  assert.equal(d.ingresos_facturados.iva_repercutido_eur, 27.3);
  assert.equal(d.ingresos_facturados.facturas_anuladas_excluidas, 1);
  assert.deepEqual(d.ingresos_facturados.por_marca.map((m) => m.marca), ["holabonjour", "traduccionesjuradas"]);
});

test("devengo y su liquidación no se cuentan dos veces", () => {
  const d = buildDossier(input({
    expenses: [
      exp({ id: "dev", isAccrual: true, settledById: "fac", supplier: "Daniel", baseCents: 10000, vatCents: 0, totalCents: 10000, category: "colaborador" }),
      exp({ id: "fac", supplier: "Daniel", baseCents: 10000, vatCents: 0, totalCents: 10000, category: "colaborador", date: new Date("2026-08-31T10:00:00Z") }),
      exp({ id: "dev2", isAccrual: true, settledById: null, supplier: "Marta", baseCents: 4000, vatCents: 0, totalCents: 4000, category: "colaborador", orderReference: "2026-00009" }),
    ],
  }));
  assert.equal(d.gastos.base_eur, 100); // solo la factura real
  assert.equal(d.devengos_de_colaboradores.liquidados, 1);
  assert.equal(d.devengos_de_colaboradores.pendientes, 1);
  assert.equal(d.devengos_de_colaboradores.pendientes_base_eur, 40);
  assert.equal(d.resultado.resultado_con_devengos_pendientes_eur, -140); // 0 ingresos − 100 − 40
  assert.ok(d.hallazgos.some((h) => h.tipo === "devengo_pendiente" && h.enlaces[0].url.includes("2026-00009")));
});

test("cobros sin factura: Bizum separado del resto y excluye pedidos ya facturados", () => {
  const d = buildDossier(input({
    orders: [
      ord({ reference: "2026-00010", paymentMethod: "BIZUM", amountCents: 6050 }),
      ord({ reference: "2026-00011", amountCents: 12100 }),
      ord({ reference: "2026-00012", amountCents: 9999, invoiceIssued: true }),
      ord({ reference: "2026-00013", amountCents: 9999, monthlyInvoiceIssued: true }),
      ord({ reference: "2026-00014", amountCents: 3000, billingExcluded: true, billingExcludedReason: "regalo" }),
    ],
  }));
  assert.deepEqual(d.cobros_sin_factura.bizum, { pedidos: 1, total_eur: 60.5, base_eur: 50, iva_eur: 10.5 });
  assert.equal(d.cobros_sin_factura.otros.pedidos, 1);
  assert.equal(d.cobros_sin_factura.otros.total_eur, 121);
  assert.equal(d.cobros_sin_factura.otros.iva_eur, 21);
  assert.equal(d.cobros_sin_factura.apartados_de_facturacion.pedidos, 1);
  const b = d.hallazgos.find((h) => h.tipo === "cobro_sin_factura_bizum")!;
  assert.equal(b.enlaces[0].url, "/zona-traductor/pedido/2026-00010");
});

test("duplicado TGSS: cuota de autónomos frente a nómina en especie", () => {
  const d = buildDossier(input({
    expenses: [
      exp({ id: "t1", supplier: "TGSS", concept: "Cuota autónomos", category: "cuota", date: new Date("2026-08-28T10:00:00Z"), baseCents: 29400, vatCents: 0, totalCents: 29400 }),
      exp({ id: "t2", supplier: "Juan Silva", concept: "Nómina en especie: cuota de autónomos Seguridad Social", category: "nomina", date: new Date("2026-08-31T10:00:00Z"), baseCents: 29400, vatCents: 0, totalCents: 29400 }),
      exp({ id: "t3", supplier: "TGSS", concept: "Cuota autónomos", date: new Date("2026-09-28T10:00:00Z"), baseCents: 29400, vatCents: 0, totalCents: 29400 }), // un mes después: no
    ],
  }));
  assert.equal(d.posibles_duplicados, 1);
  const h = d.hallazgos.find((x) => x.tipo === "posible_duplicado")!;
  assert.equal(h.importes?.total_eur, 294);
  assert.equal(h.enlaces.length, 2);
});

test("no es duplicado si los números de factura del proveedor difieren", () => {
  const d = buildDossier(input({
    expenses: [exp({ id: "a", supplierInvoiceNumber: "F-1" }), exp({ id: "b", supplierInvoiceNumber: "F-2", date: new Date("2026-08-06T10:00:00Z") })],
  }));
  assert.equal(d.posibles_duplicados, 0);
});

test("numeración: hueco y fecha fuera de orden", () => {
  const d = buildDossier(input({
    invoices: [
      inv({ id: "1", number: "26_001", issuedAt: new Date("2026-07-01T10:00:00Z") }),
      inv({ id: "2", number: "26_002", issuedAt: new Date("2026-07-10T10:00:00Z") }),
      inv({ id: "4", number: "26_004", issuedAt: new Date("2026-07-05T10:00:00Z") }), // falta 26_003 y es anterior a 26_002
    ],
  }));
  assert.equal(d.numeracion.huecos, 1);
  assert.equal(d.numeracion.fuera_de_orden, 1);
  assert.match(d.hallazgos.find((h) => h.tipo === "hueco_numeracion")!.texto, /26_003/);
  assert.match(d.hallazgos.find((h) => h.tipo === "numeracion_fuera_de_orden")!.texto, /26_004/);
});

test("IVA, IRPF y 303 estimado salen de aggregateFiscal", () => {
  const d = buildDossier(input({
    invoices: [inv()],
    expenses: [
      exp({ id: "a" }),
      exp({ id: "b", supplier: "Atenciones", vatCents: 100, ivaDeducible: false }),
      exp({ id: "c", supplier: "Notion", taxTreatment: "isp_import", vatCents: 0 }),
      exp({ id: "d", supplier: "Ana", category: "colaborador", irpfCents: 300, vatCents: 0, baseCents: 2000, totalCents: 2000, date: new Date("2026-09-03T10:00:00Z") }),
    ],
  }));
  assert.equal(d.iva_estimado.repercutido_eur, 21 + 4.2); // facturas + cuota ISP autorrepercutida
  assert.equal(d.iva_estimado.soportado_deducible_eur, 4.2 + 4.2);
  assert.equal(d.iva_estimado.modelo_303_estimado_eur, 16.8);
  assert.equal(d.irpf_estimado.modelo_111_estimado_eur, 3);
  assert.equal(d.irpf_estimado.perceptores, 1);
});

test("el dossier cuadra con la página: los «por revisar» quedan fuera de gastos y 303 y van aparte", () => {
  const invoices = [inv({ baseCents: 500000, vatCents: 105000, totalCents: 605000 })];
  const expenses = [
    exp({ id: "ok1", baseCents: 100000, vatCents: 21000, totalCents: 121000 }),
    exp({ id: "ok2", category: "colaborador", baseCents: 50000, vatCents: 0, totalCents: 50000, irpfCents: 7500 }),
    exp({ id: "rev", needsReview: true, supplier: "Recurrente", baseCents: 4768, vatCents: 1001, totalCents: 5769, irpfCents: 700, attachmentUrl: null }),
    exp({ id: "acc", isAccrual: true, baseCents: 9999, vatCents: 0, totalCents: 9999 }),
  ];
  const d = buildDossier(input({ invoices, expenses }));
  // La página llama a aggregateFiscal con las facturas del periodo y los gastos NO devengo, sin filtrar por needsReview.
  const page = aggregateFiscal(invoices, expenses.filter((e) => !e.isAccrual));
  assert.equal(d.iva_estimado.modelo_303_estimado_eur, page.d303.resultadoCents / 100);
  assert.equal(d.iva_estimado.soportado_deducible_eur, page.d303.ivaSoportadoDeducibleCents / 100);
  assert.equal(d.irpf_estimado.modelo_111_estimado_eur, page.d111.retencionesCents / 100);
  assert.equal(d.gastos.base_eur, 1500); // sin los 47,68 € por revisar
  assert.equal(d.resultado.gastos_base_eur, 1500);
  assert.equal(d.gastos_por_revisar_aparte.base_eur, 47.68);
  assert.equal(d.gastos_por_revisar_aparte.iva_eur, 10.01);
  const h = d.hallazgos.find((x) => x.tipo === "gasto_por_revisar")!;
  assert.deepEqual(h.importes, { total_eur: 57.69, base_eur: 47.68, iva_eur: 10.01 });
});

test("porcentajes calculados en el dossier", () => {
  const d = buildDossier(input({
    previousPeriod: T2,
    invoices: [
      inv({ id: "p", number: "26_001", issuedAt: new Date("2026-04-10T10:00:00Z"), baseCents: 100000, vatCents: 21000, totalCents: 121000 }),
      inv({ id: "a", number: "26_002", baseCents: 200000, vatCents: 42000, totalCents: 242000 }),
      inv({ id: "b", number: "26_003", brand: "holabonjour", baseCents: 200000, vatCents: 42000, totalCents: 242000 }),
    ],
    expenses: [exp({ id: "g", baseCents: 100000, vatCents: 21000, totalCents: 121000 })],
  }));
  assert.equal(d.resultado.margen_sobre_ingresos_pct, 75);
  assert.equal(d.comparativa_periodo_anterior?.variacion_ingresos_pct, 300);
  assert.equal(d.ingresos_facturados.por_marca[0].peso_sobre_ingresos_pct, 50);
  assert.equal(d.gastos.por_categoria[0].peso_sobre_gastos_pct, 100);
});

test("la vista para la IA no lleva nombres, asignados ni URLs", () => {
  const d = buildDossier(input({
    openInvoices: [inv({ id: "z", number: "26_050", fiscalName: "Cliente Secreto SL", dueDate: new Date("2026-09-01T10:00:00Z") })],
    expenses: [exp({ id: "q", supplier: "Daniel Colaborador", attachmentUrl: "https://abc.public.blob.vercel-storage.com/x.pdf", needsReview: true })],
    orders: [ord({ reference: "2026-00031", assignedTo: "Marta Jurada", supplierCostCents: null, billingExcluded: true, billingExcludedReason: "Regalo a Pepe" })],
  }));
  const txt = JSON.stringify(dossierForModel(d));
  for (const secreto of ["Cliente Secreto", "Daniel Colaborador", "Marta Jurada", "blob.vercel", "Pepe", "https://"]) assert.ok(!txt.includes(secreto), secreto);
  assert.ok(txt.includes("26_050") && txt.includes("2026-00031"));
  // …pero los enlaces del servidor siguen existiendo.
  assert.ok(d.hallazgos.some((h) => h.enlaces.some((l) => l.url.startsWith("https://abc"))));
});

test("ruido: FR sin coste, TGSS sin adjunto, orden fuera del periodo, marca dev", () => {
  const d = buildDossier(input({
    orders: [
      ord({ reference: "2026-00040", langPair: "fr-es", supplierCostCents: null }),
      ord({ reference: "2026-00041", langPair: "es-en", supplierCostCents: null }),
    ],
    expenses: [
      exp({ id: "t", supplier: "TGSS", concept: "Cuota autónomos", attachmentUrl: null, baseCents: 29400, vatCents: 0, totalCents: 29400, supplierNif: "Q2827003A" }),
      exp({ id: "n", supplier: "Juan", concept: "Nómina en especie", category: "nomina", attachmentUrl: null, baseCents: 10000, vatCents: 0, totalCents: 10000, supplierNif: "1" }),
      exp({ id: "s", supplier: "Otro", attachmentUrl: null, supplierNif: "2", baseCents: 777, vatCents: 0, totalCents: 777 }),
    ],
    invoices: [
      // desorden en el T2 (fuera del periodo T3): no se reporta
      inv({ id: "1", number: "26_001", issuedAt: new Date("2026-05-10T10:00:00Z") }),
      inv({ id: "2", number: "26_002", issuedAt: new Date("2026-05-02T10:00:00Z") }),
      inv({ id: "3", number: "26_003", issuedAt: new Date("2026-07-02T10:00:00Z") }),
      inv({ id: "d", number: "26_004", brand: "dev", issuedAt: new Date("2026-07-03T10:00:00Z"), baseCents: 40000, vatCents: 8400, totalCents: 48400 }),
    ],
  }));
  assert.equal(d.margen_por_pedido.sin_coste_registrado, 1);
  assert.equal(d.revision_de_gastos.sin_adjunto, 1);
  assert.equal(d.numeracion.fuera_de_orden, 0);
  const x = d.hallazgos.find((h) => h.tipo === "ingreso_marca_atipica")!;
  assert.match(x.texto, /dev/);
  assert.deepEqual(x.importes, { total_eur: 484, base_eur: 400, iva_eur: 84 });
});

test("pendientes de cobro, vencidas y margen", () => {
  const d = buildDossier(input({
    openInvoices: [
      inv({ id: "v", number: "26_010", dueDate: new Date("2026-09-30T10:00:00Z") }),
      inv({ id: "p", number: "26_011" }),
      inv({ id: "ok", number: "26_012", orderPaid: true }),
    ],
    orders: [
      ord({ reference: "2026-00020", supplierCostCents: null, langPair: "es-en" }),
      ord({ reference: "2026-00021", supplierCostCents: 10000 }), // base 100 − coste 100 = 0
      ord({ reference: "2026-00022", supplierCostCents: 4000 }),
    ],
  }));
  assert.equal(d.cobros_pendientes.facturas, 2);
  assert.equal(d.cobros_pendientes.vencidas, 1);
  assert.equal(d.margen_por_pedido.sin_coste_registrado, 1);
  assert.equal(d.margen_por_pedido.margen_no_positivo, 1);
});

// ── Validación «sin cifras inventadas» ──────────────────────────────────────

const dossier = buildDossier(input({
  invoices: [inv({ baseCents: 123456, vatCents: 25926, totalCents: 149382 })],
  expenses: [exp({ baseCents: 200000, vatCents: 42000, totalCents: 242000 })],
  orders: [ord({ reference: "2026-00010", paymentMethod: "BIZUM", amountCents: 6050 })],
}));

test("cifras del dossier en formato español pasan; inventadas no", () => {
  assert.deepEqual(invalidNumbers("Ingresaste 1.234,56 € y gastaste 2.000,00 €", dossier), []);
  assert.deepEqual(invalidNumbers("Bizum: 60,50 € en el pedido 2026-00010 de la factura 26_001 (T3, modelo 303)", dossier), []);
  assert.deepEqual(invalidNumbers("Pierdes 1.500,25 €", dossier), ["1.500,25"]);
  assert.deepEqual(invalidNumbers("Un 37 % menos", dossier), ["37 %"]);
});

const okAnalisis = {
  resumen: "Ingresos de 1.234,56 € frente a gastos de 2.000,00 €: sale en rojo.",
  alertas: [{ gravedad: "alta", titulo: "Cobro por Bizum sin factura", explicacion: "Hay 60,50 € sin facturar.", cifra: "60,50 €", enlaces: ["B1"] }],
  propuestas: [{ titulo: "Adjuntar justificantes", accion: "Sube los PDF que faltan.", impacto_estimado: "" }],
  preguntas_gestoria: [],
};

test("validateAnalisis acepta una respuesta con cifras del dossier", () => {
  const r = validateAnalisis(okAnalisis, dossier);
  assert.equal(r.ok, true);
});

test("validateAnalisis rechaza una cifra inventada en una alerta", () => {
  const bad = { ...okAnalisis, alertas: [{ ...okAnalisis.alertas[0], cifra: "999,99 €" }] };
  const r = validateAnalisis(bad, dossier);
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.invalidNumbers, ["999,99"]);
});

test("validateAnalisis rechaza enlaces a hallazgos inexistentes", () => {
  const bad = { ...okAnalisis, alertas: [{ ...okAnalisis.alertas[0], enlaces: ["Z9"] }] };
  assert.equal(validateAnalisis(bad, dossier).ok, false);
});

test("lo que depende de la ley pasa de propuestas a preguntas para la gestoría", () => {
  const out = normalizeAnalisis({
    resumen: "x",
    alertas: [],
    propuestas: [
      { titulo: "Regularizar los Bizum", accion: "Presentar rectificativa del 303", impacto_estimado: "" },
      { titulo: "Reclamar factura vencida", accion: "Escribe al cliente", impacto_estimado: "" },
    ],
    preguntas_gestoria: [],
  });
  assert.equal(out.propuestas.length, 1);
  assert.equal(out.propuestas[0].titulo, "Reclamar factura vencida");
  assert.equal(out.preguntas_gestoria.length, 1);
  assert.match(out.preguntas_gestoria[0], /Regularizar los Bizum/);
});

test("validateRespuesta: cifras y enlaces", () => {
  assert.equal(validateRespuesta({ respuesta: "El gasto es de 2.000,00 €.", enlaces: [], consultar_gestoria: false }, dossier).ok, true);
  assert.equal(validateRespuesta({ respuesta: "El gasto es de 3.333,33 €.", enlaces: [], consultar_gestoria: false }, dossier).ok, false);
});

const dossierPct = buildDossier(input({
  previousPeriod: T2,
  invoices: [
    inv({ id: "p", number: "26_001", issuedAt: new Date("2026-04-10T10:00:00Z"), baseCents: 100000, vatCents: 21000, totalCents: 121000 }),
    inv({ id: "a", number: "26_002", baseCents: 129897, vatCents: 27278, totalCents: 157175 }),
  ],
  expenses: [exp({ id: "g", baseCents: 20000, vatCents: 4200, totalCents: 24200 })],
}));

test("porcentajes: solo si el dossier los trae calculados", () => {
  const margen = dossierPct.resultado.margen_sobre_ingresos_pct!; // 84,6
  assert.ok(margen > 84 && margen < 85);
  assert.deepEqual(invalidNumbers(`Margen del ${String(margen).replace(".", ",")} %`, dossierPct), []);
  assert.deepEqual(invalidNumbers("Margen del 85 %", dossierPct), []); // redondeo a entero
  assert.deepEqual(invalidNumbers("Bajó un 42,5 %", dossierPct), ["42,5 %"]);
  assert.deepEqual(invalidNumbers("IVA al 21 %", dossierPct), []);
});

test("importes: «unos/aprox.» admite redondeos del dossier; sin marcador, no", () => {
  // base de ingresos 1.298,97
  assert.deepEqual(invalidNumbers("unos 1.300 € de ingresos", dossierPct), []);
  assert.deepEqual(invalidNumbers("aprox. 1.300 € de ingresos", dossierPct), []);
  assert.deepEqual(invalidNumbers("1.300 € de ingresos", dossierPct), ["1.300"]);
  assert.deepEqual(invalidNumbers("unos 1.700 € de ingresos", dossierPct), ["1.700"]);
});

test("números sueltos (fechas, referencias, recuentos) no se validan por coincidencia", () => {
  assert.deepEqual(invalidNumbers("El 15 de septiembre, pedido 2026-00099, factura 26_777, 7 pedidos, año 2026, 3T", dossierPct), []);
});
