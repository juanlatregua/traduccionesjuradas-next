// Versiones de una misma traducción: la entrega antigua (descargar y volver a
// subir) dejaba el mismo documento dos veces en deliveryFilesJson. Puro: sin Prisma.

function lastSegment(urlOrName: string): string {
  let s = urlOrName.split("?")[0].split("#")[0];
  s = s.slice(s.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// Nombre sin ruta, sin prefijos de timestamp («1791380856919-»), sin el sufijo
// aleatorio de Vercel Blob (guion + 30 caracteres exactos) y sin extensión.
export function documentKey(urlOrName: string): string {
  const seg = lastSegment(urlOrName);
  const dot = seg.lastIndexOf(".");
  let base = dot > 0 ? seg.slice(0, dot) : seg;
  base = base.replace(/^(?:\d{10,}-)+/, "").replace(/-[A-Za-z0-9]{30}$/, "");
  return (base || seg).toLowerCase();
}

function stem(url: string): string {
  const seg = lastSegment(url);
  const dot = seg.lastIndexOf(".");
  return (dot > 0 ? seg.slice(0, dot) : seg).replace(/-[A-Za-z0-9]{30}$/, "").toLowerCase();
}

// Nombre completo (con su timestamp) de la copia de la que sale una re-subida:
// el principal sin su primer «<ts>-» y sin el sufijo de Blob.
function reuploadSource(url: string): string | null {
  const s = stem(url);
  return /^\d{10,}-/.test(s) ? s.replace(/^\d{10,}-/, "") : null;
}

// Instante de subida que lleva el nombre («<ts>-nombre»); null si no lo lleva.
function uploadedAt(url: string): number | null {
  const m = lastSegment(url).match(/^(\d{10,})-/);
  return m ? Number(m[1]) : null;
}

function isLavoriDelivery(url: string): boolean {
  return url.includes("/entregas-lavori/");
}

// Separa las versiones anteriores de un mismo documento. Mismo nombre base NO
// basta (un pedido de varios documentos puede traer dos «traduccion.pdf» de
// lavori): solo es versión anterior si
//  (a0) el principal es una re-subida suya (su nombre sin el primer timestamp y sin
//      sufijo Blob es el nombre completo del archivo, también si es de lavori), o
//  (a) el otro es la principal (`primaryUrl` = finalDeliveryFileUrl ||
//      translatedFileUrl), el archivo se subió antes con el mismo nombre base y
//      no es una entrega de lavori, o
//  (b) un evento delivery.corrected lo da por sustituido (`replacedUrls`).
// Ante la duda se queda como actual: sobra un PDF mejor que falte un documento.
export function splitDocumentVersions<T extends { url: string }>(
  files: T[],
  primaryUrl?: string | null,
  replacedUrls: string[] = []
): { current: T[]; previous: T[] } {
  const replaced = new Set(replacedUrls);
  const primary = primaryUrl ? files.find((f) => f.url === primaryUrl) : undefined;
  const primaryKey = primary ? documentKey(primary.url) : null;
  const primaryTs = primary ? uploadedAt(primary.url) : null;

  const isPrevious = (f: T): boolean => {
    if (primary && f !== primary && reuploadSource(primary.url) === stem(f.url)) return true;
    const key = documentKey(f.url);
    const sameKeyOthers = files.filter((o) => o !== f && documentKey(o.url) === key);
    if (sameKeyOthers.length === 0) return false;
    if (replaced.has(f.url)) return true;
    if (!primary || f === primary || key !== primaryKey || isLavoriDelivery(f.url)) return false;
    const ts = uploadedAt(f.url);
    return primaryTs !== null && (ts === null || ts < primaryTs);
  };

  const current: T[] = [];
  const previous: T[] = [];
  for (const f of files) (isPrevious(f) ? previous : current).push(f);
  return { current, previous };
}

type EventLike = { type: string; payload?: unknown; createdAt?: Date | string };

function payloadOf(e: EventLike): Record<string, unknown> {
  return e.payload && typeof e.payload === "object" ? (e.payload as Record<string, unknown>) : {};
}

// Archivos que vienen del traductor (entregas de lavori o subidas suyas): hay que
// revisarlos antes de enviarlos al cliente.
export function translatorFileUrls(events: EventLike[], assignmentUrls: (string | null | undefined)[] = []): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    const p = payloadOf(e);
    const u = e.type === "lavori.entrega_subida" ? p.attachmentUrl : e.type === "translator.delivered" ? p.fileUrl : "";
    if (u) out.add(String(u));
  }
  for (const u of assignmentUrls) if (u) out.add(u);
  return out;
}

