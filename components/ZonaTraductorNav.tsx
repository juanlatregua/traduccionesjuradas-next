"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PMQuickCreatePanel from "./PMQuickCreatePanel";

type ModoActivo = "pedidos" | "clientes" | "presupuestos" | "facturas" | "contabilidad" | "ajustes";

type Props = {
  pedidosAccionables: number;
  presupuestosAccionables?: number;
};

// Barra de 6 pestañas: una por ETAPA del ciclo, no una por pantalla.
// Lo que antes eran pestañas sueltas vive ahora dentro de su etapa:
//   Resumen/control  → Pedidos (vista Tabla)
//   Presupuesto      → Presupuestos (sub-vista Builder)
//   Expedientes      → Presupuestos (sub-vista Expedientes)
//   Recurrentes      → Contabilidad (sub-pestaña)
//   Periodos         → Contabilidad (sub-pestaña)
// Ninguna función se pierde; las rutas viejas siguen vivas como redirect.
const TABS: { href: string; label: string; key: ModoActivo }[] = [
  { href: "/zona-traductor", label: "Pedidos", key: "pedidos" },
  { href: "/zona-traductor/presupuestos", label: "Presupuestos", key: "presupuestos" },
  { href: "/zona-traductor/clientes", label: "Clientes", key: "clientes" },
  { href: "/zona-traductor/facturas", label: "Facturas", key: "facturas" },
  { href: "/zona-traductor/contabilidad", label: "Contabilidad", key: "contabilidad" },
];

// Rutas que pertenecen a una pestaña aunque no cuelguen de su href.
const OWNED_PATHS: Record<string, ModoActivo> = {
  "/zona-traductor/pedido": "pedidos",
  "/zona-traductor/control": "pedidos",
  "/zona-traductor/presupuesto": "presupuestos",
  "/zona-traductor/expedientes": "presupuestos",
  "/zona-traductor/recurrentes": "contabilidad",
  "/zona-traductor/periodos": "contabilidad",
};

export default function ZonaTraductorNav({ pedidosAccionables, presupuestosAccionables = 0 }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  // El menú vive en el layout y está SIEMPRE presente en toda la zona; solo se
  // oculta en la puerta OTP (/verificar), donde aún no hay sesión.
  if (pathname === "/zona-traductor/verificar") return null;

  const ownedKey = Object.entries(OWNED_PATHS).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )?.[1];

  const isActive = (tab: { href: string; key: ModoActivo }) => {
    if (ownedKey) return tab.key === ownedKey;
    return tab.href === "/zona-traductor"
      ? pathname === "/zona-traductor"
      : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
  };

  const badgeFor = (key: ModoActivo) =>
    key === "pedidos" ? pedidosAccionables : key === "presupuestos" ? presupuestosAccionables : 0;

  return (
    <>
      <nav className="sticky top-0 z-50 flex items-center justify-between gap-2 border-b border-slate-700 bg-slate-900/95 px-4 py-2 backdrop-blur sm:px-6">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const badge = badgeFor(tab.key);
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`relative shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive(tab)
                    ? "border-b-2 border-b-cyan-400 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
                {badge > 0 && (
                  <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cyan-500/20 px-1.5 text-[11px] font-bold text-cyan-300">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/zona-traductor/ajustes"
            aria-label="Ajustes"
            title="Ajustes"
            className={`rounded-lg px-2.5 py-2 text-sm transition-colors ${
              pathname.startsWith("/zona-traductor/ajustes")
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
          >
            + Nuevo pedido
          </button>
        </div>
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
