// lib/caso/coste-lead.ts — La cifra del jurado manda sobre el coste de las líneas (lógica PURA, sin imports: la usa el constructor en cliente).

/**
 * Reparte la cifra del jurado (céntimos) entre las líneas: en proporción al coste
 * que traían, si no a las palabras, si no a partes iguales. Suma exacta (el resto
 * de redondeo va a la última). Devuelve euros.
 */
export function repartirCosteLead(lineas: { coste?: number | null; palabras?: number | null }[], cents: number): number[] {
  const n = lineas.length;
  if (n === 0 || !(cents > 0)) return [];
  const porCoste = lineas.map((l) => Math.max(0, Number(l.coste) || 0));
  const porPalabras = lineas.map((l) => Math.max(0, Number(l.palabras) || 0));
  const pesos = porCoste.every((x) => x > 0) ? porCoste : porPalabras.every((x) => x > 0) ? porPalabras : lineas.map(() => 1);
  const total = pesos.reduce((a, x) => a + x, 0);
  const out: number[] = [];
  let asignado = 0;
  for (let i = 0; i < n; i++) {
    const c = i === n - 1 ? cents - asignado : Math.round((cents * pesos[i]) / total);
    asignado += c;
    out.push(c / 100);
  }
  return out;
}
