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
