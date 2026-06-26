// lib/ai/suggest-name.ts — Sugerencia BARATA del tipo/nombre de un documento.
//
// Para filas que el staff suelta SIN análisis (precio fijo) o cuyo análisis
// falló (p. ej. imágenes de WhatsApp): una llamada mínima que devuelve SOLO el
// tipo en español, SIN contar palabras ni segmentar. Mucho más barata que
// runDocumentSegmentation:
//  - PDF con capa de texto → Haiku sobre el texto (sin imagen).
//  - Imagen → Haiku con visión (1 imagen).
//  - PDF escaneado sin texto → Sonnet sobre la PRIMERA página (coste acotado).

import Anthropic from "@anthropic-ai/sdk";
import { TEXT_MODEL_ID, VISION_MODEL } from "./analyze-document";
import { extractPdfText } from "./extract-text";

const NAME_SYSTEM = `Eres un clasificador de documentos para una agencia de traduccion jurada.
Devuelve SOLO el tipo de documento en espanol, en 2 a 6 palabras, sin articulos ni nombres propios
(ejemplos: "Acta de nacimiento", "Certificado de antecedentes penales", "Nomina", "Apostilla de La Haya",
"Certificado bancario", "Diploma universitario", "Contrato de trabajo").
No expliques nada, no uses comillas ni punto final. Si no puedes clasificarlo, responde "Documento".`;

function imageMediaType(
  mimeType: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  const m: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
    "image/heic": "image/jpeg",
  };
  return m[mimeType] || "image/jpeg";
}

// Recorta un PDF a su primera página para acotar el coste de la visión.
async function firstPageOnly(buffer: Buffer): Promise<Buffer> {
  try {
    const { PDFDocument } = require("pdf-lib");
    const src = await PDFDocument.load(buffer, { ignoreEncryption: true });
    if (src.getPageCount() <= 1) return buffer;
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [0]);
    out.addPage(page);
    return Buffer.from(await out.save());
  } catch {
    return buffer;
  }
}

export async function suggestDocumentName(input: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  const content: Anthropic.ContentBlockParam[] = [];
  let model = TEXT_MODEL_ID; // Haiku por defecto (texto e imagen).

  if (input.mimeType === "application/pdf") {
    let text = "";
    try {
      const ex = await extractPdfText(input.buffer);
      if (ex.hasTextLayer) text = ex.text;
    } catch {
      /* sin capa de texto → visión abajo */
    }
    if (text.trim()) {
      content.push({
        type: "text",
        text: `Clasifica este documento (archivo: ${input.fileName}).\n\nTEXTO:\n${text.slice(0, 4000)}`,
      });
    } else {
      // PDF escaneado: primera página + Sonnet (Haiku no garantiza PDF nativo).
      model = VISION_MODEL;
      const firstPage = await firstPageOnly(input.buffer);
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: firstPage.toString("base64") },
      });
      content.push({ type: "text", text: `Clasifica este documento (archivo: ${input.fileName}).` });
    }
  } else {
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: imageMediaType(input.mimeType),
        data: input.buffer.toString("base64"),
      },
    });
    content.push({ type: "text", text: `Clasifica este documento (archivo: ${input.fileName}).` });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await client.messages.create(
      {
        model,
        max_tokens: 40,
        system: [{ type: "text", text: NAME_SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content }],
      },
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const block = resp.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text.trim() : "";
    const name = raw
      .replace(/^["'\s]+/, "")
      .replace(/["'.\s]+$/, "")
      .slice(0, 80);
    return name || "Documento";
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") throw new Error("Tiempo límite al sugerir el nombre.");
    throw err;
  }
}
