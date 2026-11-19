// Header parsers for untrusted files, as plain JS for the worker (see heavy.ts): the main thread never parses file
// content beyond magic bytes and sizes. Every loop is bounded by a fixed window, an item cap or the box size.

export const INSPECT_SOURCE = String.raw`
// Same rules as words.ts (kept in parity by a test): Word-like count, text layer trusted when dense and widespread.
const TEXT_PAGE_MIN_WORDS = 10;
function countWords(text) {
  if (!text) return 0;
  let n = 0;
  for (const token of text.split(/\s+/)) if (/[\p{L}\p{N}]/u.test(token)) n++;
  return n;
}
function isReliableTextLayer(pageWords) {
  const pages = pageWords.length;
  const total = pageWords.reduce((s, n) => s + n, 0);
  if (pages === 0 || total < 30 || total / pages < 40) return false;
  return pageWords.filter((n) => n >= TEXT_PAGE_MIN_WORDS).length / pages >= 0.5;
}
const HEIF_MAX_ITEMS = 64;
const HEIF_WINDOW = 64 * 1024;
class Bits {
  constructor(b) { this.b = b; this.pos = 0; }
  u(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = this.b[this.pos >> 3];
      if (byte === undefined) throw new RangeError("fin de datos");
      v = v * 2 + ((byte >> (7 - (this.pos & 7))) & 1);
      this.pos++;
    }
    return v;
  }
  ue() {
    let zeros = 0;
    while (this.u(1) === 0) if (++zeros > 31) throw new RangeError("ue demasiado largo");
    return 2 ** zeros - 1 + this.u(zeros);
  }
}
function hevcSpsPixels(nal) {
  const rbsp = [];
  for (let i = 2; i < nal.length; i++) {
    if (i >= 4 && nal[i] === 3 && nal[i - 1] === 0 && nal[i - 2] === 0) continue;
    rbsp.push(nal[i]);
  }
  const r = new Bits(Uint8Array.from(rbsp));
  r.u(4);
  const maxSub = r.u(3);
  r.u(1);
  r.u(96);
  const present = [];
  for (let i = 0; i < maxSub; i++) present.push([r.u(1), r.u(1)]);
  if (maxSub > 0) for (let i = maxSub; i < 8; i++) r.u(2);
  for (const [profile, level] of present) {
    if (profile) r.u(88);
    if (level) r.u(8);
  }
  r.ue();
  if (r.ue() === 3) r.u(1);
  return r.ue() * r.ue();
}
function av1SequencePixels(obus) {
  let i = 0;
  while (i < obus.length) {
    const header = obus[i];
    const type = (header >> 3) & 15;
    const ext = (header >> 2) & 1;
    const hasSize = (header >> 1) & 1;
    i += 1 + ext;
    let size = obus.length - i;
    if (hasSize) {
      size = 0;
      for (let k = 0; k < 8; k++) {
        const byte = obus[i++];
        size += (byte & 127) * 2 ** (7 * k);
        if (!(byte & 128)) break;
      }
    }
    if (type === 1) {
      const r = new Bits(obus.subarray(i, i + size));
      r.u(3);
      r.u(1);
      if (r.u(1)) r.u(5);
      else {
        if (r.u(1)) return 0;
        r.u(1);
        const points = r.u(5) + 1;
        for (let p = 0; p < points; p++) {
          r.u(12);
          if (r.u(5) > 7) r.u(1);
        }
      }
      const wb = r.u(4) + 1;
      const hb = r.u(4) + 1;
      return (r.u(wb) + 1) * (r.u(hb) + 1);
    }
    i += size;
  }
  return 0;
}
// Pixels an HEIF/AVIF will decode to: the largest of the ispe declarations and the coded size (HEVC SPS, AV1
// sequence header), a grid multiplying the tile size by the number of coded items.
function heifPixels(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const children = (from, to) => {
    const out = [];
    let p = from;
    while (p + 8 <= to) {
      let size = v.getUint32(p);
      let head = 8;
      if (size === 1) {
        if (p + 16 > to) break;
        size = Number(v.getBigUint64(p + 8));
        head = 16;
      } else if (size === 0) size = to - p;
      if (size < head || p + size > to) break;
      out.push({ type: String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]), start: p + head, end: p + size });
      p += size;
    }
    return out;
  };
  const find = (list, type) => list.find((x) => x.type === type);
  const meta = find(children(0, b.length), "meta");
  if (!meta) return 0;
  const inMeta = children(meta.start + 4, meta.end);
  let ispe = 0, coded = 0, grid = false, codedItems = 0;
  const av1 = [];
  const located = new Map();
  const uint = (p, n) => (n === 0 ? 0 : n === 2 ? v.getUint16(p) : n === 4 ? v.getUint32(p) : Number(v.getBigUint64(p)));
  try {
    const iloc = find(inMeta, "iloc");
    if (iloc) {
      const end = iloc.end;
      const version = b[iloc.start];
      const offSize = b[iloc.start + 4] >> 4, lenSize = b[iloc.start + 4] & 15, baseSize = b[iloc.start + 5] >> 4, idxSize = version >= 1 ? b[iloc.start + 5] & 15 : 0;
      const idSize = version < 2 ? 2 : 4;
      let p = iloc.start + 6;
      const count = uint(p, idSize);
      p += idSize;
      const extentSize = idxSize + offSize + lenSize;
      for (let k = 0; k < count && p < end; k++) {
        const id = uint(p, idSize);
        p += idSize;
        const method = version >= 1 ? v.getUint16(p) & 15 : 0;
        if (version >= 1) p += 2;
        p += 2;
        const base = uint(p, baseSize);
        p += baseSize;
        const extents = v.getUint16(p);
        p += 2;
        if (extents === 0 || extentSize === 0) continue;
        if (p + extents * extentSize > end) break;
        const off = uint(p + idxSize, offSize);
        const len = uint(p + idxSize + offSize, lenSize);
        if (method === 0 && len > 0) located.set(id, [base + off, len]);
        p += extents * extentSize;
      }
    }
  } catch {}
  try {
    const iinf = find(inMeta, "iinf");
    if (iinf) {
      for (const e of children(iinf.start + 4 + (b[iinf.start] === 0 ? 2 : 4), iinf.end)) {
        if (e.type !== "infe" || b[e.start] < 2 || e.end - e.start < 12) continue;
        const wide = b[e.start] !== 2;
        const id = uint(e.start + 4, wide ? 4 : 2);
        const t = e.start + 4 + (wide ? 4 : 2) + 2;
        const type = String.fromCharCode(b[t], b[t + 1], b[t + 2], b[t + 3]);
        if (type === "grid") grid = true;
        if (type !== "hvc1" && type !== "av01") continue;
        codedItems++;
        if (type === "av01" && located.has(id)) av1.push(located.get(id));
      }
    }
  } catch {}
  const iprp = find(inMeta, "iprp");
  const ipco = iprp ? find(children(iprp.start, iprp.end), "ipco") : undefined;
  for (const prop of ipco ? children(ipco.start, ipco.end) : []) {
    try {
      if (prop.type === "ispe" && prop.end - prop.start >= 12) ispe = Math.max(ispe, v.getUint32(prop.start + 4) * v.getUint32(prop.start + 8));
      else if (prop.type === "hvcC") {
        let p = prop.start + 22;
        const arrays = b[p++] ?? 0;
        for (let a = 0; a < arrays && p + 3 <= prop.end; a++) {
          const type = b[p] & 63;
          const n = v.getUint16(p + 1);
          p += 3;
          for (let k = 0; k < n && p + 2 <= prop.end; k++) {
            const len = v.getUint16(p);
            p += 2;
            if (type === 33) coded = Math.max(coded, hevcSpsPixels(b.subarray(p, Math.min(prop.end, p + len, p + HEIF_WINDOW))));
            p += len;
          }
        }
      } else if (prop.type === "av1C") coded = Math.max(coded, av1SequencePixels(b.subarray(prop.start + 4, Math.min(prop.end, prop.start + 4 + HEIF_WINDOW))));
    } catch {}
  }
  const seen = new Set();
  for (const [start, len] of av1) {
    if (seen.size >= HEIF_MAX_ITEMS) break;
    if (seen.has(start) || start >= b.length) continue;
    seen.add(start);
    try { coded = Math.max(coded, av1SequencePixels(b.subarray(start, Math.min(b.length, start + len, start + HEIF_WINDOW)))); } catch {}
  }
  return Math.max(ispe, grid ? coded * Math.max(1, codedItems) : coded);
}
// ZIP central directory without decompressing: entries carry offsets, never copies of the archive.
// null = not a readable ZIP (truncated, ZIP64, inconsistent offsets).
function listZip(b) {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const strict = new TextDecoder("utf-8", { fatal: true });
  const loose = new TextDecoder("utf-8");
  const latin1 = new TextDecoder("latin1");
  const decodeName = (bytes, utf8Flag) => {
    if (utf8Flag) return loose.decode(bytes);
    try { return strict.decode(bytes); } catch { return latin1.decode(bytes); }
  };
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = v.getUint16(eocd + 10, true);
  const cdOffset = v.getUint32(eocd + 16, true);
  if (count === 0xffff || cdOffset === 0xffffffff) return null;
  const out = [];
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
    out.push({ name, method, encrypted: (flags & 1) !== 0, compressedSize, declaredSize, start });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
`;
