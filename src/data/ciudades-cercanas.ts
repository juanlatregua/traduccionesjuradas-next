import { CIUDADES, type Ciudad } from "./ciudades";

// Ciudades cercanas: misma comunidad primero (misma provincia antes), relleno con
// otras indexables. Mismo criterio que el hub y el sitemap: solo !noindex. El
// relleno reparte enlaces entrantes (menos enlazadas primero, luego más pobladas)
// para que ninguna ciudad indexable quede sin enlaces internos.
const CIUDADES_INDEXABLES = CIUDADES.filter((c) => !c.noindex);
const CERCANAS_N = 5;

export const CERCANAS_BY_SLUG: Map<string, Ciudad[]> = (() => {
  const result = new Map<string, Ciudad[]>();
  const entrantes = new Map<string, number>(
    CIUDADES_INDEXABLES.map((c) => [c.slug, 0])
  );
  const orden = [...CIUDADES_INDEXABLES].sort(
    (a, b) => a.poblacion - b.poblacion
  );
  for (const c of orden) {
    const otras = CIUDADES_INDEXABLES.filter((o) => o.slug !== c.slug);
    const propias = otras
      .filter((o) => o.comunidad === c.comunidad)
      .sort(
        (a, b) =>
          Number(b.provincia === c.provincia) -
            Number(a.provincia === c.provincia) || b.poblacion - a.poblacion
      )
      .slice(0, CERCANAS_N);
    const relleno = otras
      .filter((o) => !propias.includes(o))
      .sort(
        (a, b) =>
          (entrantes.get(a.slug) ?? 0) - (entrantes.get(b.slug) ?? 0) ||
          b.poblacion - a.poblacion
      )
      .slice(0, CERCANAS_N - propias.length);
    const elegidas = [...propias, ...relleno];
    elegidas.forEach((o) =>
      entrantes.set(o.slug, (entrantes.get(o.slug) ?? 0) + 1)
    );
    result.set(c.slug, elegidas);
  }
  return result;
})();
