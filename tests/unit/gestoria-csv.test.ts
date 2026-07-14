import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoicesCsv, buildExpensesCsv } from "../../lib/gestoria-csv.ts";

const BOM = "﻿";

function invoiceRow(over: Partial<Parameters<typeof buildInvoicesCsv>[0][number]> = {}) {
  return {
    number: "26_001",
    issuedAt: new Date("2026-04-15T10:00:00Z"),
    createdAt: new Date("2026-04-01T10:00:00Z"),
    fiscalName: "Cliente SL",
    nif: "B12345678",
    baseCents: 10000,
    vatRate: 0.21,
    vatCents: 2100,
    totalCents: 12100,
    email: "cli@ejemplo.es",
    order: { reference: "TJ-1" },
    ...over,
  };
}

test("buildInvoicesCsv: BOM + cabecera + fila con coma decimal y CRLF", () => {
  const csv = buildInvoicesCsv([invoiceRow()]);
  assert.ok(csv.startsWith(BOM));
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines.length, 2);
  assert.equal(lines[0], "Numero;Fecha;Pedido;Cliente;NIF;Base imponible;IVA %;Cuota IVA;Total;Email");
  assert.equal(lines[1], "26_001;2026-04-15;TJ-1;Cliente SL;B12345678;100,00;21;21,00;121,00;cli@ejemplo.es");
});

test("buildInvoicesCsv: sin issuedAt cae a createdAt; escapa ';' y comillas", () => {
  const csv = buildInvoicesCsv([
    invoiceRow({ issuedAt: null, fiscalName: 'Peluquería "Ana"; CB', order: null, nif: null }),
  ]);
  const row = csv.slice(1).split("\r\n")[1];
  assert.ok(row.startsWith("26_001;2026-04-01;;"));
  assert.ok(row.includes('"Peluquería ""Ana""; CB"'));
});

function expenseRow(over: Record<string, unknown> = {}) {
  return {
    date: new Date("2026-05-02T00:00:00Z"),
    supplierInvoiceNumber: "F-77",
    supplier: "OpenAI",
    supplierNif: "IE1234567",
    concept: "API",
    category: "software",
    baseCents: 5000,
    vatRate: 0,
    vatCents: 0,
    ivaDeducible: true,
    taxTreatment: "isp_intracom",
    irpfRetentionPct: 0,
    irpfCents: 0,
    totalCents: 5000,
    payableCents: null,
    notes: null,
    attachmentUrl: "https://blob/x.pdf",
    ...over,
  };
}

test("buildExpensesCsv: 17 columnas, etiqueta de tratamiento, APagar cae a Total", () => {
  const csv = buildExpensesCsv([expenseRow()]);
  const lines = csv.slice(1).split("\r\n");
  assert.equal(
    lines[0],
    "Fecha;NumFacturaProveedor;Proveedor;NIF;Concepto;Categoria;Base;%IVA;IVA;IVADeducible;Tratamiento IVA;%IRPF;IRPF;Total;APagar;Notas;Justificante"
  );
  const cells = lines[1].split(";");
  assert.equal(cells.length, 17);
  assert.equal(cells[0], "2026-05-02");
  assert.equal(cells[6], "50,00");
  assert.equal(cells[9], "Si");
  assert.ok(/ISP|intracom/i.test(cells[10]));
  assert.equal(cells[14], "50,00"); // payableCents null → totalCents
});

test("buildExpensesCsv: IRPF y payable explícito con coma decimal; escapa saltos de línea", () => {
  const csv = buildExpensesCsv([
    expenseRow({
      taxTreatment: "general",
      vatRate: 0.21,
      vatCents: 1050,
      irpfRetentionPct: 0.15,
      irpfCents: 750,
      totalCents: 5300,
      payableCents: 5300,
      notes: "línea1\nlínea2",
    }),
  ]);
  const body = csv.slice(1).split("\r\n").slice(1).join("\r\n");
  assert.ok(body.includes(";15;7,50;53,00;53,00;"));
  assert.ok(body.includes('"línea1\nlínea2"'));
});
