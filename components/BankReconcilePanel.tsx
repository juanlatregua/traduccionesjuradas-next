"use client";

import { useState } from "react";
import { previewBankCsv, parseBankCsv, type BankTxn, type ColumnMapping } from "@/lib/bank-parse";
import { BRAND_OPTIONS } from "@/lib/invoice-brands";

// Conciliación bancaria: sube el extracto (CSV), mapea columnas, cuadra contra
// facturas/pedidos/gastos. Las acciones reutilizan #2 (facturar) y #5 (gasto).
// No se persiste el extracto; solo decisiones (ignorar/emparejar) por hash.

type Txn = BankTxn;
type ReconResult = any; // tipos del servidor; se consume de forma laxa en cliente

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}
function fdate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const FIELD = "rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100";

export default function BankReconcilePanel({ canIssue }: { canIssue: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [amountMode, setAmountMode] = useState<"single" | "debitcredit">("single");
  const [result, setResult] = useState<ReconResult | null>(null);
  const [brand, setBrand] = useState("traduccionesjuradas");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function loadText(t: string) {
    setText(t);
    setResult(null);
    setMsg(null);
    const pv = previewBankCsv(t);
    if (pv.error) {
      setMsg(pv.error);
      setHeaders([]);
      setMapping(null);
      return;
    }
    setHeaders(pv.headers);
    setMapping(pv.mapping);
    setAmountMode(pv.mapping.amount !== undefined ? "single" : "debitcredit");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => loadText(String(reader.result || ""));
    reader.readAsText(f, "utf-8");
  }

  function colSelect(label: string, key: keyof ColumnMapping) {
    return (
      <label className="text-xs text-slate-400">
        {label}
        <select
          className={`mt-1 block w-40 ${FIELD}`}
          value={mapping?.[key] ?? -1}
          onChange={(e) => setMapping((m) => ({ ...(m as ColumnMapping), [key]: Number(e.target.value) < 0 ? undefined : Number(e.target.value) }))}
        >
          <option value={-1}>(ninguna)</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h || `col ${i + 1}`}
            </option>
          ))}
        </select>
      </label>
    );
  }

  async function runReconcile() {
    if (!mapping) return;
    const { txns, error } = parseBankCsv(text, mapping);
    if (error) {
      setMsg(error);
      return;
    }
    if (txns.length === 0) {
      setMsg("No se detectaron movimientos con fecha e importe.");
      return;
    }
    await postReconcile(txns);
  }

  async function postReconcile(txns: Txn[]) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/bank/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: txns }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cuadrar.");
      setResult(data.result);
    } catch (e: any) {
      setMsg(e?.message || "Error al cuadrar.");
    } finally {
      setBusy(false);
    }
  }

  // Re-cuadra con el mismo extracto tras una acción (factura/gasto/decisión).
  async function refresh() {
    if (!mapping) return;
    const { txns } = parseBankCsv(text, mapping);
    await postReconcile(txns);
  }

  async function facturar(reference: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/reconcile/orders/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ references: [reference], dateMode: "paid" }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo facturar.");
      if (d.failedCount) setMsg(`No se facturó ${reference}: ${d.failed?.[0]?.error || ""}`);
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error al facturar.");
      setBusy(false);
    }
  }

  async function registrarGasto(txn: Txn, vatRate: number) {
    const abs = -txn.amountCents;
    // El importe del cargo es el TOTAL pagado. Si lleva IVA, la base = total/(1+iva);
    // si es exento (0%), la base es el total (mayoría de comisiones/SS/seguros).
    const baseCents = vatRate > 0 ? Math.round(abs / (1 + vatRate)) : abs;
    setBusy(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: txn.bookingDate.slice(0, 10),
          concept: txn.description || "Gasto bancario",
          baseCents,
          vatRate,
          brand,
          notes: "Desde conciliación bancaria",
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo registrar.");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error al registrar gasto.");
      setBusy(false);
    }
  }

  async function decide(lineHash: string, status: "IGNORED" | "MATCHED_MANUAL", extra?: { matchedType?: string; matchedId?: string; note?: string; movementDate?: string }) {
    setBusy(true);
    try {
      const res = await fetch("/api/bank/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineHash, status, brand, ...extra }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "No se pudo guardar la decisión.");
      await refresh();
    } catch (e: any) {
      setMsg(e?.message || "Error.");
      setBusy(false);
    }
  }

  const t = result?.totals;

  return (
    <div className="mt-10 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Conciliación bancaria (CSV del banco)</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-cyan-300 hover:text-cyan-200">
          {open ? "Cerrar" : "Abrir"}
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <p className="text-xs text-slate-400">
            Sube el extracto de tu banco (BBVA) en CSV. Cruzo cada <strong>ingreso</strong> con facturas/pedidos y cada{" "}
            <strong>cargo</strong> con gastos, y te marco lo que no cuadra. No se guarda el extracto, solo tus decisiones.
          </p>

          <label className="mt-3 block text-xs text-slate-400">
            Marca / actividad de esta cuenta (para gastos y decisiones)
            <select className={`mt-1 block w-64 ${FIELD}`} value={brand} onChange={(e) => setBrand(e.target.value)}>
              {BRAND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm text-slate-300" />
            <span className="text-xs text-slate-500">o pega el contenido abajo</span>
          </div>
          <textarea
            className={`mt-2 block h-20 w-full ${FIELD} font-mono text-xs`}
            placeholder="Fecha;Concepto;Importe;Saldo&#10;15/03/2026;Transferencia cliente;242,00;3.450,00"
            value={text}
            onChange={(e) => loadText(e.target.value)}
          />

          {/* Mapeo de columnas */}
          {headers.length > 0 && mapping && (
            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mapeo de columnas</p>
              <div className="mt-2 flex flex-wrap items-end gap-3">
                {colSelect("Fecha", "date")}
                {colSelect("Concepto", "description")}
                <label className="text-xs text-slate-400">
                  Importe
                  <select className={`mt-1 block w-44 ${FIELD}`} value={amountMode} onChange={(e) => setAmountMode(e.target.value as any)}>
                    <option value="single">Columna única con signo</option>
                    <option value="debitcredit">Cargo / Abono separados</option>
                  </select>
                </label>
                {amountMode === "single" ? colSelect("→ Importe", "amount") : (
                  <>
                    {colSelect("→ Cargo", "debit")}
                    {colSelect("→ Abono", "credit")}
                  </>
                )}
                {colSelect("Saldo (opc.)", "balance")}
                <button type="button" onClick={runReconcile} disabled={busy} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
                  {busy ? "Cuadrando…" : "Cuadrar"}
                </button>
              </div>
            </div>
          )}

          {msg && <p className="mt-2 text-xs text-amber-300">{msg}</p>}

          {/* Resultado */}
          {result && (
            <div className="mt-4 space-y-4">
              {!result.balanceCheck.ok && (
                <p className="rounded-lg border border-rose-700 bg-rose-900/20 p-2 text-xs text-rose-200">⚠ {result.balanceCheck.message}</p>
              )}
              {result.balanceCheck.ok && result.balanceCheck.message && (
                <p className="text-xs text-emerald-300">✓ {result.balanceCheck.message}</p>
              )}

              <div className="grid gap-2 text-xs sm:grid-cols-3">
                <div className="rounded-lg border border-slate-700 p-2">Ingresos extracto: <b className="tabular-nums">{eur(t.bankIn)}</b> · cuadrados {eur(t.matchedIn)} · sin factura {eur(t.gapIn)}</div>
                <div className="rounded-lg border border-slate-700 p-2">Cargos extracto: <b className="tabular-nums">{eur(t.bankOut)}</b> · cuadrados {eur(t.matchedOut)} · sin gasto {eur(t.gapOut)}</div>
                <div className="rounded-lg border border-slate-700 p-2">Cuadrados {result.matched.length} · Ambiguos {result.ambiguous.length} · Internos {result.internal.length} · Ignorados {result.ignored.length}</div>
              </div>

              <Section title={`Cobros sin factura (${result.incomeNoInvoice.length}) → facturar (#2)`} color="amber">
                {result.incomeNoInvoice.map((it: any, i: number) => (
                  <Row key={i} txn={it.txn} extra={it.flags?.includes("netOfFee") ? "neto de comisión" : undefined}>
                    {it.candidateOrder && canIssue && (
                      <button type="button" disabled={busy} onClick={() => facturar(it.candidateOrder.reference)} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                        Facturar {it.candidateOrder.reference}
                      </button>
                    )}
                    {canIssue && <IgnoreBtn onClick={() => decide(it.lineHash, "IGNORED", { note: "no facturable" })} />}
                  </Row>
                ))}
              </Section>

              <Section title={`Cargos sin gasto (${result.chargeNoExpense.length}) → registrar gasto (#5)`} color="rose">
                {result.chargeNoExpense.map((it: any, i: number) =>
                  canIssue ? (
                    <ChargeRow
                      key={i}
                      txn={it.txn}
                      busy={busy}
                      onRegister={registrarGasto}
                      onIgnore={() => decide(it.lineHash, "IGNORED", { note: "no es gasto" })}
                      availableExpenses={result.availableExpenses}
                      onLink={(expenseId) => decide(it.lineHash, "MATCHED_MANUAL", { matchedType: "expense", matchedId: expenseId, movementDate: it.txn.bookingDate })}
                    />
                  ) : (
                    <Row key={i} txn={it.txn} />
                  )
                )}
              </Section>

              <Section title={`Ambiguos (${result.ambiguous.length}) → elige`} color="amber">
                {result.ambiguous.map((it: any, i: number) => (
                  <Row key={i} txn={it.txn}>
                    {canIssue &&
                      it.candidates.map((c: any, j: number) => (
                        <button key={j} type="button" disabled={busy} onClick={() => decide(it.lineHash, "MATCHED_MANUAL", { matchedType: c.type, matchedId: c.id, movementDate: it.txn.bookingDate })} className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">
                          {c.label}
                        </button>
                      ))}
                  </Row>
                ))}
              </Section>

              <Section title={`Ingresos sin identificar (${result.unmatchedIncome.length})`} color="slate">
                {result.unmatchedIncome.map((it: any, i: number) => (
                  <Row key={i} txn={it.txn} extra={it.label}>
                    {canIssue && (
                      <>
                        {result.availableInvoices.length > 0 && (
                          <select
                            disabled={busy}
                            value=""
                            onChange={(e) => e.target.value && decide(it.lineHash, "MATCHED_MANUAL", { matchedType: "invoice", matchedId: e.target.value, movementDate: it.txn.bookingDate })}
                            className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                          >
                            <option value="">Vincular a factura…</option>
                            {result.availableInvoices.map((inv: { id: string; label: string }) => (
                              <option key={inv.id} value={inv.id}>{inv.label}</option>
                            ))}
                          </select>
                        )}
                        <IgnoreBtn onClick={() => decide(it.lineHash, "IGNORED", { note: it.label || "otra actividad" })} />
                      </>
                    )}
                  </Row>
                ))}
              </Section>

              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer">Cuadrados, internos e ignorados ({result.matched.length + result.internal.length + result.ignored.length})</summary>
                <div className="mt-2 space-y-2">
                  {result.matched.map((it: any, i: number) => <Row key={"m" + i} txn={it.txn} extra={`✓ ${it.label}`} />)}
                  {result.internal.map((it: any, i: number) =>
                    canIssue && it.txn.amountCents < 0 ? (
                      <ChargeRow
                        key={"in" + i}
                        txn={it.txn}
                        busy={busy}
                        onRegister={registrarGasto}
                        onIgnore={() => decide(it.lineHash, "IGNORED", { note: it.label })}
                        availableExpenses={result.availableExpenses}
                        onLink={(expenseId) => decide(it.lineHash, "MATCHED_MANUAL", { matchedType: "expense", matchedId: expenseId, movementDate: it.txn.bookingDate })}
                      />
                    ) : (
                      <Row key={"in" + i} txn={it.txn} extra={it.label} />
                    )
                  )}
                  {result.ignored.map((it: any, i: number) => (
                    <Row key={"ig" + i} txn={it.txn} extra={`ignorado${it.note ? `: ${it.note}` : ""}`}>
                      {canIssue && (
                        <button type="button" disabled={busy} onClick={() => fetch("/api/bank/decision", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lineHash: it.lineHash }) }).then(refresh)} className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800">
                          Deshacer
                        </button>
                      )}
                    </Row>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  const arr = Array.isArray(children) ? children : [children];
  if (arr.flat().filter(Boolean).length === 0) return null;
  const c = color === "rose" ? "text-rose-300" : color === "amber" ? "text-amber-300" : "text-slate-300";
  return (
    <div>
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${c}`}>{title}</h3>
      <div className="mt-1 space-y-1">{children}</div>
    </div>
  );
}

function Row({ txn, extra, children }: { txn: BankTxn; extra?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-1.5 text-xs">
      <span className="text-slate-400">{fdate(txn.bookingDate)}</span>
      <span className="flex-1 truncate text-slate-200">{txn.description || "—"}</span>
      <span className={`tabular-nums font-semibold ${txn.amountCents < 0 ? "text-rose-300" : "text-emerald-300"}`}>{eur(txn.amountCents)}</span>
      {extra && <span className="text-slate-400">{extra}</span>}
      {children}
    </div>
  );
}

function ChargeRow({ txn, busy, onRegister, onIgnore, availableExpenses, onLink }: { txn: BankTxn; busy: boolean; onRegister: (txn: BankTxn, vatRate: number) => void; onIgnore: () => void; availableExpenses: { id: string; label: string }[]; onLink: (expenseId: string) => void }) {
  const [vat, setVat] = useState(0);
  return (
    <Row txn={txn}>
      {availableExpenses.length > 0 && (
        <select
          disabled={busy}
          value=""
          onChange={(e) => e.target.value && onLink(e.target.value)}
          className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-100"
        >
          <option value="">Vincular a gasto…</option>
          {availableExpenses.map((ex) => (
            <option key={ex.id} value={ex.id}>{ex.label}</option>
          ))}
        </select>
      )}
      <select value={vat} onChange={(e) => setVat(Number(e.target.value))} className="rounded border border-slate-600 bg-slate-900 px-1 py-0.5 text-[11px] text-slate-100">
        <option value={0}>IVA 0% / exento</option>
        <option value={0.21}>IVA 21%</option>
        <option value={0.1}>IVA 10%</option>
        <option value={0.04}>IVA 4%</option>
      </select>
      <button type="button" disabled={busy} onClick={() => onRegister(txn, vat)} className="rounded bg-cyan-600 px-2 py-1 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
        Registrar gasto
      </button>
      <IgnoreBtn onClick={onIgnore} />
    </Row>
  );
}

function IgnoreBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-800">
      Ignorar
    </button>
  );
}
