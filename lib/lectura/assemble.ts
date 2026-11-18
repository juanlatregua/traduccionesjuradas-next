import { PDFArray, PDFDocument, PDFRawStream, PDFRef, type PDFPage } from "pdf-lib";
import type { PreparedBatch } from "./prepare.ts";
import type { Part, ReadDocumentRaw } from "./schema.ts";
import { documentLabel } from "./label.ts";

const A4 = { w: 595.28, h: 841.89 };

/** File systems reject these; the label is already one clean line of bounded length. */
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * «NN_<documentLabel>.pdf». NN is the document's position in the reading (1-based), so names are unique and
 * stable within a batch even when two labels are identical.
 */
export function documentFileName(document: Pick<ReadDocumentRaw, "holder" | "typeLabelEs" | "apostille">, position: number): string {
  if (!Number.isInteger(position) || position < 1) throw new RangeError("posición de documento inválida");
  return `${String(position).padStart(2, "0")}_${safeName(documentLabel(document)) || "Documento"}.pdf`;
}

export function documentFileNames(documents: readonly Pick<ReadDocumentRaw, "holder" | "typeLabelEs" | "apostille">[]): string[] {
  return documents.map((d, i) => documentFileName(d, i + 1));
}

export type AssembledPdf =
  | { ok: true; fileName: string; bytes: Uint8Array; pageCount: number }
  | { ok: false; kind: "cannot_assemble"; reasonEs: string };

/** Bytes of a page's content streams (0 = the page draws nothing). */
function contentLength(page: PDFPage): number {
  const contents = page.node.Contents();
  if (!contents) return 0;
  const ctx = page.doc.context;
  const items = contents instanceof PDFArray ? contents.asArray() : [contents];
  let total = 0;
  for (const item of items) {
    const stream = item instanceof PDFRef ? ctx.lookup(item) : item;
    if (stream instanceof PDFRawStream) total += stream.contents.length;
    else if (stream && "getContentsSize" in (stream as object)) total += (stream as unknown as { getContentsSize(): number }).getContentsSize();
  }
  return total;
}

/**
 * One PDF per document: body pages in reading order, then the annexes in order, then the apostille sheets.
 * Never returns a PDF with missing or blank pages: it fails with a typed reason instead.
 */
export async function assembleDocumentPdf(
  batch: Pick<PreparedBatch, "files">,
  document: Pick<ReadDocumentRaw, "id" | "holder" | "typeLabelEs" | "parts" | "apostille"> & { annexes?: ReadDocumentRaw["annexes"] },
  position: number,
): Promise<AssembledPdf> {
  const fail = (reasonEs: string): AssembledPdf => ({ ok: false, kind: "cannot_assemble", reasonEs });
  const parts: Part[] = [...document.parts, ...(document.annexes ?? []).flatMap((a) => a.parts), ...(document.apostille?.parts ?? [])];
  if (parts.length === 0) return fail("el documento no tiene páginas");
  const out = await PDFDocument.create();
  const sources = new Map<number, PDFDocument>();
  const expectContent: boolean[] = [];
  for (const part of parts) {
    const file = batch.files.find((f) => f.index === part.fileIndex);
    if (!file || part.page < 1 || part.page > file.pageCount) return fail(`página inexistente: archivo ${part.fileIndex} pág. ${part.page}`);
    if (file.kind === "pdf") {
      // Copying pages of an encrypted PDF carries its still-encrypted streams: the result would look blank.
      // Without a decrypting renderer on the server, refuse instead of handing over empty sheets.
      if (file.encrypted) return fail(`el archivo ${file.index} es un PDF cifrado: sus páginas no se pueden copiar sin descifrarlo (hay que entregar el original o reimprimirlo)`);
      let src = sources.get(file.index);
      if (!src) {
        try {
          src = await PDFDocument.load(file.bytes, { updateMetadata: false });
        } catch {
          return fail(`el archivo ${file.index} no se puede abrir para montar el documento`);
        }
        sources.set(file.index, src);
      }
      const srcPage = src.getPage(part.page - 1);
      const [page] = await out.copyPages(src, [part.page - 1]);
      out.addPage(page);
      expectContent.push(contentLength(srcPage) > 0);
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
    expectContent.push(true);
  }
  const bytes = await out.save();
  const check = await PDFDocument.load(bytes);
  if (check.getPageCount() !== parts.length) return fail(`se esperaban ${parts.length} páginas y salieron ${check.getPageCount()}`);
  const blank = check.getPages().findIndex((p, i) => expectContent[i] && contentLength(p) === 0);
  if (blank >= 0) return fail(`la página ${blank + 1} del montaje ha salido vacía y su original no lo estaba`);
  return { ok: true, fileName: documentFileName(document, position), bytes, pageCount: parts.length };
}
