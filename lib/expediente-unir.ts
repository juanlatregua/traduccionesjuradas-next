import { PDFDocument } from "pdf-lib";

export type MergeSource = { bytes: Uint8Array; pageStart: number; pageEnd: number; name: string };
export type MergeResult = { ok: true; bytes: Uint8Array; pageCount: number } | { ok: false; reasonEs: string };

const A4 = { w: 595.28, h: 841.89 };

function kindOf(b: Uint8Array): "pdf" | "jpeg" | "png" | null {
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  return null;
}

/** Joins the page ranges of PDF/JPG/PNG files into one PDF, in the given order. Anything else (HEIC, TIFF, encrypted PDF…) fails with a reason. */
export async function mergeIntoPdf(sources: readonly MergeSource[]): Promise<MergeResult> {
  if (sources.length === 0) return { ok: false, reasonEs: "no hay páginas que unir" };
  const out = await PDFDocument.create();
  const loaded = new Map<Uint8Array, PDFDocument>();
  let expected = 0;
  for (const s of sources) {
    const kind = kindOf(s.bytes);
    if (!kind) return { ok: false, reasonEs: `«${s.name}» no es PDF, JPG ni PNG` };
    if (kind === "pdf") {
      let src = loaded.get(s.bytes);
      if (!src) {
        try {
          src = await PDFDocument.load(s.bytes);
        } catch {
          return { ok: false, reasonEs: `«${s.name}» no se puede abrir (¿PDF cifrado o dañado?)` };
        }
        loaded.set(s.bytes, src);
      }
      const total = src.getPageCount();
      if (s.pageStart < 1 || s.pageEnd < s.pageStart || s.pageEnd > total) return { ok: false, reasonEs: `«${s.name}» no tiene las páginas ${s.pageStart}-${s.pageEnd}` };
      const pages = await out.copyPages(src, Array.from({ length: s.pageEnd - s.pageStart + 1 }, (_, i) => s.pageStart - 1 + i));
      pages.forEach((p) => out.addPage(p));
      expected += pages.length;
      continue;
    }
    if (s.pageStart !== 1 || s.pageEnd !== 1) return { ok: false, reasonEs: `«${s.name}» es una imagen de una sola página` };
    const image = kind === "png" ? await out.embedPng(s.bytes) : await out.embedJpg(s.bytes);
    const page = out.addPage(image.width > image.height ? [A4.h, A4.w] : [A4.w, A4.h]);
    const { width, height } = page.getSize();
    const scale = Math.min(width / image.width, height / image.height);
    page.drawImage(image, { x: (width - image.width * scale) / 2, y: (height - image.height * scale) / 2, width: image.width * scale, height: image.height * scale });
    expected += 1;
  }
  const bytes = await out.save();
  const check = await PDFDocument.load(bytes);
  if (check.getPageCount() !== expected) return { ok: false, reasonEs: `se esperaban ${expected} páginas y salieron ${check.getPageCount()}` };
  return { ok: true, bytes, pageCount: expected };
}
