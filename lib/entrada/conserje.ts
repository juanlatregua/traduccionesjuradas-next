// El conserje del hilo: contesta dudas del cliente sobre sus documentos (apostilla, validez, plazos, organismo).
// Nunca precios (regla de Juan): una pregunta de precio no llega al modelo y una respuesta con cifra se sustituye.
// Reutiliza el saneado y el control de inyección del chat (lib/chat/sanitize) y los modelos de lib/ai/models.
import { isPromptInjection, sanitizeMessage } from "../chat/sanitize.ts";
import type { EntradaLang } from "./i18n.ts";

export const CONSERJE_SYSTEM = `Eres el conserje de la entrada de traduccionesjuradas.net (HBTJ Consultores Lingüísticos, Málaga; Juan Silva Moreno, traductor-intérprete jurado de francés n.º 3850 del MAEC, con un equipo de traductores jurados de otros idiomas).
El cliente está subiendo sus documentos para pedir un presupuesto de traducción jurada y te hace una duda en mitad del proceso.

Reglas:
- Responde en el idioma del cliente, en 1 a 4 frases, con tono cercano y sin jerga.
- Asesora sobre documentos: qué hace falta traducir, apostilla de La Haya o legalización, validez de la traducción jurada en España y ante organismos, plazos habituales, firma electrónica y papel, qué páginas o reverso subir.
- NUNCA des precios, tarifas, importes ni cifras de dinero. Si preguntan por precio, di que reciben el presupuesto cerrado por email, normalmente en el día.
- No inventes normativa, plazos oficiales ni requisitos de un organismo concreto. Si no estás seguro, di que se lo confirmamos en el presupuesto.
- No prometas fechas de entrega concretas; di que el plazo se confirma en el presupuesto.
- Habla en nombre del equipo («te lo confirmamos», «lo revisamos»), nunca pidas que escriban a otra persona.
- Si la duda no tiene que ver con traducciones o documentos, di amablemente que solo puedes ayudar con eso.
- No pidas datos personales ni repitas datos de los documentos.
- Termina invitando a seguir con el paso en que estaba, en una frase corta.`;

const PRICE_ASK = /\b(precio|precios|cu[aá]nto|cuesta|cobr|coste|costo|tarifa|presupuesto aproximado|price|cost|how much|fee|prix|combien|co[uû]t|tarif|preis|kostet|kosten|pre[cç]o|quanto|custa|valor)\b/i;
const MONEY = /(\d[\d.,]*\s*(€|eur\b|euros?\b|e\b(?=\s|$))|€\s*\d|\b\d+[.,]?\d*\s*(\+\s*)?iva\b)/i;
const QUESTION_WORDS = /^(qu[eé]|c[oó]mo|cu[aá]ndo|cu[aá]l|d[oó]nde|por qu[eé]|puedo|necesito|hace falta|es necesario|sirve|vale|tengo que|hay que|what|how|when|which|where|why|can i|do i|is it|does|quoi|comment|quand|quel|o[uù]|pourquoi|est-ce|faut-il|puis-je|was|wie|wann|welche|wo|warum|muss|kann|o que|como|quando|qual|onde|porque|preciso|posso)\b/i;

/** Free text that is a question to answer, not an answer to keep. */
export function isQuestion(text: string): boolean {
  const t = text.trim();
  return t.length > 2 && (/[?¿]/.test(t) || QUESTION_WORDS.test(t));
}

export const asksPrice = (text: string) => PRICE_ASK.test(text);
export const hasMoney = (text: string) => MONEY.test(text);

export const NO_PRICE: Record<EntradaLang, string> = {
  es: "El precio te lo damos cerrado en el presupuesto que te enviamos por email, normalmente en el día. Sigamos con tus documentos.",
  fr: "Le prix, nous vous le donnons dans le devis définitif envoyé par e-mail, en général dans la journée. Continuons avec vos documents.",
  en: "You'll get the price in the final quote we email you, usually the same day. Let's carry on with your documents.",
  de: "Den Preis erhalten Sie im verbindlichen Angebot per E-Mail, meist am selben Tag. Machen wir mit Ihren Dokumenten weiter.",
  pt: "O preço vai no orçamento fechado que enviamos por e-mail, normalmente no mesmo dia. Vamos continuar com seus documentos.",
};

export const NOT_SURE: Record<EntradaLang, string> = {
  es: "Buena pregunta: te lo confirmamos en el presupuesto. Sigamos con tus documentos.",
  fr: "Bonne question : nous vous le confirmerons dans le devis. Continuons avec vos documents.",
  en: "Good question: we'll confirm it in your quote. Let's carry on with your documents.",
  de: "Gute Frage: Das bestätigen wir Ihnen im Angebot. Machen wir mit Ihren Dokumenten weiter.",
  pt: "Boa pergunta: confirmamos isso no orçamento. Vamos continuar com seus documentos.",
};

export const OFF_TOPIC: Record<EntradaLang, string> = {
  es: "Solo puedo ayudarte con tus documentos y su traducción jurada. Sigamos con tus documentos.",
  fr: "Je ne peux vous aider que pour vos documents et leur traduction assermentée. Continuons.",
  en: "I can only help with your documents and their sworn translation. Let's carry on.",
  de: "Ich kann nur bei Ihren Dokumenten und ihrer beeidigten Übersetzung helfen. Machen wir weiter.",
  pt: "Só posso ajudar com seus documentos e a tradução juramentada. Vamos continuar.",
};

export type ConserjeContext = { paso: string; documentos: string[]; origen: string | null; destinos: string[]; organismo: string | null; pais: string | null };
export type ConserjeCall = (system: string, user: string) => Promise<string | null>;
export type ConserjeAnswer = { answer: string; via: "precio" | "modelo" | "respaldo" | "inyeccion" };

export async function answerQuestion(call: ConserjeCall, lang: EntradaLang, question: string, ctx: ConserjeContext): Promise<ConserjeAnswer> {
  const q = sanitizeMessage(question);
  const l: EntradaLang = lang in NO_PRICE ? lang : "es";
  if (!q || isPromptInjection(q)) return { answer: OFF_TOPIC[l], via: "inyeccion" };
  if (asksPrice(q)) return { answer: NO_PRICE[l], via: "precio" };
  const context = [
    `Idioma del cliente: ${l}.`,
    `Paso del hilo: ${ctx.paso}.`,
    ctx.documentos.length ? `Documentos leídos: ${ctx.documentos.slice(0, 12).join("; ")}.` : "Aún no se han leído sus documentos.",
    `Idiomas: ${ctx.origen ?? "?"} → ${ctx.destinos.join(", ") || "?"}.`,
    ctx.organismo || ctx.pais ? `Lo presenta en: ${[ctx.organismo, ctx.pais].filter(Boolean).join(", ")}.` : "",
  ].filter(Boolean).join("\n");
  let out: string | null = null;
  try {
    out = await call(CONSERJE_SYSTEM, `${context}\n\nDuda del cliente:\n«${q}»`);
  } catch {
    out = null;
  }
  const answer = (out ?? "").trim();
  if (!answer) return { answer: NOT_SURE[l], via: "respaldo" };
  if (hasMoney(answer)) return { answer: NO_PRICE[l], via: "precio" };
  return { answer: answer.slice(0, 900), via: "modelo" };
}
