// Minimal ZIP directory reader: lists every entry (also repeated names) without decompressing anything.

export type ZipEntry = { name: string; method: number; encrypted: boolean; compressedSize: number; declaredSize: number; data: Uint8Array };

const utf8 = new TextDecoder("utf-8", { fatal: true });
const latin1 = new TextDecoder("latin1");

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (utf8Flag) return new TextDecoder("utf-8").decode(bytes);
  try {
    return utf8.decode(bytes);
  } catch {
    return latin1.decode(bytes);
  }
}

/** null = not a readable ZIP (truncated, ZIP64, inconsistent offsets). */
export function listZip(b: Uint8Array): ZipEntry[] | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = v.getUint16(eocd + 10, true);
  const cdOffset = v.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) return null;
  const out: ZipEntry[] = [];
  let p = cdOffset;
  for (let k = 0; k < count; k++) {
    if (p + 46 > b.length || v.getUint32(p, true) !== 0x02014b50) return null;
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const compressedSize = v.getUint32(p + 20, true);
    const declaredSize = v.getUint32(p + 24, true);
    const nameLen = v.getUint16(p + 28, true);
    const extraLen = v.getUint16(p + 30, true);
    const commentLen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    if (compressedSize === 0xffffffff || declaredSize === 0xffffffff || local === 0xffffffff) return null;
    const name = decodeName(b.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0);
    if (local + 30 > b.length || v.getUint32(local, true) !== 0x04034b50) return null;
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    if (start + compressedSize > b.length) return null;
    out.push({ name, method, encrypted: (flags & 1) !== 0, compressedSize, declaredSize, data: b.subarray(start, start + compressedSize) });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
