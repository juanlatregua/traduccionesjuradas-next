import type { ReactNode } from "react";
import type { Reloj } from "@/lib/mesa/montones";

// Piezas de la mesa (paleta de la maqueta aprobada: tinta, oro, verde/ámbar/rojo/azul suaves).
// Colores en hex a propósito: el tema claro/oscuro viejo de la zona reescribe las clases slate/cyan/white.

const TONO = {
  bad: "bg-[#FBE4DF] text-[#8B1E0F]",
  warn: "bg-[#FCEFC9] text-[#7A4B00]",
  info: "bg-[#E1ECF8] text-[#17477E]",
  ok: "bg-[#E3F1E4] text-[#1E5B2A]",
  gris: "bg-[#ECEEF1] text-[#3A4450]",
  oro: "bg-[#F0E2B8] text-[#4A3A0B]",
} as const;
export type Tono = keyof typeof TONO;

export function Marca({ tono, children, className = "" }: { tono: Tono; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-px text-[14px] font-bold ${TONO[tono]} ${className}`}>{children}</span>;
}

export function RelojMarca({ reloj }: { reloj: Reloj }) {
  const tono: Tono = reloj.estado === "vencido" ? "bad" : reloj.estado === "pronto" ? "warn" : "info";
  return (
    <Marca tono={tono}>
      <span aria-hidden>{reloj.estado === "vencido" ? "⚠" : "◷"}</span>
      {reloj.texto}
    </Marca>
  );
}

export function Par({ par }: { par: string }) {
  return <span className="rounded-full border border-[#C5CBD3] bg-[#ECEEF1] px-2 py-px text-[13px] font-semibold text-[#3A4450]">{par}</span>;
}

export function Tarjeta({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`scroll-mt-28 rounded-[14px] border border-[#D5DAE1] bg-[#fff] p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Titulo2({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-[19px] font-bold text-[#1A2E4A]">{children}</h2>;
}

export const fmtFecha = (d: Date) => d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const fmtDia = (d: Date) => d.toLocaleDateString("es-ES", { timeZone: "Europe/Madrid", weekday: "short", day: "numeric", month: "short" });
export const eur = (n: number) => `${n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
