// lib/lavori-doc-keys.ts — La clave de CONTENIDO de una solicitud de precio.
//
// De esta clave sale la ref del lead, y de la ref sale la idempotencia que evita
// abrir dos encargos por el mismo trabajo. Vive aparte, sin dependencias, para
// poder probarla: es la pieza que decide si dos solicitudes son la misma.
//
// Se usa el sha256 del fichero, NO su url. Por qué (19-sep-2026, caso Walid): la
// url la pone Blob en cada subida, así que el mismo papel subido otra vez daba
// una ref distinta y la guarda de "repetido" no se enteraba nunca —pese a que su
// propio comentario decía "ref estable a partir del contenido"—. Walid subió
// tres veces su certificado de antecedentes, dos de ellas con OTRO email (así
// que el guardia por identidad tampoco saltó), y acabó con TRES encargos
// abiertos en lavori y DOS presupuestos enviados con precios distintos: 78,65 €
// y 58,08 €. La huella del fichero no depende ni del email ni de la url.
//
// Los documentos anteriores al 19-sep no tienen hash: para ellos se sigue usando
// la url, que es el comportamiento de siempre.

export type LeadDocKeyed = {
  url: string;
  pageStart?: number;
  pageEnd?: number;
  /** sha256 del fichero. Identifica el DOCUMENTO; la url identifica la SUBIDA. */
  hash?: string | null;
  /** Páginas del documento (DocumentAnalysis.pageCount): permite saber si un rango es «entero». */
  pageCount?: number | null;
};

// «Documento entero» (5-oct-2026, Susana ES>PT): la puerta manda el documento SIN
// pageEnd y el constructor con pageEnd = nº de páginas; el rango entero daba dos
// huellas (`#1-` y `#1-3`) y el guardia no veía que era lo mismo. Entero = empieza
// en la 1 y no tiene fin o el fin llega a pageCount. Sin pageCount, un fin explícito
// se respeta tal cual (no se puede saber si es entero).
function isWhole(d: LeadDocKeyed): boolean {
  const start = Number(d.pageStart) || 1;
  const end = Number(d.pageEnd) || 0;
  const count = Number(d.pageCount) || 0;
  return start === 1 && (end === 0 || (count > 0 && end >= count));
}

const idOf = (d: LeadDocKeyed) => d.hash || d.url;
const join = (parts: string[]) => parts.sort().join("|");

/** Huella canónica: el documento entero es `#all` venga como venga. */
export function leadDocKeys(docs: LeadDocKeyed[]): string {
  return join(docs.map((d) => (isWhole(d) ? `${idOf(d)}#all` : `${idOf(d)}#${Number(d.pageStart) || 1}-${Number(d.pageEnd) || ""}`)));
}

/** Fórmula anterior al 9-oct-2026, tal cual (lo ya guardado en LavoriPriceRequest.contentKey). */
function legacyKeys(docs: LeadDocKeyed[], endFor: (d: LeadDocKeyed) => number | string): string {
  return join(docs.map((d) => `${idOf(d)}#${Number(d.pageStart) || 1}-${endFor(d)}`));
}

/**
 * Todas las huellas con las que puede estar guardada la MISMA solicitud: la canónica y las
 * dos antiguas del documento entero (sin fin, como mandaba la puerta; con fin = pageCount,
 * como mandaba el constructor) más la fórmula tal cual venga. Durante la transición, los
 * guardias de duplicado comparan contra todas.
 */
export function leadDocKeyVariants(docs: LeadDocKeyed[]): string[] {
  const out = new Set<string>([leadDocKeys(docs)]);
  out.add(legacyKeys(docs, (d) => Number(d.pageEnd) || ""));
  out.add(legacyKeys(docs, (d) => (isWhole(d) ? "" : Number(d.pageEnd) || "")));
  out.add(legacyKeys(docs, (d) => (isWhole(d) ? Number(d.pageCount) || Number(d.pageEnd) || "" : Number(d.pageEnd) || "")));
  return Array.from(out);
}
