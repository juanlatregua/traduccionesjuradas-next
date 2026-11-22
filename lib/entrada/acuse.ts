// Acuse de la respuesta a una pregunta de la lectura (lógica PURA, sin IA): el conserje dice al momento qué pasa con
// lo que el cliente ha contestado y, si no contesta a lo que se le pidió, repregunta solo eso.
import type { EntradaLang } from "./i18n.ts";

export type Acuse = {
  /** Qué hacemos con su respuesta. */
  texto: string;
  /** La pregunta pedía un documento y la respuesta no dice si lo tiene: se repregunta solo eso. */
  repregunta: string | null;
};

// The answer asks to bundle everything into one sworn translation (one signature).
const AGRUPAR = new RegExp(
  [
    "un[ao]? (?:sol[ao]|únic[ao]) (?:traducci[oó]n|firma|documento|certificaci[oó]n)", "todo (?:junto|en un[ao]?)", "(?:la )?misma traducci[oó]n", "junt(?:o|a|os|as) en un[ao]",
    "une seule (?:traduction|signature)", "un seul (?:document|certificat)", "tout ensemble", "(?:la )?même traduction", "tout dans une",
    "(?:one|a) single (?:translation|signature|document)", "(?:in|into) one (?:translation|document)", "all together", "one signature",
    "eine(?:r)? (?:einzige(?:n)? )?(?:übersetzung|unterschrift)", "alles zusammen", "alles in eine",
    "uma (?:só|única) (?:tradução|assinatura)", "(?:numa|em uma) só", "tudo junto",
  ].join("|"),
  "i",
);

// The answer says whether they have it / will send it / do not have it.
const CONTESTA = new RegExp(
  [
    "^\\s*(?:s[ií]|no|vale|claro|ok|okay|oui|non|yes|ja|nein|sim|não|nao)(?=$|[\\s,.!;:])",
    "\\b(?:lo|la|los|las|le|te|os|se)\\s+(?:tengo|añado|adjunto|env[ií]o|subo|mando|aporto|consigo|pido|tendr[eé])\\b", "\\bno (?:lo |la |los |las )?(?:tengo|dispongo|existe|hay|puedo)\\b", "\\b(?:tengo|adjunto|añado|subo|env[ií]o)\\b",
    "\\bj'ai\\b", "\\bje (?:l'|les )?(?:ai|envoie|ajoute|joins)\\b", "\\bje ne l'ai pas\\b", "\\bpas (?:de|le|la)\\b",
    "\\bi (?:have|don't have|do not have|will send|'ll send|can send|can't|cannot)\\b", "\\battached\\b", "\\bi don't\\b",
    "\\b(?:habe|hab|schicke|sende|lade)\\b", "\\bnicht\\b",
    "\\b(?:tenho|envio|anexo|mando)\\b", "\\bnão tenho\\b",
  ].join("|"),
  "i",
);

// «¿puede enviar el boletín del semestre 5?» → «el boletín del semestre 5».
const PIDE = /(?:puede|podr[ií]a|puedes|podr[ií]as|pueden)\s+(?:usted\s+)?(?:enviar|mandar|subir|aportar|adjuntar|añadir|facilitar|enviarnos|mandarnos|subirnos|aportarnos)\s+(.{3,120}?)\s*\?/i;
const TIENE = /¿\s*(?:tiene|tienes|dispone de|dispones de)\s+(.{3,120}?)\s*\?/i;

/** What the question asks the client to send, or null if it does not ask for a document. */
export function loQuePide(pregunta: string): string | null {
  const m = pregunta.match(PIDE) ?? pregunta.match(TIENE);
  return m ? m[1].trim() : null;
}

const sinEl = (objeto: string) => {
  const a = objeto.toLowerCase().split(/\s+/)[0];
  return a === "la" || a === "una" ? "ella" : a === "los" || a === "unos" ? "ellos" : a === "las" || a === "unas" ? "ellas" : "él";
};

