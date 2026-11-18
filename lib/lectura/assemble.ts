import { PDFDocument, type PDFPage } from "pdf-lib";
import type { PreparedBatch } from "./prepare.ts";
import type { Part, ReadDocumentRaw } from "./schema.ts";

const A4 = { w: 595.28, h: 841.89 };

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
}

export function documentFileName(document: Pick<ReadDocumentRaw, "id" | "holder" | "typeLabelEs">, position?: number): string {
  const n = position ?? (Number(document.id.replace(/\D+/g, "")) || 1);
  const nn = String(n).padStart(2, "0");
  const type = safeName(document.typeLabelEs) || "Documento";
  const holder = document.holder ? safeName(document.holder) : "";
  return `${nn}_${holder ? `${holder} - ` : ""}${type}.pdf`;
}

/** One PDF per document: its pages in reading order, then the apostille sheets. */
export async function assembleDocumentPdf(
  batch: Pick<PreparedBatch, "files">,
  document: Pick<ReadDocumentRaw, "id" | "holder" | "typeLabelEs" | "parts" | "apostille">,
  position?: number,
): Promise<{ fileName: string; bytes: Uint8Array; pageCount: number }> {
  const out = await PDFDocument.create();
  const sources = new Map<number, PDFDocument>();
  const parts: Part[] = [...document.parts, ...(document.apostille?.parts ?? [])];
  for (const part of parts) {
    const file = batch.files.find((f) => f.index === part.fileIndex);
    if (!file || part.page < 1 || part.page > file.pageCount) throw new Error(`Página inexistente: archivo ${part.fileIndex} pág. ${part.page}`);
    if (file.kind === "pdf") {
      let src = sources.get(file.index);
      if (!src) {
        src = await PDFDocument.load(file.bytes, { ignoreEncryption: true, updateMetadata: false });
        sources.set(file.index, src);
      }
      const [page] = await out.copyPages(src, [part.page - 1]);
      out.addPage(page);
      continue;
    }
    const image = file.mediaType === "image/png" ? await out.embedPng(file.bytes) : await out.embedJpg(file.bytes);
    const landscape = image.width > image.height;
    const page: PDFPage = out.addPage(landscape ? [A4.h, A4.w] : [A4.w, A4.h]);
    const { width, height } = page.getSize();
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    page.drawImage(image, { x: (width - w) / 2, y: (height - h) / 2, width: w, height: h });
  }
  const bytes = await out.save();
  return { fileName: documentFileName(document, position), bytes, pageCount: out.getPageCount() };
}
