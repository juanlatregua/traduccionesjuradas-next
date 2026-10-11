"use client";

import { useState } from "react";
import Link from "next/link";

// Botón único de «Qué toca ahora»: enlace o copiar (el /q del presupuesto enviado).
export default function CasoAccionPaso({ label, href, copiar, compacto }: { label: string; href: string; copiar?: boolean; compacto?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const cls = `inline-flex shrink-0 items-center rounded-lg font-semibold text-white ${
    compacto ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
  } ${copiado ? "bg-emerald-600" : "bg-cyan-600 hover:bg-cyan-500"}`;
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
