"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PMQuickCreatePanel from "../PMQuickCreatePanel";
import { MesaEnlace } from "./MesaBoton";

// Menú de la mesa del gestor (R3, MESA_V2=on): las cinco pestañas de la maqueta aprobada.
// Mientras R4/R5 no traigan pantallas nuevas, cada pestaña abre las de siempre; la fila de
// debajo deja a mano todas las pantallas viejas de esa pestaña para que no se pierda ninguna.
type Sub = { href: string; label: string; badge?: "pedidos" | "presupuestos"; admin?: boolean };
type Tab = { key: string; label: string; href: string; subs: Sub[]; owns: string[] };

const Z = "/zona-traductor";
const TABS: Tab[] = [
  { key: "hoy", label: "Hoy", href: `${Z}/hoy`, owns: [`${Z}/hoy`, `${Z}/caso`, `${Z}/vigia`], subs: [{ href: `${Z}/hoy`, label: "Mesa" }, { href: `${Z}/vigia`, label: "Agenda del vigía" }] },
  {
    key: "casos",
    label: "Casos",
    href: `${Z}/casos`,
    owns: [`${Z}/casos`, `${Z}/pedido`, `${Z}/presupuestos`, `${Z}/presupuesto`, `${Z}/expedientes`, `${Z}/lectura`, "/admin/inbox"],
    subs: [
      { href: `${Z}/casos`, label: "Casos" },
      { href: Z, label: "Pedidos", badge: "pedidos" },
      { href: `${Z}/presupuestos`, label: "Presupuestos", badge: "presupuestos" },
      { href: `${Z}/expedientes`, label: "Expedientes" },
      { href: `${Z}/presupuesto`, label: "Constructor" },
      { href: "/admin/inbox", label: "Bandeja" },
    ],
  },
  { key: "clientes", label: "Clientes", href: `${Z}/clientes`, owns: [`${Z}/clientes`], subs: [] },
  {
    key: "dinero",
    label: "Dinero",
    href: `${Z}/contabilidad`,
    owns: [`${Z}/contabilidad`, `${Z}/facturas`, `${Z}/periodos`, `${Z}/recurrentes`, `${Z}/panel`],
    subs: [
      { href: `${Z}/contabilidad`, label: "Contabilidad" },
      { href: `${Z}/facturas`, label: "Facturas" },
      { href: `${Z}/periodos`, label: "Periodos" },
      { href: `${Z}/recurrentes`, label: "Recurrentes" },
      { href: `${Z}/contabilidad/bizum`, label: "Bizum" },
      { href: `${Z}/panel`, label: "Panel", admin: true },
    ],
  },
  { key: "ajustes", label: "Ajustes", href: `${Z}/ajustes`, owns: [`${Z}/ajustes`, `${Z}/tarifario`], subs: [{ href: `${Z}/ajustes`, label: "Ajustes" }, { href: `${Z}/tarifario`, label: "Tarifario" }] },
];

const bajo = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function tabDe(path: string): string | null {
  if (path === Z) return "casos";
  return TABS.find((t) => t.owns.some((p) => bajo(path, p)))?.key ?? null;
}

export default function MesaNav({ pedidosAccionables, presupuestosAccionables, staffEmail, staffRole }: { pedidosAccionables: number; presupuestosAccionables: number; staffEmail?: string | null; staffRole?: string | null }) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  if (pathname === `${Z}/verificar`) return null;
  const activa = TABS.find((t) => t.key === tabDe(pathname));
  const subs = (activa?.subs || []).filter((s) => !s.admin || staffRole === "ADMIN");
  const badge = (b?: Sub["badge"]) => (b === "pedidos" ? pedidosAccionables : b === "presupuestos" ? presupuestosAccionables : 0);
  const subActiva = subs.filter((s) => (s.href === Z ? pathname === Z || bajo(pathname, `${Z}/pedido`) : bajo(pathname, s.href))).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#D5DAE1] bg-[#fff] font-sans text-[#1F2933]">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1">
          <Link href={`${Z}/hoy`} className="mr-2 font-bold text-[#1A2E4A] no-underline">
            Zona del traductor
          </Link>
          <nav aria-label="Secciones de la zona del traductor" className="-mx-1 flex max-w-full gap-0.5 overflow-x-auto">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                aria-current={activa?.key === t.key ? "page" : undefined}
                className={`flex min-h-[44px] shrink-0 items-center border-b-[3px] px-3 font-semibold no-underline ${
                  activa?.key === t.key ? "border-[#816318] text-[#1A2E4A]" : "border-transparent text-[#52606D] hover:text-[#1A2E4A]"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <span className="flex-1" />
          {staffEmail && (
            <span title={`Dentro como ${staffEmail} (${staffRole || "sin rol"})`} className="hidden max-w-[220px] truncate text-[13px] text-[#52606D] lg:inline">
              {staffEmail}
            </span>
          )}
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="inline-flex min-h-[44px] items-center rounded-[10px] border border-[#1A2E4A] bg-[#fff] px-3 text-[15px] font-semibold text-[#1A2E4A] hover:bg-[#EEF2F7]"
          >
            Pedido rápido
          </button>
          <MesaEnlace label="+ Nueva solicitud" href={`${Z}/presupuesto`} que="el constructor" />
        </div>
        {subs.length > 1 && (
          <nav aria-label={`Pantallas de ${activa?.label}`} className="border-t border-[#E8EBEF] bg-[#F7F9FB]">
            <div className="mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 py-1">
              {subs.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  aria-current={subActiva?.href === s.href ? "page" : undefined}
                  className={`flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold no-underline ${
                    subActiva?.href === s.href ? "bg-[#1A2E4A] text-[#fff]" : "text-[#52606D] hover:bg-[#EEF2F7]"
                  }`}
                >
                  {s.label}
                  {badge(s.badge) > 0 && <span className="rounded-full bg-[#F0E2B8] px-1.5 text-[12px] font-bold text-[#4A3A0B]">{badge(s.badge)}</span>}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>
      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl backdrop:bg-black/70"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Nuevo pedido</h2>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Cerrar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
            ✕
          </button>
        </div>
        <PMQuickCreatePanel />
      </dialog>
    </>
  );
}
