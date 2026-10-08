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
// aleatorio de Vercel Blob («-AbC…» de 20+ caracteres) y sin extensión.
export function documentKey(urlOrName: string): string {
  const seg = lastSegment(urlOrName);
  const dot = seg.lastIndexOf(".");
  let base = dot > 0 ? seg.slice(0, dot) : seg;
  base = base.replace(/^(?:\d{10,}-)+/, "").replace(/-[A-Za-z0-9]{20,}$/, "");
  return (base || seg).toLowerCase();
}

// Agrupa por documento. De cada grupo queda UNA versión principal: la que es
// `primaryUrl` (finalDeliveryFileUrl) o, si no está en el grupo, la última.
// El resto son versiones anteriores. El orden de salida respeta el de entrada.
export function splitDocumentVersions<T extends { url: string }>(
  files: T[],
  primaryUrl?: string | null
): { current: T[]; previous: T[] } {
  const groups = new Map<string, T[]>();
  for (const f of files) {
    const k = documentKey(f.url);
    groups.set(k, [...(groups.get(k) || []), f]);
  }
  const winner = new Map<string, T>();
  for (const [k, list] of groups) {
    winner.set(k, list.find((f) => primaryUrl && f.url === primaryUrl) || list[list.length - 1]);
  }
  const current: T[] = [];
  const previous: T[] = [];
  for (const f of files) {
    (winner.get(documentKey(f.url)) === f ? current : previous).push(f);
  }
  return { current, previous };
}
