"use client";

import { useState } from "react";
import Link from "next/link";

// Botón único de «Qué toca ahora»: enlace o copiar (el /q del presupuesto enviado).
export default function CasoAccionPaso({ label, href, copiar, compacto }: { label: string; href: string; copiar?: boolean; compacto?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const cls = `inline-flex shrink-0 items-center rounded-lg font-semibold text-[#1A2E4A] ${
    compacto ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
  } ${copiado ? "bg-emerald-600" : "bg-[#1A2E4A] hover:bg-[#243F66]"}`;
  if (!copiar) {
    return (
      <Link href={href} className={cls}>
        {label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      title={href}
      className={cls}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(href);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        } catch {
          window.prompt("Copia el enlace:", href);
        }
      }}
    >
      {copiado ? "Copiado ✓" : label}
    </button>
  );
}
