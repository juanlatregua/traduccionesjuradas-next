import { sanearProcedencia, type Procedencia } from "./procedencia.ts";

const KEY = "tj_llegada";

function hostOfReferrer(): string {
  try {
    return document.referrer ? new URL(document.referrer).hostname : "";
  } catch {
    return "";
  }
}

function llegadaActual() {
  const q = new URLSearchParams(location.search);
  return { referrer: hostOfReferrer(), landing: location.pathname, utm_source: q.get("utm_source"), utm_medium: q.get("utm_medium"), utm_campaign: q.get("utm_campaign") };
}

export function registrarLlegada(): void {
  try {
    if (!sessionStorage.getItem(KEY)) sessionStorage.setItem(KEY, JSON.stringify(llegadaActual()));
  } catch {}
}

export function leerProcedencia(): Procedencia | null {
  let saved: unknown = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
  } catch {}
  return sanearProcedencia(saved ?? llegadaActual());
}
