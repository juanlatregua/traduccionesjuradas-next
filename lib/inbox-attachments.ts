const MIN_IMAGE_BYTES = 30 * 1024;

/** Firma/logo: imagen pequeña, inline o no. Una foto pegada en el cuerpo (iPhone la marca inline) cuenta como adjunto. */
export function isSignatureLike(a: { contentType: string; size: number; isInline: boolean }): boolean {
  if (a.contentType.startsWith("image/")) return a.size < MIN_IMAGE_BYTES;
  return a.isInline;
}

const MIN_SHORT_SIDE_PX = 400;

/** Decisión final para una imagen: firma si es pequeña, si es inline de lado corto <400 px, o si el remitente ya la mandó en otra conversación. */
export function isSignatureImage(a: {
  size: number;
  isInline: boolean;
  contentType: string;
  width?: number | null;
  height?: number | null;
  seenInOtherConversation?: boolean;
}): boolean {
  if (!a.contentType.startsWith("image/")) return a.isInline;
  if (a.size < MIN_IMAGE_BYTES) return true;
  if (!a.isInline) return false;
  if (a.seenInOtherConversation) return true;
  if (a.width && a.height && Math.min(a.width, a.height) < MIN_SHORT_SIDE_PX) return true;
  return false;
}
