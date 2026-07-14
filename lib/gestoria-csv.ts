// lib/gestoria-csv.ts — Generadores puros de los CSV para la gestoría
// (facturas emitidas y gastos). Separador ';', coma decimal y BOM Excel.
// Fuente única: los usan las rutas de export y el paquete gestoría.

import { taxTreatmentLabel } from "./expense-math.ts";

function eur(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function csvCell(value: string) {
  const v = String(value ?? "");
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export type InvoiceCsvRow = {
  number: string | null;
  issuedAt: Date | null;
  createdAt: Date;
  fiscalName: string;
  nif: string | null;
  baseCents: number;
  vatRate: number;
  vatCents: number;
  totalCents: number;
  email: string | null;
  order: { reference: string } | null;
};

export function buildInvoicesCsv(rows: InvoiceCsvRow[]): string {
  const header = [
    "Numero",
    "Fecha",
    "Pedido",
    "Cliente",
    "NIF",
    "Base imponible",
    "IVA %",
    "Cuota IVA",
    "Total",
    "Email",
  ].join(";");

  const body = rows.map((inv) =>
    [
      inv.number || "",
      (inv.issuedAt || inv.createdAt).toISOString().slice(0, 10),
      inv.order?.reference || "",
      inv.fiscalName,
      inv.nif || "",
      eur(inv.baseCents),
      String(Math.round(inv.vatRate * 100)),
      eur(inv.vatCents),
      eur(inv.totalCents),
      inv.email || "",
    ]
      .map(csvCell)
      .join(";")
  );

  return "﻿" + [header, ...body].join("\r\n"); // BOM para Excel
}

export type ExpenseCsvRow = {
  date: Date;
  supplierInvoiceNumber: string | null;
  supplier: string | null;
  supplierNif: string | null;
  concept: string;
  category: string | null;
  baseCents: number;
  vatRate: number;
  vatCents: number;
  ivaDeducible: boolean;
  taxTreatment: string;
  irpfRetentionPct: number;
  irpfCents: number;
  totalCents: number;
  payableCents: number | null;
  notes: string | null;
  attachmentUrl: string | null;
};

export function buildExpensesCsv(rows: ExpenseCsvRow[]): string {
  const header = ["Fecha", "NumFacturaProveedor", "Proveedor", "NIF", "Concepto", "Categoria", "Base", "%IVA", "IVA", "IVADeducible", "Tratamiento IVA", "%IRPF", "IRPF", "Total", "APagar", "Notas", "Justificante"].join(";");
  const body = rows.map((r) =>
    [
      r.date.toISOString().slice(0, 10),
      r.supplierInvoiceNumber || "",
      r.supplier || "",
      r.supplierNif || "",
      r.concept,
      r.category || "",
      eur(r.baseCents),
      String(Math.round(r.vatRate * 100)),
      eur(r.vatCents),
      r.ivaDeducible ? "Si" : "No",
      taxTreatmentLabel(r.taxTreatment),
      String(Math.round(r.irpfRetentionPct * 100)),
      eur(r.irpfCents),
      eur(r.totalCents),
      eur(r.payableCents ?? r.totalCents),
      r.notes || "",
      r.attachmentUrl || "",
    ]
      .map(csvCell)
      .join(";")
  );

  return "﻿" + [header, ...body].join("\r\n");
}
