// Solicitudes enviadas por la puerta que aún no tienen presupuesto ni pedido: lo que el cliente ve en su área.
// Puro: el acceso a BD vive en lib/client-portal.ts.

export type SolicitudRow = {
  id: string;
  casoId: string | null;
  lang: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
  sourceLang: string | null;
  targetLang: string | null;
  targetLangs: string[];
  urgency: string | null;
  neededBy: Date | null;
  documentos: number;
  paginas: number;
};

export type SolicitudView = {
  id: string;
  lang: string | null;
  date: Date;
  source: string | null;
  targets: string[];
  urgency: string | null;
  neededBy: Date | null;
  documentos: number;
  paginas: number;
};

/** Sin duplicar: una solicitud cuyo caso ya tiene presupuesto o pedido se ve en esas tablas. */
export function pendingSolicitudes(rows: SolicitudRow[], covered: Array<{ casoId: string | null }>): SolicitudView[] {
  const done = new Set(covered.map((c) => c.casoId).filter((c): c is string => Boolean(c)));
  return rows
    .filter((r) => !r.casoId || !done.has(r.casoId))
    .map((r) => ({
      id: r.id,
      lang: r.lang,
      date: r.confirmedAt ?? r.createdAt,
      source: r.sourceLang,
      targets: r.targetLangs.length ? r.targetLangs : r.targetLang ? [r.targetLang] : [],
      urgency: r.urgency,
      neededBy: r.neededBy,
      documentos: r.documentos,
      paginas: r.paginas,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function langLabel(code: string | null | undefined, intl: string): string {
  const c = String(code || "").trim().toLowerCase();
  if (!c || c === "unknown") return "";
  try {
    return new Intl.DisplayNames([intl], { type: "language" }).of(c) || c;
  } catch {
    return c;
  }
}
