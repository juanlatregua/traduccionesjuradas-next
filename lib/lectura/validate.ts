import type { PreparedBatch } from "./prepare.ts";
import type { ModelReading, Part } from "./schema.ts";

const key = (p: Part) => `${p.fileIndex}:${p.page}`;
const label = (p: Part) => `archivo ${p.fileIndex} pág. ${p.page}`;

/** Kinds of page that are clearly not part of what gets translated. */
const CLEARLY_NOT_TRANSLATABLE = new Set(["identity_doc", "payment_proof", "screenshot", "previous_translation", "blank"]);

// Each problem is a concrete sentence the model can act on in the retry.
export function validateReading(batch: Pick<PreparedBatch, "files">, reading: ModelReading): string[] {
  const errors: string[] = [];
  const pageCount = new Map(batch.files.map((f) => [f.index, f.pageCount]));
  const inRange = (p: Part) => Number.isInteger(p.fileIndex) && Number.isInteger(p.page) && p.page >= 1 && p.page <= (pageCount.get(p.fileIndex) ?? 0);
  const hasQuestion = (kind: string, documentId?: string) =>
    reading.questions.some((q) => q.kind === kind && (documentId === undefined || q.aboutDocumentId === null || q.aboutDocumentId === documentId));

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
  const documentPages = new Set<string>();
  for (const d of reading.documents) {
    if (!d.id?.trim()) errors.push("Hay un documento sin id.");
    else if (ids.has(d.id)) errors.push(`El id ${d.id} está repetido.`);
    ids.add(d.id);
    if (d.parts.length === 0) errors.push(`El documento ${d.id} no tiene páginas.`);
    assign(d.parts, `el documento ${d.id}`);
    for (const p of d.parts) documentPages.add(key(p));
    (d.annexes ?? []).forEach((a, i) => {
      if (a.parts.length === 0) errors.push(`El anexo ${i + 1} de ${d.id} no tiene páginas.`);
      assign(a.parts, `el anexo ${i + 1} de ${d.id}`);
      for (const p of a.parts) documentPages.add(key(p));
    });
    if (d.apostille) {
      assign(d.apostille.parts, `la apostilla de ${d.id}`);
      for (const p of d.apostille.parts) documentPages.add(key(p));
      if (d.apostille.parts.length === 0 && !d.apostille.onDocumentPage) {
        errors.push(`La apostilla de ${d.id} no tiene hojas propias ni está marcada como estampada en el documento.`);
      }
      const num = d.apostille.number;
      if (num !== null && (num.length > 40 || /[\r\n\u0000-\u001f]/.test(num))) errors.push(`El número de la apostilla de ${d.id} no tiene forma de número de apostilla: déjalo vacío si no se lee con claridad.`);
      if (d.apostille.parts.length > 0 && d.apostille.onDocumentPage) {
        errors.push(`La apostilla de ${d.id} tiene hojas propias y a la vez está marcada como estampada en el documento: elige una.`);
      }
    }
    if (d.type === "apostille" && !hasQuestion("apostille_owner", d.id)) {
      errors.push(`El documento ${d.id} es una apostilla suelta y no hay pregunta de tipo apostille_owner sobre a qué documento pertenece.`);
    }
    const missing = d.missingPages;
    if (missing.some((n) => !Number.isInteger(n) || n <= 0)) errors.push(`missingPages de ${d.id} trae valores que no son números de página.`);
    if (new Set(missing).size !== missing.length) errors.push(`missingPages de ${d.id} repite páginas.`);
    if (missing.length > 0 && d.declaredPages === null) errors.push(`El documento ${d.id} tiene missingPages pero no declaredPages.`);
    if (d.declaredPages !== null && missing.some((n) => n > d.declaredPages!)) errors.push(`missingPages de ${d.id} trae páginas mayores que las ${d.declaredPages} declaradas.`);
    if (d.declaredPages !== null && (!Number.isInteger(d.declaredPages) || d.declaredPages < 1)) errors.push(`declaredPages de ${d.id} no es un número de páginas.`);
    if ((missing.length > 0 || (d.declaredPages !== null && d.declaredPages > d.parts.length + (d.annexes ?? []).reduce((n, a) => n + a.parts.length, 0))) && !hasQuestion("missing_pages", d.id)) {
      errors.push(`El documento ${d.id} declara más páginas de las recibidas y no hay pregunta de tipo missing_pages.`);
    }
  }
  reading.notToTranslate.forEach((n, i) => assign(n.parts, `notToTranslate[${i}]`));
  reading.duplicates.forEach((d, i) => {
    assign(d.parts, `duplicates[${i}]`);
    if (d.parts.length === 0) errors.push(`duplicates[${i}] no tiene páginas.`);
    const { documentId, parts } = d.duplicateOf;
    if (documentId !== null && !ids.has(documentId)) errors.push(`duplicates[${i}] apunta al documento ${documentId}, que no existe.`);
    if (documentId === null && parts.length === 0) errors.push(`duplicates[${i}] no dice de qué es copia.`);
    const own = new Set(d.parts.map(key));
    for (const p of parts) {
      if (!inRange(p)) errors.push(`duplicates[${i}] dice ser copia de ${label(p)}, que no existe.`);
      else if (own.has(key(p))) errors.push(`duplicates[${i}] dice ser copia de sí mismo (${label(p)}).`);
      else if (!documentPages.has(key(p))) errors.push(`duplicates[${i}] dice ser copia de ${label(p)}, que no está en ningún documento: la página que se queda tiene que traducirse.`);
    }
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

  if (reading.documents.length === 0) {
    const doubtful = reading.notToTranslate.some((n) => !CLEARLY_NOT_TRANSLATABLE.has(n.kind)) || reading.duplicates.length > 0;
    if (doubtful) errors.push("No hay ningún documento y no todas las páginas son claramente no traducibles: si algo puede ser un documento, ponlo como documento y pregunta.");
  }

  for (const q of reading.questions) {
    if (q.aboutDocumentId !== null && !ids.has(q.aboutDocumentId)) errors.push(`Una pregunta cita el documento ${q.aboutDocumentId}, que no existe.`);
    for (const p of q.aboutParts) if (!inRange(p)) errors.push(`Una pregunta cita ${label(p)}, que no existe.`);
  }
  const target = (reading.targetLang || "").trim().toLowerCase();
  if ((target === "" || target === "unknown" || reading.targetLangBasis === "unknown") && !hasQuestion("target_lang")) {
    errors.push("El idioma de destino es desconocido y no hay ninguna pregunta de tipo target_lang.");
  }
  return errors;
}
