"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

// Cuenta corriente por colaborador: devengos por encargo pendientes de la
// factura real del traductor. Al registrarla se liquidan y el gasto entra en
// el libro (los devengos nunca cuentan en 303/gestoría).

export type AccrualRow = {
  id: string;
  date: string; // ISO
  orderReference: string | null;
  concept: string;
  baseCents: number;
};

export type CollaboratorAccountGroup = {
  collaboratorId: string | null; // null = devengo huérfano sin ficha (no liquidable)
  name: string;
  supplierType: string; // AUTONOMO | EMPRESA
  nif: string | null;
  charges: AccrualRow[];
};

function eur(c: number) {
  return `${(c / 100).toFixed(2)} €`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

const FIELD = "rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500";

function GroupCard({ group, canIssue, onDone }: { group: CollaboratorAccountGroup; canIssue: boolean; onDone: (msg: string) => void }) {
  const [sel, setSel] = useState<Set<string>>(() => new Set(group.charges.map((c) => c.id)));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const [form, setForm] = useState(() => ({
    number: "",
    date: new Date().toISOString().slice(0, 10),
    baseEur: "", // vacío = suma de los devengos elegidos
    vatPct: "21",
    irpfPct: group.supplierType === "AUTONOMO" ? "15" : "0",
    nif: group.nif || "",
    acceptMismatch: false,
  }));

  const selCharges = group.charges.filter((c) => sel.has(c.id));
  const sumCents = selCharges.reduce((a, c) => a + c.baseCents, 0);
  const baseCents = form.baseEur.trim() === "" ? sumCents : Math.round(Number(form.baseEur.replace(",", ".")) * 100);
  const mismatch = Number.isFinite(baseCents) && baseCents !== sumCents;

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function submit(force: boolean) {
    if (selCharges.length === 0 || !group.collaboratorId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/expenses/collaborator-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collaboratorId: group.collaboratorId,
          accrualIds: selCharges.map((c) => c.id),
          number: form.number,
          date: form.date,
          baseCents: form.baseEur.trim() === "" ? undefined : baseCents,
          vatRate: Number(form.vatPct) / 100,
          irpfRetentionPct: Number(form.irpfPct) || 0,
          supplierNif: form.nif,
          acceptMismatch: form.acceptMismatch,
          force,
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) {
        if (d.duplicate) {
          setDuplicate(true);
          setMsg(`${d.error} (${d.duplicate.supplier ?? ""} · ${eur(d.duplicate.totalCents)})`);
          return;
        }
        throw new Error(d.error || "No se pudo registrar la factura.");
      }
      onDone(`Factura ${form.number.trim()} de ${group.name} registrada: ${d.settledCount} devengo(s) liquidado(s).`);
    } catch (e: any) {
      setDuplicate(false);
      setMsg(e?.message || "Error al registrar la factura.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-white">{group.name}</p>
          <p className="text-[11px] text-slate-500">
            {group.charges.length} encargo(s) pendientes de factura · {group.supplierType === "AUTONOMO" ? "autónomo (IRPF 15%)" : "empresa"}
            {!group.collaboratorId && " · sin ficha de colaborador (no liquidable desde aquí)"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-amber-200">{eur(sumCents)}</p>
          <p className="text-[10px] text-slate-500">seleccionado ({selCharges.length})</p>
        </div>
      </div>

      <ul className="mt-2 divide-y divide-slate-800 rounded-md border border-slate-800">
        {group.charges.map((c) => (
          <li key={c.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-300">
            {canIssue && group.collaboratorId && (
              <input type="checkbox" checked={sel.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Incluir ${c.orderReference ?? c.concept}`} />
            )}
            <span className="text-slate-500">{fmtDate(c.date)}</span>
            {c.orderReference ? (
              <a href={`/zona-traductor/pedido/${c.orderReference}`} className="font-mono text-cyan-300 hover:underline">
                {c.orderReference}
              </a>
            ) : (
              <span className="text-slate-500">—</span>
            )}
            <span className="min-w-0 flex-1 truncate text-slate-400">{c.concept}</span>
            <span className="tabular-nums">{eur(c.baseCents)}</span>
          </li>
        ))}
      </ul>

      {canIssue && group.collaboratorId && (
        <div className="mt-2">
          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Registrar factura ({selCharges.length} encargo{selCharges.length === 1 ? "" : "s"})
            </button>
          ) : (
            <div className="rounded-lg border border-emerald-800/50 bg-emerald-900/10 p-3">
              <p className="text-xs font-semibold text-emerald-200">Factura de {group.name}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <input value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} placeholder="Nº factura del colaborador *" className={FIELD} />
                <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={FIELD} />
                <input
                  value={form.baseEur}
                  onChange={(e) => setForm((f) => ({ ...f, baseEur: e.target.value }))}
                  placeholder={`Base € (por defecto ${(sumCents / 100).toFixed(2)})`}
                  className={FIELD}
                />
                <select value={form.vatPct} onChange={(e) => setForm((f) => ({ ...f, vatPct: e.target.value }))} className={FIELD}>
                  <option value="21">IVA 21%</option>
                  <option value="10">IVA 10%</option>
                  <option value="4">IVA 4%</option>
                  <option value="0">IVA 0% (exento)</option>
                </select>
                <input
                  value={form.irpfPct}
                  onChange={(e) => setForm((f) => ({ ...f, irpfPct: e.target.value }))}
                  placeholder="IRPF %"
                  className={FIELD}
                />
                <input value={form.nif} onChange={(e) => setForm((f) => ({ ...f, nif: e.target.value }))} placeholder="NIF del colaborador" className={FIELD} />
              </div>
              {mismatch && (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-amber-300">
                  <input type="checkbox" checked={form.acceptMismatch} onChange={(e) => setForm((f) => ({ ...f, acceptMismatch: e.target.checked }))} />
                  La base ({eur(baseCents)}) no cuadra con los devengos ({eur(sumCents)}) — registrar igualmente
                </label>
              )}
              <p className="mt-2 text-[11px] text-slate-500">
                El justificante (PDF) se adjunta después desde Gastos, como cualquier factura recibida.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={busy || selCharges.length === 0 || !form.number.trim() || (mismatch && !form.acceptMismatch)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? "Registrando…" : `Registrar y liquidar ${selCharges.length} devengo(s)`}
                </button>
                {duplicate && (
                  <button
                    type="button"
                    onClick={() => submit(true)}
                    disabled={busy}
                    className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/30 disabled:opacity-50"
                  >
                    Registrar de todas formas
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-rose-300">{msg}</p>}
    </div>
  );
}

export default function CollaboratorAccountPanel({ groups, canIssue }: { groups: CollaboratorAccountGroup[]; canIssue: boolean }) {
  const router = useRouter();
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const totalCents = useMemo(() => groups.reduce((a, g) => a + g.charges.reduce((b, c) => b + c.baseCents, 0), 0), [groups]);

  // El refresh del servidor quita los devengos liquidados; el mensaje vive aquí
  // (no en la tarjeta) porque el grupo puede desaparecer entero al liquidarse.
  function handleDone(msg: string) {
    setOkMsg(msg);
    router.refresh();
  }

  if (groups.length === 0) {
    return (
      <div className="mb-4 rounded-xl border border-slate-700 bg-slate-900/30 p-3 text-xs text-slate-500">
        {okMsg && <p className="mb-1 text-emerald-300">{okMsg}</p>}
        Cuenta por traductor: sin encargos pendientes de factura. Los encargos adjudicados se acumulan aquí hasta que el
        colaborador envía su factura (mensual o puntual).
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-700/40 bg-amber-900/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Cuenta por traductor — encargos sin facturar</h3>
        <p className="text-xs text-slate-400">
          {groups.length} colaborador(es) · <span className="font-semibold text-amber-200">{eur(totalCents)}</span> devengados
        </p>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Cada encargo adjudicado acumula aquí su coste. Estos devengos NO cuentan en libro/303/gestoría: cuentan cuando
        registras la factura real del colaborador (una al mes o puntual), que los liquida y entra como factura recibida.
      </p>
      {okMsg && <p className="mt-2 text-xs text-emerald-300">{okMsg}</p>}
      <div className="mt-3 space-y-3">
        {groups.map((g) => (
          <GroupCard key={g.collaboratorId ?? g.name} group={g} canIssue={canIssue} onDone={handleDone} />
        ))}
      </div>
    </div>
  );
}