export function isTranslatorFile(url: string, translator: Set<string>): boolean {
  return translator.has(url) || url.includes("/entregas-lavori/") || url.includes("/translator-deliveries/");
}

// Revisión por URL: manda el último evento delivery.file_reviewed de cada una.
export function reviewedFileUrls(events: EventLike[]): Set<string> {
  const sorted = events
    .filter((e) => e.type === "delivery.file_reviewed")
    .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  const out = new Set<string>();
  for (const e of sorted) {
    const p = payloadOf(e);
    const u = String(p.url || "");
    if (!u) continue;
    if (p.reviewed === false) out.delete(u);
    else out.add(u);
  }
  return out;
}

export function unreviewedUrls(selected: string[], translator: Set<string>, reviewed: Set<string>): string[] {
  return selected.filter((u) => isTranslatorFile(u, translator) && !reviewed.has(u));
}

export type PendingLavoriEntrega = { url: string; name: string; mimeType: string | null };

function sentAfter(events: EventLike[], at: Date | string | undefined): boolean {
  const since = at ? new Date(at).getTime() : 0;
  return events.some((e) => e.type === "notification.delivery_ready.sent" && new Date(e.createdAt || 0).getTime() > since);
}

// Entregas de lavori recibidas y aún sin procesar: su URL todavía no está en la
// lista de entrega del pedido y no ha habido un envío al cliente posterior a ella.
// Entran al panel como archivos del traductor.
export function pendingLavoriEntregas(events: EventLike[], deliveryFilesJson: unknown): PendingLavoriEntrega[] {
  const delivered = new Set(
    (Array.isArray(deliveryFilesJson) ? deliveryFilesJson : []).map((f: any) => String(f?.url || ""))
  );
  const out: PendingLavoriEntrega[] = [];
  for (const e of events) {
    if (e.type !== "lavori.entrega_subida") continue;
    const p = payloadOf(e);
    const url = String(p.attachmentUrl || "");
    if (!url || delivered.has(url) || out.some((o) => o.url === url) || sentAfter(events, e.createdAt)) continue;
    out.push({ url, name: String(p.nombre || "traduccion.pdf"), mimeType: p.contentType ? String(p.contentType) : null });
  }
  return out;
}

// Entregas de lavori ya en la lista de entrega pero que nunca llegaron a enviarse al
// cliente: en un reenvío no salen marcadas por defecto.
export function unsentLavoriUrls(events: EventLike[], deliveryFilesJson: unknown): string[] {
  const delivered = new Set(
    (Array.isArray(deliveryFilesJson) ? deliveryFilesJson : []).map((f: any) => String(f?.url || ""))
  );
  return events
    .filter((e) => e.type === "lavori.entrega_subida")
    .map((e) => ({ url: String(payloadOf(e).attachmentUrl || ""), at: e.createdAt }))
    .filter((x) => x.url && delivered.has(x.url) && !sentAfter(events, x.at))
    .map((x) => x.url);
}

// Para adjuntos automáticos (respuesta de la bandeja, mensaje libre): lo del traductor
// sin revisar no se adjunta.
export function splitReviewedFiles<T extends { url: string }>(
  files: T[],
  events: EventLike[],
  assignmentUrls: (string | null | undefined)[] = []
): { allowed: T[]; blocked: T[] } {
  const blocked = new Set(unreviewedForSend(files.map((f) => f.url), events, assignmentUrls));
  return { allowed: files.filter((f) => !blocked.has(f.url)), blocked: files.filter((f) => blocked.has(f.url)) };
}

export function unreviewedNotice(n: number): string {
  return `${n} archivo(s) sin revisar no se han adjuntado: revísalos en Entregar al cliente`;
}

// Todo archivo del traductor que vaya a salir debe tener su «Revisada ✓».
export function unreviewedForSend(
  urls: string[],
  events: EventLike[],
  assignmentUrls: (string | null | undefined)[] = []
): string[] {
  return unreviewedUrls(urls, translatorFileUrls(events, assignmentUrls), reviewedFileUrls(events));
}
