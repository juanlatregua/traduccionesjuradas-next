import type { PreparedBatch } from "./prepare.ts";
import type { ModelReading, Part } from "./schema.ts";

const key = (p: Part) => `${p.fileIndex}:${p.page}`;
const label = (p: Part) => `archivo ${p.fileIndex} pág. ${p.page}`;

// Each problem is a concrete sentence the model can act on in the retry.
export function validateReading(batch: Pick<PreparedBatch, "files">, reading: ModelReading): string[] {
  const errors: string[] = [];
  const pageCount = new Map(batch.files.map((f) => [f.index, f.pageCount]));
  const inRange = (p: Part) => Number.isInteger(p.fileIndex) && Number.isInteger(p.page) && p.page >= 1 && p.page <= (pageCount.get(p.fileIndex) ?? 0);

  const uses = new Map<string, string[]>();
  const assign = (parts: Part[], where: string) => {
    for (const p of parts) {
      if (!inRange(p)) {
        errors.push(`${where} cita ${label(p)}, que no existe.`);
        continue;
      }
      const list = uses.get(key(p)) ?? [];
      list.push(where);
      uses.set(key(p), list);
    }
  };

  const ids = new Set<string>();
  for (const d of reading.documents) {
    if (!d.id?.trim()) errors.push("Hay un documento sin id.");
    else if (ids.has(d.id)) errors.push(`El id ${d.id} está repetido.`);
    ids.add(d.id);
    if (d.parts.length === 0) errors.push(`El documento ${d.id} no tiene páginas.`);
    assign(d.parts, `el documento ${d.id}`);
    if (d.apostille) assign(d.apostille.parts, `la apostilla de ${d.id}`);
    if (d.apostille && d.apostille.parts.length === 0 && !d.apostille.onDocumentPage) {
      errors.push(`La apostilla de ${d.id} no tiene hojas propias ni está marcada como estampada en el documento.`);
    }
    if (d.missingPages.length > 0 && !reading.questions.some((q) => q.kind === "missing_pages")) {
      errors.push(`El documento ${d.id} tiene páginas que faltan y no hay ninguna pregunta de tipo missing_pages.`);
    }
  }
  reading.notToTranslate.forEach((n, i) => assign(n.parts, `notToTranslate[${i}]`));
  reading.duplicates.forEach((d, i) => {
    assign(d.parts, `duplicates[${i}]`);
    if (d.parts.length === 0) errors.push(`duplicates[${i}] no tiene páginas.`);
    if (d.duplicateOf.documentId !== null && !ids.has(d.duplicateOf.documentId)) {
      errors.push(`duplicates[${i}] apunta al documento ${d.duplicateOf.documentId}, que no existe.`);
    }
    if (d.duplicateOf.documentId === null && d.duplicateOf.parts.length === 0) errors.push(`duplicates[${i}] no dice de qué es copia.`);
    for (const p of d.duplicateOf.parts) if (!inRange(p)) errors.push(`duplicates[${i}] dice ser copia de ${label(p)}, que no existe.`);
  });
  if (reading.instructions) assign(reading.instructions.parts, "instructions");

  for (const f of batch.files) {
    for (let page = 1; page <= f.pageCount; page++) {
      const where = uses.get(`${f.index}:${page}`);
      if (!where) errors.push(`${label({ fileIndex: f.index, page })} no está asignada a nada.`);
      else if (where.length > 1) {
        const apostilles = where.filter((w) => w.startsWith("la apostilla"));
        const what = apostilles.length > 1 ? "una apostilla compartida" : "asignada varias veces";
        errors.push(`${label({ fileIndex: f.index, page })} está ${what}: ${where.join(", ")}.`);
      }
    }
  }

  for (const q of reading.questions) {
    if (q.aboutDocumentId !== null && !ids.has(q.aboutDocumentId)) errors.push(`Una pregunta cita el documento ${q.aboutDocumentId}, que no existe.`);
    for (const p of q.aboutParts) if (!inRange(p)) errors.push(`Una pregunta cita ${label(p)}, que no existe.`);
  }
  const target = (reading.targetLang || "").trim().toLowerCase();
  if (reading.documents.length > 0 && (target === "" || target === "unknown" || reading.targetLangBasis === "unknown") && !reading.questions.some((q) => q.kind === "target_lang")) {
    errors.push("El idioma de destino es desconocido y no hay ninguna pregunta de tipo target_lang.");
  }
  return errors;
}
