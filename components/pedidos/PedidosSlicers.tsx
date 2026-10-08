"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SLICERS, SLICER_PARAMS, slicerParams, type SlicerKey, type SlicerOption, type Slicers } from "@/lib/panel-slicers";

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400";

function Slicer({ label, options, selected, onApply }: { label: string; options: SlicerOption[]; selected: string[]; onApply: (values: string[]) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [draft, setDraft] = useState<string[]>(selected);
  const [search, setSearch] = useState("");
  const shown = options.filter((o) => o.value.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (v: string) => setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]));
  const apply = (values: string[]) => {
    onApply(values);
    if (ref.current) ref.current.open = false;
  };
  return (
    <details
      ref={ref}
      className="relative"
      onToggle={(e) => {
        if ((e.target as HTMLDetailsElement).open) setDraft(selected);
      }}
    >
      <summary
        className={`flex cursor-pointer list-none items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold ${FOCUS} ${
          selected.length ? "border-cyan-400 bg-cyan-500/10 text-cyan-300" : "border-slate-600 bg-slate-900 text-slate-100 hover:border-slate-400"
        }`}
      >
        {label}
        {selected.length > 0 && <span className="rounded-full bg-cyan-600 px-1.5 text-[10px] text-white">{selected.length}</span>}
        <span aria-hidden>▾</span>
      </summary>
      <div className="absolute left-0 z-20 mt-1 w-64 max-w-[85vw] rounded-xl border border-slate-600 bg-slate-900 p-2 shadow-xl">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Buscar ${label.toLowerCase()}`}
          aria-label={`Buscar en ${label}`}
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500"
        />
        <ul className="mt-2 max-h-56 overflow-auto">
          {shown.length === 0 && <li className="px-1 py-2 text-xs text-slate-500">Sin coincidencias.</li>}
          {shown.map((o) => (
            <li key={o.value}>
              <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-slate-200 hover:bg-slate-800">
                <input type="checkbox" checked={draft.includes(o.value)} onChange={() => toggle(o.value)} />
                <span className="min-w-0 flex-1 truncate" title={o.value}>
                  {o.value}
                </span>
                <span className="tabular-nums text-slate-500">{o.count}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between gap-2">
          <button type="button" onClick={() => apply([])} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800">
            Limpiar
          </button>
          <button type="button" onClick={() => apply(draft)} className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-500">
            Aplicar
          </button>
        </div>
      </div>
    </details>
  );
}

export default function PedidosSlicers({ options, selected }: { options: Record<SlicerKey, SlicerOption[]>; selected: Slicers }) {
  const router = useRouter();
  const sp = useSearchParams();
  const go = (next: Slicers) => {
    const params = new URLSearchParams(sp.toString());
    for (const k of SLICER_PARAMS) params.delete(k);
    for (const [k, v] of slicerParams(next)) params.set(k, v);
    const qs = params.toString();
    router.push(qs ? `/zona-traductor?${qs}` : "/zona-traductor");
  };
  const any = SLICERS.some((s) => selected[s.key]?.length);
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtros">
      {SLICERS.map((s) => (
        <Slicer key={`${s.key}:${(selected[s.key] ?? []).join("|")}`} label={s.label} options={options[s.key] ?? []} selected={selected[s.key] ?? []} onApply={(values) => go({ ...selected, [s.key]: values })} />
      ))}
      {any && (
        <button type="button" onClick={() => go({})} className={`rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 ${FOCUS}`}>
          Quitar filtros
        </button>
      )}
    </div>
  );
}
