// Hosts de Vercel Blob que son NUESTROS (público de hoy y privado de la
// migración RGPD). Puro y client-safe: lo usan q-journey y blob-download-url.

export type BlobAccess = "public" | "private";
export type BlobTokens = { publicToken?: string | null; privateToken?: string | null };

const SUFFIX: Record<BlobAccess, string> = {
  public: ".public.blob.vercel-storage.com",
  private: ".private.blob.vercel-storage.com",
};

function envTokens(): BlobTokens {
  return {
    publicToken: typeof process !== "undefined" ? process.env.BLOB_READ_WRITE_TOKEN : undefined,
    privateToken: typeof process !== "undefined" ? process.env.BLOB_PRIVATE_READ_WRITE_TOKEN : undefined,
  };
}

/** vercel_blob_rw_<storeId>_<secreto> → storeid (en minúsculas). */
export function blobStoreIdFromToken(token: string | null | undefined): string | null {
  const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec((token || "").trim());
  return m ? m[1].toLowerCase() : null;
}

/** Host de la tienda del token: <storeid>.public|private.blob.vercel-storage.com. */
export function blobHostFromToken(token: string | null | undefined, access: BlobAccess = "public"): string | null {
  const id = blobStoreIdFromToken(token);
  return id ? `${id}${SUFFIX[access]}` : null;
}

function parseHttps(url: unknown): URL | null {
  if (typeof url !== "string") return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    return u;
  } catch {
    return null;
  }
}

export function blobAccessOfHost(hostname: string): BlobAccess | null {
  const h = hostname.toLowerCase();
  if (h.endsWith(SUFFIX.public)) return "public";
  if (h.endsWith(SUFFIX.private)) return "private";
  return null;
}

/**
 * ¿URL https de un Blob nuestro? Público: cualquier tienda pública de Vercel Blob
 * (lo de hoy). Privado: solo la tienda del token privado (el Blob privado de
 * lavori, p. ej., no es nuestro); sin token privado no se acepta ninguno.
 */
export function isOurBlobHost(url: unknown, tokens: BlobTokens = envTokens()): boolean {
  const u = parseHttps(url);
  if (!u) return false;
  const access = blobAccessOfHost(u.hostname);
  if (access === "public") return true;
  return access === "private" && isOurPrivateBlob(url, tokens.privateToken);
}

/** ¿URL de NUESTRA tienda exacta? Pública: la del token (sin id, el sufijo). Privada: la del token privado. */
export function isOwnStoreUrl(url: unknown, tokens: BlobTokens = envTokens()): boolean {
  const u = parseHttps(url);
  if (!u) return false;
  const access = blobAccessOfHost(u.hostname);
  if (access === "private") return isOurPrivateBlob(url, tokens.privateToken);
  if (access !== "public") return false;
  const host = blobHostFromToken(tokens.publicToken, "public");
  return host ? u.hostname.toLowerCase() === host : true;
}

/** ¿Está en la tienda PRIVADA del token privado (la que hay que leer con get)? */
export function isOurPrivateBlob(url: unknown, privateToken: string | null | undefined): boolean {
  const u = parseHttps(url);
  const host = blobHostFromToken(privateToken, "private");
  return !!u && !!host && u.hostname.toLowerCase() === host;
}
