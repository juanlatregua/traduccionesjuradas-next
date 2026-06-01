"use client";

import { useRef } from "react";
import Link from "next/link";
import PMQuickCreatePanel from "./PMQuickCreatePanel";

type ModoActivo = "bandeja" | "control" | "presupuesto" | "expedientes" | "facturas" | "contabilidad" | "tablero";

type Props = {
  modoActivo: ModoActivo;
  pedidosAccionables: number;
};

const TABS: { href: string; label: string; key: ModoActivo }[] = [
  { href: "/zona-traductor", label: "Bandeja", key: "bandeja" },
  { href: "/zona-traductor/tablero", label: "Tablero", key: "tablero" },
  { href: "/zona-traductor/control", label: "Control", key: "control" },
  { href: "/zona-traductor/expedientes", label: "Expedientes", key: "expedientes" },
  { href: "/zona-traductor/presupuesto", label: "Presupuesto", key: "presupuesto" },
  { href: "/zona-traductor/facturas", label: "Facturas", key: "facturas" },
  { href: "/zona-traductor/contabilidad", label: "Contabilidad", key: "contabilidad" },
];

export default function ZonaTraductorNav({ modoActivo, pedidosAccionables }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-2 backdrop-blur sm:px-6">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                modoActivo === tab.key
                  ? "border-b-2 border-b-cyan-400 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
              {tab.key === "bandeja" && pedidosAccionables > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cyan-500/20 px-1.5 text-[11px] font-bold text-cyan-300">
                  {pedidosAccionables}
                </span>
              )}
            </Link>
          ))}
        </div>

        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
        >
          + Nuevo pedido
        </button>
      </nav>

      <dialog
        ref={dialogRef}
        className="m-auto max-w-lg w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl backdrop:bg-black/70"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Nuevo pedido</h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <PMQuickCreatePanel />
      </dialog>
    </>
  );
}
