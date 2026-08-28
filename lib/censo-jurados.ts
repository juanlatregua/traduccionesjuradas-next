// lib/censo-jurados.ts — El dato citable de las landings de idioma (AEO 24-ago-2026):
// «Traductores jurados de X en activo en España: N (lista oficial del Ministerio,
// julio 2026)». Los buscadores y los motores de IA citan a quien les da la
// frase-respuesta CON FUENTE Y CON FECHA; la competencia sirve cifras de 2024 sin
// atribuir. Ese es todo el valor de este fichero, y por eso el número se mantiene
// a mano con cada volcado del buscador del Ministerio.
//
// Aquí vivía también un recuento EN VIVO de los jurados de la red, que se pedía al
// padrón de otro sistema para añadir «· M en la red de tj.net, responden hoy».
// Retirado el 28-ago-2026: un lector entiende «trabajamos con M traductores» y no
// era eso, en tres lenguas M valía 1, y la promesa de respuesta se hacía en nombre
// de gente que no la había hecho. Con ello desaparece la última dependencia de un
// sistema externo para pintar una página pública.

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
