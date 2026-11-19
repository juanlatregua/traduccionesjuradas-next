import { DEFAULT_HEAVY, HeavyBusy, HeavyWorker, WorkerDied, WorkerTimeout } from "./heavy.ts";
import type { PreparedBatch } from "./prepare.ts";
import type { Part, ReadDocumentRaw } from "./schema.ts";
import { documentLabel } from "./label.ts";

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
  | { ok: false; kind: "cannot_assemble"; reasonEs: string }
  | { ok: false; kind: "busy"; retryable: true; reasonEs: string };

type AssemblyDocument = Pick<ReadDocumentRaw, "id" | "holder" | "typeLabelEs" | "parts" | "apostille"> & { annexes?: ReadDocumentRaw["annexes"] };

export const ASSEMBLY_TIMEOUT_MS = 60_000;

/**
 * One PDF per document (position = place in `documents`, 1-based): body pages in reading order, then the annexes,
 * then the apostille sheets. The whole batch is assembled in one worker task (each source PDF loaded once), under the
 * same memory and time bounds as the preparation. Never returns a PDF with missing or blank pages: it fails with a
 * typed reason instead.
 */
export async function assembleDocumentPdfs(
  batch: Pick<PreparedBatch, "files">,
  documents: readonly AssemblyDocument[],
  heavy?: HeavyWorker,
): Promise<AssembledPdf[]> {
  const fail = (reasonEs: string): AssembledPdf => ({ ok: false, kind: "cannot_assemble", reasonEs });
  const results: (AssembledPdf | null)[] = [];
  const jobs: Part[][] = [];
  const needed = new Set<number>();
  for (const document of documents) {
    const parts: Part[] = [...document.parts, ...(document.annexes ?? []).flatMap((a) => a.parts), ...(document.apostille?.parts ?? [])];
    let reason: string | null = parts.length === 0 ? "el documento no tiene páginas" : null;
    for (const part of parts) {
      if (reason) break;
      const file = batch.files.find((f) => f.index === part.fileIndex);
      if (!file || !Number.isInteger(part.page) || part.page < 1 || part.page > file.pageCount) reason = `página inexistente: archivo ${part.fileIndex} pág. ${part.page}`;
      // Copying pages of an encrypted PDF carries its still-encrypted streams: the result would look blank.
      else if (file.kind === "pdf" && file.encrypted) reason = `el archivo ${file.index} es un PDF cifrado: sus páginas no se pueden copiar sin descifrarlo (hay que entregar el original o reimprimirlo)`;
    }
    if (reason) {
      results.push(fail(reason));
      continue;
    }
    for (const p of parts) needed.add(p.fileIndex);
    results.push(null);
    jobs.push(parts);
  }
  if (jobs.length > 0) {
    const files = batch.files
      .filter((f) => needed.has(f.index))
      .map((f) => ({ index: f.index, kind: f.kind, mediaType: f.mediaType, pageCount: f.pageCount, bytes: f.bytes }));
    const worker = heavy ?? new HeavyWorker(DEFAULT_HEAVY);
    let out: { ok: boolean; bytes?: Uint8Array; pageCount?: number; reasonEs?: string }[];
    try {
      out = (await worker.run<{ results: typeof out }>("assemble", { files, documents: jobs }, ASSEMBLY_TIMEOUT_MS)).results;
    } catch (err) {
      if (err instanceof HeavyBusy) {
        if (!heavy) await worker.close();
        const busy: AssembledPdf = { ok: false, kind: "busy", retryable: true, reasonEs: "El servidor está ocupado: el montaje se puede reintentar en un minuto." };
        return results.map((r) => r ?? busy);
      }
      const why = err instanceof WorkerTimeout ? "el montaje ha tardado demasiado" : err instanceof WorkerDied ? "el montaje se ha quedado sin memoria" : "el montaje ha fallado";
      out = jobs.map(() => ({ ok: false, reasonEs: why }));
    } finally {
      if (!heavy) await worker.close();
    }
    let k = 0;
    for (let i = 0; i < results.length; i++) {
      if (results[i]) continue;
      const r = out[k++];
      results[i] = r?.ok && r.bytes ? { ok: true, fileName: documentFileName(documents[i], i + 1), bytes: r.bytes, pageCount: r.pageCount ?? 0 } : fail(r?.reasonEs ?? "el montaje ha fallado");
    }
  }
  return results as AssembledPdf[];
}