const T: Record<EntradaLang, { anotado: string; agrupar: string; falta: string; repregunta: (o: string | null) => string; lo: string; noLo: string }> = {
  es: {
    anotado: "Anotado. Juan lo tiene en cuenta al preparar tu presupuesto.",
    agrupar: "Anotado: lo prepararemos como una sola traducción jurada; Juan lo confirma en el presupuesto.",
    falta: "Solo me falta saber una cosa:",
    repregunta: (o) => (o ? `¿Y ${o}: lo tienes o seguimos sin ${sinEl(o)}?` : "¿Y lo que te pedíamos: lo tienes o seguimos sin ello?"),
    lo: "Lo añado", noLo: "No lo tengo",
  },
  fr: {
    anotado: "C'est noté. Juan en tient compte en préparant votre devis.",
    agrupar: "C'est noté : nous le préparerons en une seule traduction assermentée ; Juan vous le confirme dans le devis.",
    falta: "Il me manque juste une chose :",
    repregunta: (o) => (o ? `Et « ${o} » : vous l'avez, ou nous continuons sans ?` : "Et ce que nous vous demandions : vous l'avez, ou nous continuons sans ?"),
    lo: "Je l'ajoute", noLo: "Je ne l'ai pas",
  },
  en: {
    anotado: "Noted. Juan takes it into account when preparing your quote.",
    agrupar: "Noted: we will prepare it as a single sworn translation; Juan confirms it in the quote.",
    falta: "I just need to know one thing:",
    repregunta: (o) => (o ? `And “${o}”: do you have it, or shall we go on without it?` : "And what we asked for: do you have it, or shall we go on without it?"),
    lo: "I'll add it", noLo: "I don't have it",
  },
  de: {
    anotado: "Notiert. Juan berücksichtigt es bei Ihrem Kostenvoranschlag.",
    agrupar: "Notiert: Wir erstellen es als eine einzige beeidigte Übersetzung; Juan bestätigt es im Kostenvoranschlag.",
    falta: "Mir fehlt nur noch eine Sache:",
    repregunta: (o) => (o ? `Und „${o}“: Haben Sie es, oder machen wir ohne weiter?` : "Und das, worum wir gebeten haben: Haben Sie es, oder machen wir ohne weiter?"),
    lo: "Ich füge es hinzu", noLo: "Ich habe es nicht",
  },
  pt: {
    anotado: "Anotado. O Juan tem isso em conta ao preparar o seu orçamento.",
    agrupar: "Anotado: vamos prepará-lo como uma só tradução juramentada; o Juan confirma no orçamento.",
    falta: "Só me falta saber uma coisa:",
    repregunta: (o) => (o ? `E «${o}»: você tem, ou seguimos sem?` : "E o que pedimos: você tem, ou seguimos sem?"),
    lo: "Vou adicionar", noLo: "Não tenho",
  },
};

export const ACUSE_BOTONES = (lang: EntradaLang) => ({ lo: (T[lang] ?? T.es).lo, noLo: (T[lang] ?? T.es).noLo });

/** The client's follow-up («Lo añado» / «No lo tengo») joined to the answer, so Juan reads both together. */
export function conSeguimiento(lang: EntradaLang, pregunta: string, respuesta: string, tiene: boolean): string {
  const t = T[lang] ?? T.es;
  const o = loQuePide(pregunta);
  return `${respuesta.trim()} · ${o ? `${o}: ` : ""}${(tiene ? t.lo : t.noLo).toLowerCase()}`;
}

export function acuseRespuesta(lang: EntradaLang, pregunta: string, respuesta: string, opts: { idioma?: boolean } = {}): Acuse {
  const t = T[lang] ?? T.es;
  const r = respuesta.trim();
  const texto = AGRUPAR.test(r) ? t.agrupar : t.anotado;
  if (opts.idioma) return { texto: t.anotado, repregunta: null };
  const pide = loQuePide(pregunta);
  const contesta = CONTESTA.test(r) || r.toLowerCase().includes(t.lo.toLowerCase()) || r.toLowerCase().includes(t.noLo.toLowerCase());
  if (pide !== null && !contesta) return { texto: `${texto} ${t.falta}`, repregunta: t.repregunta(lang === "es" ? pide : null) };
  return { texto, repregunta: null };
}
