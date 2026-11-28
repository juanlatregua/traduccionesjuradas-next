// Vercel Blob sirve el fichero como adjunto con ?download=1; el atributo
// `download` de <a> no funciona entre dominios.
import { blobAccessOfHost } from "./blob-hosts.ts";

export function blobDownloadUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!blobAccessOfHost(u.hostname)) return url;
    u.searchParams.set("download", "1");
    return u.toString();
  } catch {
    return url;
  }
}
