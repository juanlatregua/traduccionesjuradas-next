// lib/ai/extract-expense.ts — Extracción de datos de una FACTURA DE PROVEEDOR
// (factura recibida) con Claude visión, para prerellenar el alta de gasto.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-6"; // Sonnet 4 (20250514) retirado 15-jun-2026 → 404

export type ExtractedExpense = {
  supplier?: string | null;
  supplierNif?: string | null;
  supplierInvoiceNumber?: string | null;
  date?: string | null; // YYYY-MM-DD
  concept?: string | null;
  baseEur?: number | null;
  vatRate?: number | null; // fracción
  irpfRate?: number | null; // fracción
  totalEur?: number | null;
  confidence?: number;
  taxTreatment?: string | null; // sugerencia heurística: isp_intracom | isp_import
};

// Heurística post-extracción (sin IA extra): NIF-IVA de otro país UE → ISP
// intracomunitario; proveedor US conocido o mención de reverse charge sin NIF
// UE → ISP importación de servicios.
const EU_VAT_PREFIXES = new Set(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "FI", "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "XI"]);
const IMPORT_SUPPLIERS = /anthropic|vercel|openai/i;

export function suggestTaxTreatment(x: ExtractedExpense, rawText?: string): "isp_intracom" | "isp_import" | null {
  const nif = (x.supplierNif || "").replace(/[\s.-]/g, "").toUpperCase();
  const prefix = nif.slice(0, 2);
  if (EU_VAT_PREFIXES.has(prefix)) return "isp_intracom";
  if (prefix === "EU") return "isp_import"; // registro OSS no-UE (p.ej. proveedores US)
  if (IMPORT_SUPPLIERS.test(x.supplier || "")) return "isp_import";
  const hay = `${rawText || ""} ${x.concept || ""}`.toLowerCase();
  if (/reverse charge|inversi[oó]n del sujeto pasivo/.test(hay)) return "isp_import";
  return null;
}

const SYSTEM = `Eres un extractor de datos de FACTURAS RECIBIDAS (de proveedor) para la contabilidad de una empresa española (HBTJ Consultores Lingüísticos S.L.). Devuelve SOLO un objeto JSON, sin texto alrededor, con estas claves:
{
  "supplier": nombre del PROVEEDOR que emite la factura, o null,
  "supplierNif": NIF/CIF del proveedor, o null,
  "supplierInvoiceNumber": número de la factura del proveedor, o null,
  "date": fecha de la factura en formato YYYY-MM-DD, o null,
  "concept": descripción breve del gasto (una línea), o null,
  "baseEur": base imponible en euros (número con punto decimal), o null,
  "vatRate": tipo de IVA como fracción (0.21, 0.10, 0.04, o 0 si exento), o null,
  "irpfRate": retención de IRPF como fracción (0.15 o 0.07), o 0 si no hay,
  "totalEur": total de la factura en euros, o null,
  "confidence": número entre 0 y 1
}
Reglas: el PROVEEDOR es quien EMITE la factura, NO el destinatario. Si "HBTJ" / "Consultores Lingüísticos" aparece como destinatario/cliente, ignóralo (ese es el receptor, no el proveedor). No inventes: si un dato no aparece, pon null. Punto como separador decimal.`;

export async function extractExpenseFromDocument(input: { fileBase64?: string; mimeType?: string; fileName: string; text?: string }): Promise<ExtractedExpense> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");

  const client = new Anthropic({ apiKey, maxRetries: 2 });
  // Word (.docx) → se extrae el texto antes y se manda como texto (Claude visión
  // no lee .docx). PDF → bloque documento. Imagen → bloque imagen.
  let block: Anthropic.ContentBlockParam;
  if (input.text) {
    block = { type: "text", text: `FACTURA DE PROVEEDOR (texto extraído del documento Word):\n\n${input.text.slice(0, 20000)}` };
  } else if (input.mimeType === "application/pdf") {
    block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.fileBase64 as string } };
  } else {
    block = {
      type: "image",
      source: { type: "base64", media_type: input.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: input.fileBase64 as string },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: [block, { type: "text", text: `Extrae los datos de esta factura (${input.fileName}). Devuelve solo el JSON.` }],
          },
        ],
      },
      { signal: controller.signal }
    );
    const text = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("La IA no devolvió datos legibles.");
    const parsed = JSON.parse(m[0]) as ExtractedExpense;
    const suggested = suggestTaxTreatment(parsed, input.text);
    if (suggested) parsed.taxTreatment = suggested;
    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}
