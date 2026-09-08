"use client";

import { useEffect, useState } from "react";
import {
  LAVORI_MAX_CANDIDATOS,
  lavoriCarteraForLang,
  pickLavoriAuto,
  type LavoriMember,
  type LavoriRoute,
} from "@/lib/lavori-bridge";

// Elección de destinatarios de una solicitud vía lavori (orden Juan 21-ago-2026:
// "poder enviar a todos los de la lengua o a uno en concreto", p. ej. inglés →
// Vanessa). Modos: carril por defecto (LAVORI_CANDIDATES), toda la cartera de la
// lengua (si no cabe en el tope de lavori, LAVORI_MAX_CANDIDATOS, se eligen solos
// los más activos — orden Juan 8-sep-2026, cuando "todos" en EN eran 45 y lavori
// devolvía 400), varios a mano (hasta el tope) o un jurado concreto. La cartera
// llega EN VIVO de lavori vía /api/lavori/miembros (respaldo: tabla estática
// mientras carga o si falla).
export type LavoriPick =
  | { mode: "carril" }
  | { mode: "todos" }
  | { mode: "varios"; ids: string[] }
  | { mode: "uno"; id: string };

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

/** Los que pueden recibir un sobre: con canal y no en paz. */
export function lavoriReceptores(cartera: LavoriMember[]): LavoriMember[] {
  return cartera.filter((m) => m.canal !== false && !m.enPaz);
}

/** Candidatos a enviar según el modo. `undefined` = carril por defecto (lo aplica
 * la API). En "todos" viajan los que pueden recibir; si son más que el tope de
 * lavori, los elige `pickLavoriAuto` (por eso hace falta la lengua). */
export function lavoriPickToCandidatos(pick: LavoriPick, cartera: LavoriMember[], lang?: string): string[] | undefined {
  if (pick.mode === "todos") {
    const receptores = lavoriReceptores(cartera);
    if (receptores.length > LAVORI_MAX_CANDIDATOS && lang) return pickLavoriAuto(lang, cartera).map((m) => m.id);
    return receptores.map((m) => m.id);
  }
  if (pick.mode === "varios") return pick.ids.length > 0 ? pick.ids : undefined;
  if (pick.mode === "uno") return pick.id ? [pick.id] : undefined;
  return undefined;
}

/** Motivo por el que la elección no se puede enviar (o null si vale). Se comprueba
 * ANTES de llamar a la API para que el 400 de lavori no sea la primera noticia. */
export function lavoriPickError(pick: LavoriPick, cartera: LavoriMember[], lang?: string): string | null {
  if (pick.mode === "carril") return null;
  const candidatos = lavoriPickToCandidatos(pick, cartera, lang);
  if (!candidatos || candidatos.length === 0) return "Elige el jurado al que enviar la solicitud.";
  if (candidatos.length > LAVORI_MAX_CANDIDATOS) {
    return `lavori admite como máximo ${LAVORI_MAX_CANDIDATOS} jurados por solicitud (aquí serían ${candidatos.length}). Elige hasta ${LAVORI_MAX_CANDIDATOS} con «Varios».`;
  }
  return null;
}

export function describeLavoriPick(pick: LavoriPick, route: LavoriRoute, cartera: LavoriMember[]): string {
  const name = (id: string) => cartera.find((m) => m.id === id)?.nombre || id;
  if (pick.mode === "todos") {
    const receptores = lavoriReceptores(cartera);
    if (receptores.length > LAVORI_MAX_CANDIDATOS) {
      const auto = pickLavoriAuto(route.lang, cartera);
      return `${auto.length} de los ${receptores.length} jurados de ${route.lang.toUpperCase()} elegidos solos (tope de lavori): ${auto.map((m) => m.nombre).join(", ")}`;
    }
    return `todos los jurados de ${route.lang.toUpperCase()} del tablón con canal (${receptores.length})`;
  }
  if (pick.mode === "varios") return `${pick.ids.length} jurados elegidos: ${pick.ids.map(name).join(", ")}`;
  if (pick.mode === "uno") return `solo ${name(pick.id)}`;
  return route.candidatos.map(name).join(", ");
}

function señales(m: LavoriMember): string {
  const out: string[] = [];
  if (m.papelUnico) out.push("papel único");
  if (m.conTarifas) out.push("con tarifas");
  if (m.canal === false) out.push("SIN CANAL");
  if (m.enPaz) out.push("en paz");
  if (m.disponible === false) out.push("no disponible");
  if (m.nota) out.push(m.nota);
  return out.join(" · ");
}

