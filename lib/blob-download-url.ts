// Vercel Blob sirve el fichero como adjunto con ?download=1; el atributo
// `download` de <a> no funciona entre dominios.
export function blobDownloadUrl(url: string): string {
  try {
    const u = new URL(url);
    if (!u.hostname.endsWith(".blob.vercel-storage.com")) return url;
    u.searchParams.set("download", "1");
    return u.toString();
  } catch {
    return url;
  }
}
