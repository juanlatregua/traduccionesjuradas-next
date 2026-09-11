// lib/ai/unread-pages.ts — páginas sin texto dentro de un PDF segmentado.
//
// El segmentador (IA sobre texto) no ve las páginas sin capa de texto; salen como
// un documento «sin texto» para no perderlas. Pero una página suelta pegada a un
// documento leído es casi siempre parte de él — la hoja de firmas escaneada de un
// contrato (Fortuny, 2026-00139: la carta a 80 € y su pág. 4 como otra línea que
// el builder no dejaba unir). Esa página se une al documento de al lado; si de
// verdad es otro, el builder la separa. Dos o más páginas seguidas sin texto
// siguen aparte: pueden ser un escaneo entero. Y una página que SÍ tiene texto
// (el modelo la saltó, p. ej. por el recorte de caracteres) tampoco se une: sus
// palabras se perderían del precio.

export const UNREAD_PAGES_TYPE_ES = "Documento sin texto (escaneado, revisar)";

type PageDoc = {
  analysis: {
    document_type: { specific_type_es: string };
    document_metrics: { pages: number; estimated_words?: number };
  };
  pageStart: number;
  pageEnd: number;
  absorbedPages?: number[];
};

const isUnread = (d: PageDoc) => d.analysis.document_type.specific_type_es === UNREAD_PAGES_TYPE_ES;

export function absorbUnreadPages<T extends PageDoc>(documents: T[]): T[] {
  const sorted = [...documents].sort((a, b) => a.pageStart - b.pageStart);
  const out: T[] = [];
  sorted.forEach((d, i) => {
    if (!isUnread(d) || d.pageEnd !== d.pageStart || (d.analysis.document_metrics.estimated_words || 0) > 0) {
      out.push(d);
      return;
    }
    const prev = out[out.length - 1];
    const next = sorted[i + 1];
    const host =
      prev && !isUnread(prev) && prev.pageEnd === d.pageStart - 1
        ? prev
        : next && !isUnread(next) && next.pageStart === d.pageEnd + 1
          ? next
          : null;
    if (!host) {
      out.push(d);
      return;
    }
    if (host === prev) host.pageEnd = d.pageEnd;
    else host.pageStart = d.pageStart;
    host.analysis.document_metrics.pages = host.pageEnd - host.pageStart + 1;
    host.absorbedPages = [...(host.absorbedPages || []), d.pageStart];
  });
  return out;
}
