"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export type BreakdownView = {
  label: string;
  value: number;
  prev: number | null;
  valueText: string;
  prevText: string;
  deltaText: string;
  deltaSign: -1 | 0 | 1;
  /** Variación numérica (para ordenar). */
  deltaNum: number | null;
  share: number;
  href: string;
};

type SortKey = "label" | "value" | "prev" | "delta";

export default function BreakdownTable({ rows, valueHeader, compareHeader, caption }: { rows: BreakdownView[]; valueHeader: string; compareHeader: string; caption: string }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });
  const sorted = useMemo(() => {
    const pick = (r: BreakdownView) => (sort.key === "label" ? r.label : sort.key === "value" ? r.value : sort.key === "prev" ? r.prev : r.deltaNum);
    return [...rows].sort((a, b) => {
      const x = pick(a);
      const y = pick(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const c = typeof x === "string" ? x.localeCompare(String(y), "es") : (x as number) - (y as number);
      return c * sort.dir;
    });
  }, [rows, sort]);

  const th = (key: SortKey, text: string, right = true) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`py-1.5 font-medium ${right ? "px-2 text-right" : "pr-3"}`}>
      <button type="button" onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === "label" ? 1 : -1 }))} className="hover:text-white">
        {text}
        {sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  if (rows.length === 0) return <p className="py-4 text-center text-xs text-slate-500">Sin datos en este periodo.</p>;
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-slate-900 text-slate-400">
          <tr>
            {th("label", "", false)}
            {th("value", valueHeader)}
            {th("prev", compareHeader)}
            {th("delta", "Var.")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.label} onClick={() => router.push(r.href)} className="cursor-pointer border-t border-slate-700 hover:bg-slate-800/60">
              <th scope="row" className="max-w-[12rem] py-1.5 pr-3 font-normal">
                <Link href={r.href} className="block truncate text-cyan-300 hover:underline" title={`Filtrar por ${r.label}`}>
                  {r.label}
                </Link>
                <span className="mt-1 block h-1 rounded-full bg-slate-800" aria-hidden>
                  <span className="block h-1 rounded-full bg-emerald-400" style={{ width: `${r.share}%` }} />
                </span>
              </th>
              <td className="px-2 text-right tabular-nums text-white">{r.valueText}</td>
              <td className="px-2 text-right tabular-nums text-slate-400">{r.prevText}</td>
              <td className={`px-2 text-right tabular-nums ${r.deltaSign > 0 ? "text-emerald-400" : r.deltaSign < 0 ? "text-red-400" : "text-slate-400"}`}>
                {r.deltaText ? `${r.deltaSign > 0 ? "▲" : r.deltaSign < 0 ? "▼" : "■"} ${r.deltaText}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
