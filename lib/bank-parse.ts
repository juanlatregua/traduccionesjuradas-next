// lib/bank-parse.ts — Parseo del extracto bancario (puro, cliente y servidor).
// Sin crypto ni Prisma → seguro en el bundle del navegador (el hash y el cruce
// se hacen en el servidor con lib/bank-reconcile.ts).

import { detectDelimiter, splitCsvLine, toCents, mapColumns, parseDateFlexible } from "@/lib/csv";

export type BankTxn = {
  bookingDate: string; // ISO
  description: string;
  amountCents: number; // CON SIGNO: + ingreso / − cargo
  balanceCents?: number | null;
};

export type ColumnMapping = {
  date: number;
  description: number;
  amount?: number; // columna única con signo
  debit?: number; // cargo
  credit?: number; // abono
  balance?: number;
};

const BANK_COLS: Record<string, string[]> = {
  date: ["fecha", "fecha operacion", "f operacion", "f. operacion", "fecha valor", "fecha contable", "fecha movimiento", "f.valor"],
  description: ["concepto", "descripcion", "detalle", "movimiento", "concepto comun", "mas datos", "observaciones"],
  amount: ["importe", "importe (€)", "importe eur", "import", "cantidad", "importe euros"],
  debit: ["cargo", "adeudo", "debe", "debito"],
  credit: ["abono", "haber", "ingreso", "credito"],
  balance: ["saldo", "saldo (€)", "saldo eur"],
};

export function detectColumns(headers: string[]): ColumnMapping {
  const idx = mapColumns(headers, BANK_COLS);
  return {
    date: idx.date ?? 0,
    description: idx.description ?? 1,
    amount: idx.amount,
    debit: idx.debit,
    credit: idx.credit,
    balance: idx.balance,
  };
}

export function previewBankCsv(text: string): { headers: string[]; rows: string[][]; mapping: ColumnMapping; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { headers: [], rows: [], mapping: { date: 0, description: 1 }, error: "El CSV necesita cabecera y al menos una fila." };
  }
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim);
  const rows = lines.slice(1).map((l) => splitCsvLine(l, delim));
  return { headers, rows, mapping: detectColumns(headers) };
}

export function parseBankCsv(text: string, mapping?: ColumnMapping): { txns: BankTxn[]; skipped: number; error?: string } {
  const pv = previewBankCsv(text);
  if (pv.error) return { txns: [], skipped: 0, error: pv.error };
  const map = mapping || pv.mapping;
  const txns: BankTxn[] = [];
  let skipped = 0;
  for (const cells of pv.rows) {
    const date = parseDateFlexible(cells[map.date] || "");
    if (!date) {
      skipped++; // fila sin fecha (saldo inicial / totales / encabezados repetidos)
      continue;
    }
    let amountCents: number;
    if (map.amount !== undefined) {
      amountCents = toCents(cells[map.amount] || "");
    } else {
      const debit = map.debit !== undefined ? Math.abs(toCents(cells[map.debit] || "")) : 0;
      const credit = map.credit !== undefined ? Math.abs(toCents(cells[map.credit] || "")) : 0;
      amountCents = credit - debit;
    }
    if (amountCents === 0) {
      skipped++;
      continue;
    }
    txns.push({
      bookingDate: date.toISOString(),
      description: (cells[map.description] || "").trim(),
      amountCents,
      balanceCents: map.balance !== undefined && (cells[map.balance] || "").trim() ? toCents(cells[map.balance]) : null,
    });
  }
  return { txns, skipped };
}
