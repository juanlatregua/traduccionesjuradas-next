// lib/censo-jurados.ts — El dato citable de las landings de idioma (AEO 24-ago-2026):
// «Traductores jurados de X en activo: N (lista oficial del Ministerio, julio
// 2026) · M en la red de tj.net, responden hoy». Los buscadores IA citan a quien
// les da la frase-respuesta con fecha fresca; la competencia sirve cifras de 2024.
//
// N = censo STIJ oficial (volcado del buscador del Ministerio hecho por lavori,
// 31-jul-2026; se actualiza a mano con cada volcado — lavori avisa).
// M = jurados CON CANAL de la red (tablón de lavori), en vivo con caché 1 h y
// respaldo estático (padrón 24-ago-2026).

import { mapLavoriMiembro } from "@/lib/lavori-bridge";

export const CENSO_STIJ_FECHA = "julio 2026";

/** Jurados ACTIVOS por lengua en el censo oficial del Ministerio (31-jul-2026). */
export const CENSO_STIJ: Record<string, number> = {
  en: 3993,
  fr: 1340,
  de: 756,
  ro: 166,
  it: 82,
  pl: 77,
  ar: 65,
  nl: 48,
  pt: 38,
  ru: 34,
  ca: 31,
  bg: 17,
  hu: 11,
  el: 10,
  zh: 9,
  sv: 9,
  sr: 9,
  la: 8,
  da: 7,
  hr: 7,
  fi: 6,
  no: 5,
  uk: 4,
  he: 4,
  fa: 3,
  sl: 3,
  mk: 1,
  tr: 1,
};

/** Jurados con canal en la red (padrón lavori 24-ago-2026) — respaldo estático. */
const RED_FALLBACK: Record<string, number> = {
  en: 18,
  de: 15,
  nl: 10,
  sv: 6,
  pt: 3,
  ar: 3,
  fr: 3,
  pl: 2,
  ru: 2,
  bg: 2,
  ca: 2,
  da: 2,
  el: 2,
  hu: 2,
  it: 1,
  tr: 2,
  uk: 1,
  fa: 1,
  fi: 1,
  he: 1,
  hr: 1,
  la: 1,
  mk: 1,
  no: 1,
  ro: 1,
  sl: 1,
  sr: 1,
  zh: 1,
};

const LAVORI_MIEMBROS_ENDPOINT =
  process.env.LAVORI_MIEMBROS_URL || "https://lavori.es/api/motor/miembros";

/** Nº de jurados de la lengua CON CANAL en la red, en vivo (caché ISR 1 h).
 *  Nunca lanza: sin secreto o sin respuesta cae al respaldo estático. */
export async function redJuradosCount(lang: string): Promise<number> {
  const l = String(lang || "").trim().toLowerCase();
  const fallback = RED_FALLBACK[l] ?? 0;
  const secret = process.env.MOTOR_LAVORI_SECRET;
  if (!secret || !/^[a-z]{2,3}$/.test(l)) return fallback;
  try {
    const res = await fetch(
      `${LAVORI_MIEMBROS_ENDPOINT}?lengua=${encodeURIComponent(l.toUpperCase())}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(10_000),
      }
    );
    const data = (await res.json().catch(() => null)) as { miembros?: unknown[] } | null;
    if (!res.ok || !Array.isArray(data?.miembros)) return fallback;
    const conCanal = data.miembros
      .map((w) => mapLavoriMiembro(w as any))
      .filter((m) => m && m.canal !== false && !m.enPaz).length;
    return conCanal || fallback;
  } catch {
    return fallback;
  }
}
