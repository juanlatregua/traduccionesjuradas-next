// lib/contador/image.ts — Qué imágenes acepta el contador de TraduCAT, decidido
// por los primeros bytes (nunca por la extensión ni el mimeType declarado):
// JPG, PNG, WEBP y TIFF (multipágina: cada frame es una página), ≤ 20 Mpx por
// imagen. HEIC no lo admite. Sin dependencias: lee solo las cabeceras.

export type ImageKind = "jpeg" | "png" | "webp" | "tiff" | "heic";
export type Frame = { w: number; h: number };

export const MAX_IMAGE_PIXELS = 20_000_000;
const MAX_TIFF_FRAMES = 500;

export function detectImageKind(b: Buffer): ImageKind | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "webp";
  const sig = b.toString("latin1", 0, 4);
  if (sig === "II*\0" || sig === "MM\0*") return "tiff";
  if (b.toString("latin1", 4, 8) === "ftyp" && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(b.toString("latin1", 8, 12))) return "heic";
  return null;
}

function jpegFrames(b: Buffer): Frame[] | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return [{ h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }];
    }
    if (marker === 0xda || len < 2) return null;
    i += 2 + len;
  }
  return null;
}

function webpFrames(b: Buffer): Frame[] | null {
  if (b.length < 30) return null;
  const chunk = b.toString("latin1", 12, 16);
  if (chunk === "VP8 ") return [{ w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }];
  if (chunk === "VP8L") {
    const [b0, b1, b2, b3] = [b[21], b[22], b[23], b[24]];
    return [{ w: 1 + (((b1 & 0x3f) << 8) | b0), h: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)) }];
  }
  if (chunk === "VP8X") return [{ w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }];
  return null;
}

function tiffFrames(b: Buffer): Frame[] | null {
  const le = b[0] === 0x49;
  const u16 = (o: number) => (le ? b.readUInt16LE(o) : b.readUInt16BE(o));
  const u32 = (o: number) => (le ? b.readUInt32LE(o) : b.readUInt32BE(o));
  const frames: Frame[] = [];
  const seen = new Set<number>();
  let ifd = u32(4);
  while (ifd !== 0) {
    if (seen.has(ifd) || frames.length >= MAX_TIFF_FRAMES || ifd + 2 > b.length) return null;
    seen.add(ifd);
    const n = u16(ifd);
    if (ifd + 2 + n * 12 + 4 > b.length) return null;
    let w = 0;
    let h = 0;
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      const tag = u16(e);
      const type = u16(e + 2);
      const val = type === 3 ? u16(e + 8) : type === 4 ? u32(e + 8) : 0;
      if (tag === 256) w = val;
      if (tag === 257) h = val;
    }
    if (!w || !h) return null;
    frames.push({ w, h });
    ifd = u32(ifd + 2 + n * 12);
  }
  return frames.length ? frames : null;
}

export function imageFrames(b: Buffer, kind: ImageKind): Frame[] | null {
  try {
    if (kind === "png") return b.length >= 24 ? [{ w: b.readUInt32BE(16), h: b.readUInt32BE(20) }] : null;
    if (kind === "jpeg") return jpegFrames(b);
    if (kind === "webp") return webpFrames(b);
    if (kind === "tiff") return tiffFrames(b);
    return null;
  } catch {
    return null;
  }
}

/**
 * ¿Se manda esta imagen al contador? HEIC, tipos desconocidos, cabeceras ilegibles y
 * cualquier frame de más de 20 Mpx se quedan con Haiku: no se reduce la imagen
 * (sharp solo va empaquetado en las rutas de lectura, no en las de análisis).
 */
export function imageEligibility(b: Buffer | undefined | null): { ok: true; kind: ImageKind; pages: number } | { ok: false; reason: string } {
  if (!b) return { ok: false, reason: "sin_bytes" };
  const kind = detectImageKind(b);
  if (!kind) return { ok: false, reason: "imagen_no_admitida" };
  if (kind === "heic") return { ok: false, reason: "heic_no_admitido" };
  const frames = imageFrames(b, kind);
  if (!frames || frames.some((f) => !f.w || !f.h)) return { ok: false, reason: "dimensiones_ilegibles" };
  if (frames.some((f) => f.w * f.h > MAX_IMAGE_PIXELS)) return { ok: false, reason: "imagen_mas_de_20mpx" };
  return { ok: true, kind, pages: frames.length };
}
