"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Regla de Juan (20-nov): todo botón se ve ocupado al instante y, si tarda más de 1 s, dice qué pasa.
const LENTO_MS = 1200;

type Variante = "pri" | "sec";
const cls = (v: Variante, extra = "") =>
  `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[10px] border px-4 py-2 text-[15px] font-semibold no-underline transition-colors aria-busy:cursor-progress ${
    v === "pri" ? "border-[#1A2E4A] bg-[#1A2E4A] text-[#fff] hover:bg-[#0F1E30]" : "border-[#1A2E4A] bg-[#fff] text-[#1A2E4A] hover:bg-[#EEF2F7]"
  } ${extra}`;

function Giro() {
  return <span aria-hidden className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}

function useLento(activo: boolean) {
  const [lento, setLento] = useState(false);
  useEffect(() => {
    if (!activo) {
      setLento(false);
      return;
    }
    const t = setTimeout(() => setLento(true), LENTO_MS);
    return () => clearTimeout(t);
  }, [activo]);
  return lento;
}

/** Enlace a la pantalla que hace el trabajo; al pulsarlo se queda «Abriendo…» hasta que llega la otra pantalla. */
export function MesaEnlace({ label, href, variante = "pri", que, className = "" }: { label: string; href: string; variante?: Variante; que?: string; className?: string }) {
  const [ocupado, setOcupado] = useState(false);
  const lento = useLento(ocupado);
  useEffect(() => {
    if (!ocupado) return;
    // Si la navegación no llega (red caída, misma URL), el botón vuelve a estar disponible.
    const t = setTimeout(() => setOcupado(false), 15000);
    return () => clearTimeout(t);
  }, [ocupado]);
  return (
    <span className={`inline-flex flex-col ${className}`}>
      <Link
        href={href}
        aria-busy={ocupado}
        className={cls(variante, "w-full")}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          setOcupado(true);
        }}
      >
        {ocupado && <Giro />}
        {ocupado ? "Abriendo…" : label}
      </Link>
      {lento && (
        <span role="status" className="mt-1 text-[13px] text-[#52606D]">
          Cargando {que || "la pantalla"}: tarda unos segundos.
        </span>
      )}
    </span>
  );
}

/** Copia el enlace de pago /q del cliente (no abre el enlace: abrirlo lo marcaría como visto). */
export function MesaCopiar({ label, texto, variante = "pri", className = "" }: { label: string; texto: string; variante?: Variante; className?: string }) {
  const [estado, setEstado] = useState<"" | "copiando" | "hecho">("");
  return (
    <button
      type="button"
      title={texto}
      aria-busy={estado === "copiando"}
      className={cls(variante, className)}
      onClick={async () => {
        setEstado("copiando");
        try {
          await navigator.clipboard.writeText(texto);
          setEstado("hecho");
        } catch {
          window.prompt("Copia el enlace:", texto);
          setEstado("");
          return;
        }
        setTimeout(() => setEstado(""), 2000);
      }}
    >
      {estado === "copiando" && <Giro />}
      {estado === "copiando" ? "Copiando…" : estado === "hecho" ? "Copiado ✓" : label}
    </button>
  );
}

/** Vuelve a leer la mesa sin recargar la página. */
export function MesaActualizar() {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const lento = useLento(pendiente);
  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" aria-busy={pendiente} disabled={pendiente} className={cls("sec")} onClick={() => empezar(() => router.refresh())}>
        {pendiente && <Giro />}
        {pendiente ? "Actualizando…" : "Actualizar"}
      </button>
      {lento && (
        <span role="status" className="mt-1 text-[13px] text-[#52606D]">
          Leyendo casos, presupuestos y pedidos…
        </span>
      )}
    </span>
  );
}

/** Botón principal de una tarjeta o ficha: copiar el /q o abrir la pantalla que hace el trabajo. */
export function MesaAccion({ label, href, copiar, variante = "pri", className = "" }: { label: string; href: string; copiar?: boolean; variante?: Variante; className?: string }) {
  return copiar ? <MesaCopiar label={label} texto={href} variante={variante} className={className} /> : <MesaEnlace label={label} href={href} variante={variante} className={className} />;
}

/** «Ya lo traté» / «Posponer 7 d» del vigía: POST al enlace firmado de /api/vigia/marca (el mismo del email de las 8:00). */
export function MesaMarca({ label, url, hecho }: { label: string; url: string; hecho: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"" | "enviando" | "hecho" | "error">("");
  const [, empezar] = useTransition();
  const lento = useLento(estado === "enviando");
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        aria-busy={estado === "enviando"}
        disabled={estado === "enviando" || estado === "hecho"}
        className={cls("sec")}
        onClick={async () => {
          setEstado("enviando");
          try {
            const res = await fetch(url, { method: "POST" });
            if (!res.ok) throw new Error(String(res.status));
            setEstado("hecho");
            empezar(() => router.refresh());
          } catch {
            setEstado("error");
          }
        }}
      >
        {estado === "enviando" && <Giro />}
        {estado === "enviando" ? "Guardando…" : estado === "hecho" ? `${hecho} ✓` : label}
      </button>
      {lento && (
        <span role="status" className="mt-1 text-[13px] text-[#52606D]">
          Guardando la marca…
        </span>
      )}
      {estado === "error" && (
        <span role="alert" className="mt-1 text-[13px] font-semibold text-[#8B1E0F]">
          No se ha guardado (enlace caducado o demasiados intentos). Vuelve a cargar la página.
        </span>
      )}
    </span>
  );
}