function entrada(m: LavoriMember): string {
  if (!m.ultimaSesion) return "nunca ha entrado";
  const t = Date.parse(m.ultimaSesion);
  if (!Number.isFinite(t)) return "";
  const dias = Math.floor((Date.now() - t) / 86_400_000);
  if (dias <= 0) return "entró hoy";
  if (dias === 1) return "entró ayer";
  if (dias < 60) return `entró hace ${dias} días`;
  return `entró hace ${Math.round(dias / 30)} meses`;
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
  const receptores = lavoriReceptores(miembros);
  const conCanal = receptores.length;
  const todosCabe = conCanal <= LAVORI_MAX_CANDIDATOS;
  const auto = !todosCabe && value.mode === "todos" ? pickLavoriAuto(route.lang, miembros) : [];
  const elegidos = value.mode === "varios" ? value.ids : [];
  const lleno = elegidos.length >= LAVORI_MAX_CANDIDATOS;
  const radio = "mt-0.5 h-3.5 w-3.5 accent-violet-500";
  const label = "flex items-start gap-2 text-xs text-violet-100/90";

  const toggle = (id: string) => {
    const set = new Set(elegidos);
    if (set.has(id)) set.delete(id);
    else if (!lleno) set.add(id);
    onChange({ mode: "varios", ids: miembros.filter((m) => set.has(m.id)).map((m) => m.id) });
  };

  return (
    <fieldset className="space-y-1.5" disabled={disabled}>
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-violet-300/80">
        Destinatarios
        <span className="ml-2 font-normal normal-case tracking-normal text-violet-400/70">
          {cartera.loading ? "leyendo el tablón…" : cartera.live ? "cartera en vivo de lavori" : "cartera de respaldo (lavori no respondió)"}
          {" · "}máximo {LAVORI_MAX_CANDIDATOS} por solicitud (regla de lavori)
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
          {todosCabe ? (
            <>
              Todos los jurados de {route.lang.toUpperCase()} del tablón con canal ({conCanal}
              {miembros.length !== conCanal ? ` de ${miembros.length}` : ""})
            </>
          ) : (
            <>
              Los {LAVORI_MAX_CANDIDATOS} más activos de los {conCanal} de {route.lang.toUpperCase()} con canal, elegidos solos
              <span className="ml-1 text-violet-400/70">(carril · con tarifas · disponibles · última entrada; empates al azar)</span>
            </>
          )}
        </span>
      </label>
      {auto.length > 0 && (
        <div className="ml-6 rounded-md border border-violet-800/60 bg-violet-950/40 p-2 text-xs text-violet-200/90">
          {auto.map((m) => (
            <span key={m.id} className="mr-3 inline-block">
              {m.nombre}
              <span className="text-violet-400/70"> · {entrada(m)}</span>
            </span>
          ))}
        </div>
      )}
      <label className={label}>
        <input
          type="radio"
          name="lavori-pick"
          className={radio}
          checked={value.mode === "varios"}
          onChange={() => onChange({ mode: "varios", ids: value.mode === "varios" ? value.ids : [] })}
        />
        <span>
          Varios a mano (hasta {LAVORI_MAX_CANDIDATOS})
          {value.mode === "varios" && (
            <span className="ml-1 text-violet-300/80">
              · {elegidos.length} de {LAVORI_MAX_CANDIDATOS}
            </span>
          )}
        </span>
      </label>
      {value.mode === "varios" && (
        <div className="ml-6 grid max-h-56 gap-1 overflow-y-auto rounded-md border border-violet-800/60 bg-violet-950/40 p-2 sm:grid-cols-2">
          {receptores.length === 0 && (
            <span className="text-xs text-violet-300/70">(sin jurados de {route.lang.toUpperCase()} con canal en el tablón)</span>
          )}
          {receptores.map((m) => {
            const s = señales(m);
            const checked = elegidos.includes(m.id);
            return (
              <label key={m.id} className={`flex items-start gap-2 text-xs ${!checked && lleno ? "opacity-50" : "text-violet-100/90"}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5 accent-violet-500"
                  checked={checked}
                  disabled={!checked && lleno}
                  onChange={() => toggle(m.id)}
                />
                <span>
                  {m.nombre}
                  {m.tij ? ` · T-IJ ${m.tij}` : ""}
                  {defaults.includes(m.id) ? " · carril" : ""}
                  <span className="text-violet-300/70">
                    {" · "}
                    {entrada(m)}
                    {s ? ` · ${s}` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      )}
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
