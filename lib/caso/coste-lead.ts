// lib/caso/coste-lead.ts — La cifra del jurado es el coste de las líneas que cubre su
// solicitud (lógica PURA, sin imports de servidor: la usa el constructor en cliente).
// Precio de venta: el del motor, que solo sube si con él el margen no llega — la
// misma regla que lib/lavori-quote-fill.

import { clientCentsWithMotorPrice, spreadCents } from "../lavori-directo-math.ts";

export type LineaCoste = { id: string; url: string | null; costeCents: number; ventaCents: number; porPagina: boolean };
export type CosteJurado =
  | { ok: true; lineas: { id: string; costeCents: number; ventaCents: number }[]; margenCents: number }
  | { ok: false; motivo: string };

/**
 * Cubre las líneas de los documentos de la solicitud (tantos ficheros distintos como
 * docsCount) o, sin documentos, la única línea manual. Si no cuadra, no reparte.
 */
export function aplicarCosteJurado(lineas: LineaCoste[], lead: { baseCents: number; docsCount: number }): CosteJurado {
  if (!(lead.baseCents > 0) || lineas.length === 0) return { ok: false, motivo: "sin cifra o sin líneas" };
  const conDoc = lineas.filter((l) => l.url);
  const ficheros = new Set(conDoc.map((l) => l.url)).size;
  const cubre = conDoc.length === 0 ? (lineas.length === 1 ? lineas : null) : ficheros === lead.docsCount ? conDoc : null;
  if (!cubre) {
    const n = lead.docsCount;
    return { ok: false, motivo: `La cifra del jurado cubre ${n} doc${n === 1 ? "" : "s"} y aquí hay ${conDoc.length ? ficheros : lineas.length}: revisa el coste.` };
  }
  const pesos = cubre.every((l) => l.costeCents > 0) ? cubre.map((l) => l.costeCents) : cubre.map((l) => l.ventaCents);
  const costes = spreadCents(lead.baseCents, pesos);
  const out = cubre.map((l, i) => ({
    id: l.id,
    costeCents: costes[i],
    ventaCents: clientCentsWithMotorPrice(l.ventaCents, costes[i], l.porPagina ? 0 : undefined, l.porPagina),
  }));
  return { ok: true, lineas: out, margenCents: out.reduce((a, l) => a + l.ventaCents - l.costeCents, 0) };
}
