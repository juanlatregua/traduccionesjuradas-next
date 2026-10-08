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
