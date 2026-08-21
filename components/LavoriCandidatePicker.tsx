"use client";

import { lavoriCarteraForLang, type LavoriRoute } from "@/lib/lavori-bridge";

// Elección de destinatarios de una solicitud vía lavori (orden Juan 21-ago-2026:
// "poder enviar a todos los de la lengua o a uno en concreto", p. ej. inglés →
// Vanessa). Tres modos: carril por defecto (LAVORI_CANDIDATES), toda la cartera
// de la lengua, o un jurado concreto. Devuelve `undefined` en el modo carril
// (la API aplica el defecto) y la lista de ids en los otros dos.
export type LavoriPick = { mode: "carril" } | { mode: "todos" } | { mode: "uno"; id: string };

export function lavoriPickToCandidatos(pick: LavoriPick, route: LavoriRoute): string[] | undefined {
  if (pick.mode === "todos") return lavoriCarteraForLang(route.lang).map((m) => m.id);
  if (pick.mode === "uno") return pick.id ? [pick.id] : undefined;
  return undefined;
}

export function describeLavoriPick(pick: LavoriPick, route: LavoriRoute): string {
  const cartera = lavoriCarteraForLang(route.lang);
  const name = (id: string) => cartera.find((m) => m.id === id)?.nombre || id;
  if (pick.mode === "todos") return `todos los jurados de ${route.lang.toUpperCase()} del tablón (${cartera.length})`;
  if (pick.mode === "uno") return `solo ${name(pick.id)}`;
  return route.candidatos.map(name).join(", ");
}

export default function LavoriCandidatePicker({
  route,
  value,
  onChange,
  disabled,
}: {
  route: LavoriRoute;
  value: LavoriPick;
  onChange: (pick: LavoriPick) => void;
  disabled?: boolean;
}) {
  const cartera = lavoriCarteraForLang(route.lang);
  const defaults = route.candidatos;
  const defaultNames = defaults.map((id) => cartera.find((m) => m.id === id)?.nombre || id).join(", ");
  const soloUnoEnCartera = cartera.length <= 1;
  const radio = "h-3.5 w-3.5 accent-violet-500";
  const label = "flex items-start gap-2 text-xs text-violet-100/90";

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/80">
        Destinatarios
      </legend>
      <label className={label}>
        <input
          type="radio"
          name="lavori-pick"
          className={radio}
          checked={value.mode === "carril"}
          onChange={() => onChange({ mode: "carril" })}
        />
        <span>
          Carril por defecto · <span className="text-violet-200">{defaultNames}</span>
        </span>
      </label>
      {!soloUnoEnCartera && (
        <label className={label}>
          <input
            type="radio"
            name="lavori-pick"
            className={radio}
            checked={value.mode === "todos"}
            onChange={() => onChange({ mode: "todos" })}
          />
          <span>
            Todos los jurados de {route.lang.toUpperCase()} del tablón ({cartera.length})
          </span>
        </label>
      )}
      <label className={label}>
        <input
          type="radio"
          name="lavori-pick"
          className={radio}
          checked={value.mode === "uno"}
          onChange={() => onChange({ mode: "uno", id: value.mode === "uno" ? value.id : defaults[0] || cartera[0]?.id || "" })}
        />
        <span className="flex flex-wrap items-center gap-2">
          Uno en concreto
          {value.mode === "uno" && (
            <select
              value={value.id}
              onChange={(e) => onChange({ mode: "uno", id: e.target.value })}
              className="rounded-md border border-violet-700/60 bg-violet-950/60 px-2 py-1 text-xs text-violet-100 focus:border-violet-500 focus:outline-none"
            >
              {cartera.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                  {m.tij ? ` · T-IJ ${m.tij}` : ""}
                  {defaults.includes(m.id) ? " · carril" : ""}
                  {m.nota ? ` · ${m.nota}` : ""}
                </option>
              ))}
            </select>
          )}
        </span>
      </label>
    </fieldset>
  );
}
