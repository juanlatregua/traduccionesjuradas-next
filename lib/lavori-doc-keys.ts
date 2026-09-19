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
};

export function leadDocKeys(docs: LeadDocKeyed[]): string {
  return docs
    .map((d) => `${d.hash || d.url}#${Number(d.pageStart) || 1}-${Number(d.pageEnd) || ""}`)
    .sort()
    .join("|");
}
