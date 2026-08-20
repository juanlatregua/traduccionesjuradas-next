// Lectura del email del cliente para el GENERADOR de presupuestos: qué pide,
// par de idiomas, urgencia, entrega, si el documento adjunto es provisional
// o incompleto, notas que deben ir en el presupuesto y preguntas concretas
// que hay que hacerle. No tarifica nada: el precio sale del análisis de
// documentos; esto evita presupuestar a ciegas lo que el email ya aclara.

import Anthropic from "@anthropic-ai/sdk";

const BRIEF_MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Eres el asistente de presupuestos de TraduccionesJuradas.net (traducción jurada en España, Juan Silva Moreno, traductor jurado nº 3850 MAEC). Lees el email de un cliente (y, si existe, la lista de documentos adjuntos ya analizados) y extraes SOLO lo que el email dice o implica con claridad, para que el staff monte el presupuesto sin presupuestar a ciegas.

Reglas:
- No inventes datos. Si el email no lo dice, pon null o lista vacía.
- Idiomas en ISO 639-1 (es, en, fr, de, pt, it, ar, nl, ro, sv...). Si el cliente dice "castellano/español" es "es".
- "provisional" = true si el cliente dice que el documento adjunto no es la versión definitiva, que le faltan páginas, legalización/apostilla, firmas, o que enviará más documentos: en ese caso explica por qué en provisionalReason y redacta quoteNotes (1-2 frases en español, tono de presupuesto, p. ej. "Presupuesto calculado sobre la versión recibida del documento; si la versión definitiva incluye apostilla, legalización o páginas adicionales, se recalcula antes de confirmar.").
- questions: de 0 a 5 preguntas CONCRETAS y cortas al cliente, solo las que cambian precio, plazo o entrega (¿el documento definitivo llevará apostilla?, ¿fecha límite?, ¿PDF firmado o papel?, ¿para qué organismo?, ¿cuántos documentos en total?). Sin preguntas de cortesía.
- urgency: "urgent" solo si el cliente pide rapidez explícita ("lo antes posible", "urgente", fecha cercana); si no, "normal"; null si no se deduce.
- deliveryHint: "PAPER_SHIP" si pide papel/original/mensajería; "DIGITAL_PDF" si pide PDF/digital; null si no lo dice.
- summary: 1-2 frases en español con lo que pide el cliente.

Devuelve EXCLUSIVAMENTE un JSON válido con esta forma, sin nada más:
{"summary":"...","sourceLang":"en"|null,"targetLang":"es"|null,"urgency":"urgent"|"normal"|null,"deadline":"..."|null,"deliveryHint":"PAPER_SHIP"|"DIGITAL_PDF"|null,"provisional":true|false,"provisionalReason":"..."|null,"quoteNotes":"..."|null,"questions":["..."]}`;

export type EmailBriefDoc = {
  fileName: string;
  documentTypeEs?: string | null;
  sourceLang?: string | null;
  targetLang?: string | null;
  words?: number | null;
  pages?: number | null;
};

export type EmailBrief = {
  summary: string;
  sourceLang: string | null;
  targetLang: string | null;
  urgency: "urgent" | "normal" | null;
  deadline: string | null;
  deliveryHint: "PAPER_SHIP" | "DIGITAL_PDF" | null;
  provisional: boolean;
  provisionalReason: string | null;
  quoteNotes: string | null;
  questions: string[];
};

function str(v: unknown, max = 600): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function lang(v: unknown): string | null {
  const t = str(v, 5);
  return t && /^[a-z]{2}$/i.test(t) ? t.toLowerCase() : null;
}

export function parseEmailBrief(raw: string): EmailBrief {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La lectura del email no devolvió JSON.");
  const j = JSON.parse(cleaned.slice(start, end + 1));
  const urgency = j.urgency === "urgent" || j.urgency === "normal" ? j.urgency : null;
  const deliveryHint = j.deliveryHint === "PAPER_SHIP" || j.deliveryHint === "DIGITAL_PDF" ? j.deliveryHint : null;
  const questions = Array.isArray(j.questions)
    ? j.questions.map((q: unknown) => str(q, 300)).filter((q: string | null): q is string => !!q).slice(0, 5)
    : [];
  return {
    summary: str(j.summary, 500) || "",
    sourceLang: lang(j.sourceLang),
    targetLang: lang(j.targetLang),
    urgency,
    deadline: str(j.deadline, 120),
    deliveryHint,
    provisional: Boolean(j.provisional),
    provisionalReason: str(j.provisionalReason, 400),
    quoteNotes: str(j.quoteNotes, 600),
    questions,
  };
}

export async function generateEmailBrief(input: {
  fromName: string | null;
  fromEmail: string;
  subject: string;
  body: string;
  docs: EmailBriefDoc[];
}): Promise<EmailBrief> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurada.");
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  const from = [input.fromName, input.fromEmail].filter(Boolean).join(" ");
  const sections = [
    `EMAIL DEL CLIENTE (de ${from}):\nAsunto: ${input.subject || "(sin asunto)"}\n<<<\n${input.body.trim().slice(0, 12000)}\n>>>`,
  ];
  if (input.docs.length) {
    const lines = input.docs.map((d, i) => {
      const bits = [
        d.documentTypeEs ? `tipo: ${d.documentTypeEs}` : null,
        d.sourceLang || d.targetLang ? `par: ${d.sourceLang || "?"}→${d.targetLang || "?"}` : null,
        typeof d.words === "number" ? `${d.words} palabras` : null,
        typeof d.pages === "number" ? `${d.pages} pág.` : null,
      ].filter(Boolean);
      return `${i + 1}. ${d.fileName}${bits.length ? ` (${bits.join(", ")})` : ""}`;
    });
    sections.push(`DOCUMENTOS ADJUNTOS AL EMAIL (ya analizados):\n${lines.join("\n")}`);
  } else {
    sections.push("DOCUMENTOS ADJUNTOS AL EMAIL: ninguno.");
  }
  sections.push("TAREA: extrae el JSON descrito.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40_000);
  try {
    const resp = await client.messages.create(
      {
        model: BRIEF_MODEL,
        max_tokens: 900,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: sections.join("\n\n") }],
      },
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const block = resp.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    if (!raw.trim()) throw new Error("El modelo no devolvió texto.");
    return parseEmailBrief(raw);
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === "AbortError") throw new Error("Tiempo límite al leer el email.");
    throw err;
  }
}
