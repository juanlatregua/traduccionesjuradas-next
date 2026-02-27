"use client";

import { useState } from "react";
import EstimadorCarrito from "@/components/EstimadorCarrito";
import { LANGUAGE_CONFIGS } from "@/lib/language-config";

const idiomas = Object.values(LANGUAGE_CONFIGS);

export default function PresupuestoSelector() {
  const [selected, setSelected] = useState("");

  const config = idiomas.find((c) => c.slug === selected);

  return (
    <div className="mt-6">
      <label
        htmlFor="idioma-selector"
        className="block text-sm font-semibold text-slate-700"
      >
        Selecciona el idioma de tu traducción
      </label>
      <select
        id="idioma-selector"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:max-w-xs"
      >
        <option value="">— Elige idioma —</option>
        {idiomas.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
          </option>
        ))}
      </select>

      {config && (
        <EstimadorCarrito
          idioma={config.name}
          combinaciones={[config.defaultPair, config.reversePair]}
        />
      )}
    </div>
  );
}
