const MIN_IMAGE_BYTES = 30 * 1024;

/** Firma/logo: imagen pequeña, inline o no. Una foto pegada en el cuerpo (iPhone la marca inline) cuenta como adjunto. */
export function isSignatureLike(a: { contentType: string; size: number; isInline: boolean }): boolean {
  if (a.contentType.startsWith("image/")) return a.size < MIN_IMAGE_BYTES;
  return a.isInline;
}
