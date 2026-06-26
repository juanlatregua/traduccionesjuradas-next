"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PMQuickCreatePanel from "./PMQuickCreatePanel";

type ModoActivo = "bandeja" | "clientes" | "control" | "presupuesto" | "expedientes" | "facturas" | "recurrentes" | "contabilidad" | "tablero";

type Props = {
  modoActivo?: ModoActivo; // ya no se pasa: el tab activo se deriva del pathname.
  pedidosAccionables: number;
};

// Barra simplificada: Bandeja es el ÚNICO sitio para ver pedidos (Tablero y
// Control eran vistas duplicadas de lo mismo → fuera de la barra; sus rutas
// siguen vivas para no romper enlaces de SMS/email a /control?q=...).
const TABS: { href: string; label: string; key: ModoActivo }[] = [
  { href: "/zona-traductor", label: "Bandeja", key: "bandeja" },
  { href: "/zona-traductor/clientes", label: "Clientes", key: "clientes" },
  { href: "/zona-traductor/expedientes", label: "Expedientes", key: "expedientes" },
  { href: "/zona-traductor/presupuesto", label: "Presupuesto", key: "presupuesto" },
  { href: "/zona-traductor/facturas", label: "Facturas", key: "facturas" },
  { href: "/zona-traductor/recurrentes", label: "Recurrentes", key: "recurrentes" },
  { href: "/zona-traductor/contabilidad", label: "Contabilidad", key: "contabilidad" },
];

export default function ZonaTraductorNav({ pedidosAccionables }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  // El menú vive en el layout y está SIEMPRE presente en toda la zona; solo se
  // oculta en la puerta OTP (/verificar), donde aún no hay sesión.
  if (pathname === "/zona-traductor/verificar") return null;
  const isActive = (href: string) =>
    href === "/zona-traductor"
      ? pathname === "/zona-traductor" || pathname.startsWith("/zona-traductor/pedido")
      : pathname.startsWith(href);

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-2 backdrop-blur sm:px-6">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                isActive(tab.href)
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
