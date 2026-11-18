import { PDFDocument } from "pdf-lib";
import type { ModelReading, Part } from "./schema.ts";

// Check that the same paper gives the same documents however the client packs it (one PDF or one file per page).

/** Each document as the ordered list of original pages it uses (body, then annexes, then apostille), documents sorted. */
export function partitionOf(reading: ModelReading, origin: (p: Part) => string): string[][] {
  return reading.documents
    .map((d) => [...d.parts, ...(d.annexes ?? []).flatMap((a) => a.parts), ...(d.apostille?.parts ?? [])].map(origin))
    .sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""));
}

export function samePartition(a: string[][], b: string[][]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** One single-page PDF per page of `pdf`. */
export async function splitPdf(pdf: Uint8Array): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(pdf);
  const out: Uint8Array[] = [];
  for (let i = 0; i < src.getPageCount(); i++) {
    const one = await PDFDocument.create();
    const [page] = await one.copyPages(src, [i]);
    one.addPage(page);
    out.push(await one.save());
  }
  return out;
}

/** One PDF with each JPEG/PNG as a page, in the given order. */
export async function imagesToPdf(images: { bytes: Uint8Array; png: boolean }[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const img of images) {
    const embedded = img.png ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    const page = doc.addPage([embedded.width, embedded.height]);
    page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
  }
  return doc.save();
}

/** Deterministic shuffle (so a run can be repeated). */
export function shuffled<T>(items: readonly T[], seed = 7): { item: T; from: number }[] {
  const out = items.map((item, from) => ({ item, from }));
  let x = seed;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
