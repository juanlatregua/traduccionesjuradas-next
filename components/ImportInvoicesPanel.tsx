"use client";

import { useState } from "react";

// Importa facturas históricas desde un CSV (exportado de Excel). Parseo en
// cliente, previsualización y confirmación. Crea facturas EMITIDAS en la
// numeración compartida. Formato CSV español (separador ; y decimales con coma)
// o estándar (, y punto): se autodetecta.

type Row = {
  number: string;
  date: string;
  fiscalName: string;
  nif: string;
  concept: string;
  brand: string;
  baseCents: number;
  vatCents: number;
  totalCents: number;
  error?: string;
};

const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-slate-100";

function norm(s: string) {
  return s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function detectDelimiter(line: string) {
  return (line.match(/;/g)?.length || 0) >= (line.match(/,/g)?.length || 0) ? ";" : ",";
}

function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (c === delim && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function toCents(raw: string): number {
  let s = String(raw || "").replace(/[€\s]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

const COLS: Record<string, string[]> = {
  number: ["numero", "numero factura", "n factura", "nº", "n", "num", "factura"],
  date: ["fecha", "fecha emision", "fecha factura"],
  fiscalName: ["cliente", "nombre", "nombre fiscal", "razon social"],
  nif: ["nif", "cif", "nif/cif", "dni"],
  base: ["base", "base imponible"],
  vat: ["iva", "cuota iva", "iva cuota", "i.v.a.", "cuota"],
  total: ["total", "total factura", "importe"],
  concept: ["concepto", "descripcion"],
  brand: ["marca", "actividad"],
};

function mapHeader(headers: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [key, names] of Object.entries(COLS)) {
      if (idx[key] === undefined && names.includes(n)) idx[key] = i;
    }
  });
  return idx;
}

function parseCsv(text: string): { rows: Row[]; headerError?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], headerError: "El CSV necesita una cabecera y al menos una fila." };
  const delim = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delim);
  const idx = mapHeader(headers);
  if (idx.number === undefined || idx.date === undefined) {
    return { rows: [], headerError: "Faltan columnas obligatorias: 'número' y 'fecha'." };
  }
  const get = (cells: string[], key: string) => (idx[key] !== undefined ? cells[idx[key]] || "" : "");

  const rows: Row[] = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delim);
    const number = get(cells, "number").trim();
    const date = get(cells, "date").trim();
    let base = toCents(get(cells, "base"));
    let vat = toCents(get(cells, "vat"));
    let total = toCents(get(cells, "total"));
    if (!base && total && vat) base = total - vat;
    if (!base && total && !vat) {
      base = Math.round(total / 1.21);
      vat = total - base;
    }
    if (!total) total = base + vat;
    const brandRaw = norm(get(cells, "brand"));
    const brand = brandRaw.includes("bonjour") || brandRaw.includes("hola") ? "holabonjour" : "traduccionesjuradas";

    let error: string | undefined;
    if (!/^\d{2}_\d{3,}$/.test(number)) error = "número inválido (AA_NNN)";
    else if (isNaN(new Date(date).getTime())) error = "fecha inválida";
    else if (base <= 0 && total <= 0) error = "importe vacío";

    return {
      number,
      date,
      fiscalName: get(cells, "fiscalName").trim(),
      nif: get(cells, "nif").trim(),
      concept: get(cells, "concept").trim(),
      brand,
      baseCents: base,
      vatCents: vat,
      totalCents: total,
      error,
    };
  });
  return { rows };
}

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

export default function ImportInvoicesPanel() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  function handleText(text: string) {
    setResult(null);
    const { rows, headerError } = parseCsv(text);
    setRows(rows);
    setHeaderError(headerError || null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result || ""));
    reader.readAsText(file, "utf-8");
  }

  const valid = rows.filter((r) => !r.error);

  async function doImport() {
    if (valid.length === 0) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/invoices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: valid.map((r) => ({
            number: r.number,
            date: r.date,
            fiscalName: r.fiscalName,
            nif: r.nif || null,
            concept: r.concept || null,
            brand: r.brand,
            baseCents: r.baseCents,
            vatCents: r.vatCents,
            totalCents: r.totalCents,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo importar.");
      setResult(
        `Importadas ${data.created}. ${data.failed ? `Fallidas ${data.failed}: ${data.errors.map((e: any) => `${e.number} (${e.error})`).join(", ")}` : ""}`
      );
      if (data.created > 0) setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      setResult(e?.message || "Error al importar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Importar facturas desde Excel (CSV)</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-cyan-300 hover:text-cyan-200">
          {open ? "Cerrar" : "Abrir importador"}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <p className="text-xs text-slate-400">
            En Excel: <strong>Guardar como → CSV</strong>. Columnas reconocidas (cabecera):{" "}
            <code className="text-slate-300">número, fecha, cliente, nif, base, iva, total, concepto, marca</code>. Se autodetecta el
            separador (; o ,) y los decimales con coma. Solo se importan filas válidas; los números duplicados se rechazan.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm text-slate-300" />
            <span className="text-xs text-slate-500">o pega el contenido abajo</span>
          </div>
          <textarea
            className={`mt-2 block h-24 w-full ${FIELD} font-mono text-xs`}
            placeholder="número;fecha;cliente;nif;base;iva;total;concepto&#10;26_002;2026-01-15;Cliente S.L.;B12345678;200,00;42,00;242,00;Servicio enero"
            onChange={(e) => handleText(e.target.value)}
          />

          {headerError && <p className="mt-2 text-xs text-rose-300">{headerError}</p>}

          {rows.length > 0 && (
            <>
              <div className="mt-3 overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-xs text-slate-200">
                  <thead className="bg-slate-800/60 text-left uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-3 py-1.5">Nº</th>
                      <th className="px-3 py-1.5">Fecha</th>
                      <th className="px-3 py-1.5">Cliente</th>
                      <th className="px-3 py-1.5 text-right">Base</th>
                      <th className="px-3 py-1.5 text-right">IVA</th>
                      <th className="px-3 py-1.5 text-right">Total</th>
                      <th className="px-3 py-1.5">Marca</th>
                      <th className="px-3 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.map((r, i) => (
                      <tr key={i} className={r.error ? "bg-rose-900/20" : undefined}>
                        <td className="px-3 py-1.5 font-mono">{r.number || "—"}</td>
                        <td className="px-3 py-1.5">{r.date}</td>
                        <td className="px-3 py-1.5">{r.fiscalName || "—"}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.baseCents)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.vatCents)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{eur(r.totalCents)}</td>
                        <td className="px-3 py-1.5">{r.brand === "holabonjour" ? "Hola Bonjour" : "TJ"}</td>
                        <td className="px-3 py-1.5 text-rose-300">{r.error || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={doImport}
                  disabled={busy || valid.length === 0}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? "Importando…" : `Importar ${valid.length} factura(s)`}
                </button>
                <span className="text-xs text-slate-500">
                  {rows.length} fila(s) · {valid.length} válida(s) · {rows.length - valid.length} con error
                </span>
              </div>
            </>
          )}

          {result && <p className="mt-2 text-xs text-cyan-300">{result}</p>}
        </div>
      )}
    </div>
  );
}
