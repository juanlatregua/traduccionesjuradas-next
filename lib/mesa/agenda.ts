// lib/mesa/agenda.ts — la agenda del vigía (lib/vigia.ts buildVigia) dentro de Hoy. Lógica PURA:
// lo que ya está en «Me toca a mí» no se repite en la agenda (clave: referencia del pedido).

import type { Tarjeta } from "./montones.ts";

const PEDIDO_HREF = /\/zona-traductor\/pedido\/([^/?#]+)/;
const SITE = /^https?:\/\/(www\.)?traduccionesjuradas\.net/;

/** Referencias de pedido que ya tienen tarjeta en la pila (su botón abre ese pedido). */
export function refsDeLaPila(tarjetas: Pick<Tarjeta, "accion">[]): Set<string> {
  const refs = new Set<string>();
  for (const t of tarjetas) {
    const m = PEDIDO_HREF.exec(t.accion?.href || "");
    if (m) refs.add(decodeURIComponent(m[1]));
  }
  return refs;
}

/** Filas de la agenda (AgendaItem.ref) que no están ya en la pila. */
export const fueraDeLaPila = <T extends { ref: string }>(items: T[], refs: Set<string>): T[] => items.filter((i) => !refs.has(i.ref));

/** Filas de gestión del vigía: las de pedido («o:REF») que ya están en la pila sobran. */
export const accionesFueraDeLaPila = <T extends { key?: string | null }>(rows: T[], refs: Set<string>): T[] => rows.filter((r) => !(r.key?.startsWith("o:") && refs.has(r.key.slice(2))));

/** Enlace del vigía (absoluto a la web pública) como ruta relativa de la zona. */
export const relativo = (href: string) => href.replace(SITE, "") || "/";
