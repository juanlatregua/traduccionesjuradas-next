"use client";

import { useEffect, useState } from "react";
import { lavoriCarteraForLang, type LavoriMember, type LavoriRoute } from "@/lib/lavori-bridge";

// Elección de destinatarios de una solicitud vía lavori (orden Juan 21-ago-2026:
// "poder enviar a todos los de la lengua o a uno en concreto", p. ej. inglés →
// Vanessa). Tres modos: carril por defecto (LAVORI_CANDIDATES), toda la cartera
// de la lengua, o un jurado concreto. La cartera llega EN VIVO de lavori vía
// /api/lavori/miembros (respaldo: tabla estática mientras carga o si falla).
export type LavoriPick = { mode: "carril" } | { mode: "todos" } | { mode: "uno"; id: string };

export type LavoriCartera = { miembros: LavoriMember[]; live: boolean; loading: boolean; error?: string };

export function useLavoriCartera(lang: string | null | undefined): LavoriCartera {
  const [state, setState] = useState<LavoriCartera>({
    miembros: lang ? lavoriCarteraForLang(lang) : [],
    live: false,
    loading: Boolean(lang),
  });
  useEffect(() => {
    if (!lang) {
      setState({ miembros: [], live: false, loading: false });
      return;
    }
    const controller = new AbortController();
    setState({ miembros: lavoriCarteraForLang(lang), live: false, loading: true });
    fetch(`/api/lavori/miembros?lengua=${encodeURIComponent(lang)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.miembros)) {
          setState({ miembros: data.miembros, live: Boolean(data.live), loading: false, error: data.error });
        } else {
          setState((s) => ({ ...s, loading: false, error: data?.error || "No se pudo leer la cartera." }));
        }
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState((s) => ({ ...s, loading: false, error: "No se pudo leer la cartera." }));
      });
    return () => controller.abort();
  }, [lang]);
  return state;
}

/** Candidatos a enviar según el modo. `undefined` = carril por defecto (lo aplica
 * la API). En "todos" solo viajan los que pueden recibir (con canal, no en paz). */
export function lavoriPickToCandidatos(pick: LavoriPick, cartera: LavoriMember[]): string[] | undefined {
  if (pick.mode === "todos") {
    return cartera.filter((m) => m.canal !== false && !m.enPaz).map((m) => m.id);
  }
  if (pick.mode === "uno") return pick.id ? [pick.id] : undefined;
  return undefined;
}

export function describeLavoriPick(pick: LavoriPick, route: LavoriRoute, cartera: LavoriMember[]): string {
  const name = (id: string) => cartera.find((m) => m.id === id)?.nombre || id;
  if (pick.mode === "todos") {
    const n = cartera.filter((m) => m.canal !== false && !m.enPaz).length;
    return `todos los jurados de ${route.lang.toUpperCase()} del tablón con canal (${n})`;
  }
  if (pick.mode === "uno") return `solo ${name(pick.id)}`;
  return route.candidatos.map(name).join(", ");
}

function señales(m: LavoriMember): string {
  const out: string[] = [];
  if (m.papelUnico) out.push("papel único");
  if (m.canal === false) out.push("SIN CANAL");
  if (m.enPaz) out.push("en paz");
  if (m.disponible === false) out.push("no disponible");
  if (m.nota) out.push(m.nota);
  return out.join(" · ");
}

export default function LavoriCandidatePicker({
  route,
  cartera,
  value,
  onChange,
  disabled,
}: {
  route: LavoriRoute;
  cartera: LavoriCartera;
  value: LavoriPick;
  onChange: (pick: LavoriPick) => void;
  disabled?: boolean;
}) {
  const miembros = cartera.miembros;
  const defaults = route.candidatos;
  const defaultNames = defaults.map((id) => miembros.find((m) => m.id === id)?.nombre || id).join(", ");
  const conCanal = miembros.filter((m) => m.canal !== false && !m.enPaz).length;
  const radio = "mt-0.5 h-3.5 w-3.5 accent-violet-500";
  const label = "flex items-start gap-2 text-xs text-violet-100/90";

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/80">
        Destinatarios
        <span className="ml-2 font-normal normal-case tracking-normal text-violet-400/70">
          {cartera.loading ? "leyendo el tablón…" : cartera.live ? "cartera en vivo de lavori" : "cartera de respaldo (lavori no respondió)"}
        </span>
      </legend>
      {defaults.length > 0 && (
        <label className={label}>
          <input type="radio" name="lavori-pick" className={radio} checked={value.mode === "carril"} onChange={() => onChange({ mode: "carril" })} />
          <span>
            Carril por defecto · <span className="text-violet-200">{defaultNames}</span>
          </span>
        </label>
      )}
      <label className={label}>
        <input type="radio" name="lavori-pick" className={radio} checked={value.mode === "todos"} onChange={() => onChange({ mode: "todos" })} />
        <span>
          Todos los jurados de {route.lang.toUpperCase()} del tablón con canal ({conCanal}
          {miembros.length !== conCanal ? ` de ${miembros.length}` : ""})
        </span>
      </label>
      <label className={label}>
        <input
          type="radio"
          name="lavori-pick"
          className={radio}
          checked={value.mode === "uno"}
          onChange={() => onChange({ mode: "uno", id: value.mode === "uno" ? value.id : defaults[0] || miembros[0]?.id || "" })}
        />
        <span className="flex flex-wrap items-center gap-2">
          Uno en concreto
          {value.mode === "uno" && (
            <select
              value={value.id}
              onChange={(e) => onChange({ mode: "uno", id: e.target.value })}
              className="rounded-md border border-violet-700/60 bg-violet-950/60 px-2 py-1 text-xs text-violet-100 focus:border-violet-500 focus:outline-none"
            >
              {miembros.length === 0 && <option value="">(sin jurados de {route.lang.toUpperCase()} en el tablón)</option>}
              {miembros.map((m) => {
                const s = señales(m);
                return (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                    {m.tij ? ` · T-IJ ${m.tij}` : ""}
                    {defaults.includes(m.id) ? " · carril" : ""}
                    {s ? ` · ${s}` : ""}
                  </option>
                );
              })}
            </select>
          )}
        </span>
      </label>
    </fieldset>
  );
}
