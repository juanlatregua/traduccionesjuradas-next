// lib/ai/extract-payment-proof.ts — ¿Este adjunto es un JUSTIFICANTE DE PAGO?
//
// El cliente manda el comprobante de su transferencia por email y ese carril no
// estaba automatizado: el correo se quedaba en la bandeja hasta que alguien lo
// abría (caso Ikbel Dridi, 19-sep-2026). Esto lee el adjunto y responde dos
// cosas: si es un justificante y, si lo es, cuánto y de quién.
//
// Haiku a propósito: es una lectura corta y estructurada de un documento de una
// página, no un dictamen. El modelo caro se reserva para lo que decide dinero.
//
// Lo que NO hace: decidir que el pedido está cobrado. Un justificante es una
// afirmación del cliente. Aquí solo se extrae y se propone el cruce; el cobro
// lo sella una persona contra el banco.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5-20251001";

export type PaymentProofRead = {
  esJustificante: boolean;
  confianza: number; // 0..1
  importeCents: number | null;
  moneda: string | null; // EUR, USD…
  ordenante: string | null; // quien paga
  beneficiario: string | null; // a quién se paga
  cuentaDestinoUltimos4: string | null;
  fecha: string | null; // YYYY-MM-DD
  concepto: string | null;
  motivo: string; // por qué sí o por qué no, en una frase
};

const SYSTEM = `Eres un asistente contable de una empresa española de traducción jurada (HBTJ Consultores Lingüísticos S.L.).

Te dan UN documento adjunto de un correo de cliente. Decide si es un JUSTIFICANTE DE PAGO a favor de la empresa: resguardo de transferencia bancaria, captura de Bizum, comprobante de pago con tarjeta o recibo de pasarela.

NO son justificantes de pago: facturas que nos emiten a nosotros, presupuestos, documentos para traducir (certificados, títulos, actas, pasaportes, antecedentes penales), contratos o cualquier documento que el cliente manda PARA QUE SE TRADUZCA. Ante la duda, esJustificante = false.

Devuelve SOLO un JSON con esta forma exacta, sin texto alrededor:
{
  "esJustificante": boolean,
  "confianza": number,
  "importeCents": number | null,
  "moneda": string | null,
  "ordenante": string | null,
  "beneficiario": string | null,
  "cuentaDestinoUltimos4": string | null,
  "fecha": "YYYY-MM-DD" | null,
  "concepto": string | null,
  "motivo": string
}

Reglas:
- importeCents en CÉNTIMOS enteros del importe pagado (66,55 EUR -> 6655). Si no lo ves con seguridad, null.
- cuentaDestinoUltimos4: los cuatro últimos dígitos de la cuenta de DESTINO si aparecen; si no, null.
- confianza entre 0 y 1: cuán seguro estás de la lectura del importe y del tipo de documento.
- motivo: una frase corta en español.`;

export async function extractPaymentProof(input: {
  fileBase64?: string;
  mimeType?: string;
  fileName: string;
  text?: string;
  emailSubject?: string;
}): Promise<PaymentProofRead> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  let block: Anthropic.ContentBlockParam;
  if (input.text) {
    block = { type: "text", text: `Documento adjunto (texto extraído):\n\n${input.text.slice(0, 12000)}` };
  } else if (input.mimeType === "application/pdf") {
    block = { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.fileBase64 as string } };
  } else {
    block = {
      type: "image",
      source: {
        type: "base64",
        media_type: input.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data: input.fileBase64 as string,
      },
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 700,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: [
              block,
              {
                type: "text",
                text: `Adjunto "${input.fileName}"${input.emailSubject ? ` de un correo con asunto "${input.emailSubject}"` : ""}. ¿Es un justificante de pago a nuestro favor? Devuelve solo el JSON.`,
              },
            ],
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
    const parsed = JSON.parse(m[0]) as PaymentProofRead;
    return {
      esJustificante: Boolean(parsed.esJustificante),
      confianza: Number(parsed.confianza) || 0,
      importeCents: Number.isFinite(Number(parsed.importeCents)) ? Math.round(Number(parsed.importeCents)) : null,
      moneda: parsed.moneda || null,
      ordenante: parsed.ordenante || null,
      beneficiario: parsed.beneficiario || null,
      cuentaDestinoUltimos4: parsed.cuentaDestinoUltimos4 || null,
      fecha: parsed.fecha || null,
      concepto: parsed.concepto || null,
      motivo: String(parsed.motivo || ""),
    };
  } finally {
    clearTimeout(timeout);
  }
}
