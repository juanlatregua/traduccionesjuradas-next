// Idioma sugerido para el presupuesto del cliente (PDF + página de pago). PURO: sin
// Prisma ni IA. Prioridad: texto del cliente > locale de la página > prefijo > TLD.
import type { QuotePdfLang } from "@/lib/quote-pdf-langs";

export type ClientLangSuggestion = { lang: QuotePdfLang; reason: string };
type TextLang = QuotePdfLang | "nl";

const WORDS: Record<TextLang, string> = {
  es: "el la los las del que por para con una unos unas hola gracias buenos buenas dias tardes necesito quiero querria traduccion traducir documento documentos presupuesto precio cuanto cuesta tengo esta estoy son como tambien pero muy favor saludos",
  en: "the and for with you your please need needs would like translation translate hello hi thanks thank have has can could is are this that my our of to from how much price quote document documents regards dear want",
  fr: "le les des pour avec une vous je besoin bonjour bonsoir merci traduction traduire est sont dans votre nous cordialement documents devis prix combien voudrais souhaite pouvez mon ma mes sur ce cette",
  it: "il gli per con che sono vorrei ho bisogno ciao buongiorno buonasera grazie traduzione tradurre documento documenti preventivo prezzo quanto costa della dei delle salve cordiali mio mia nel una",
  pt: "os as para com uma que preciso obrigado obrigada ola bom dia boa tarde traducao traduzir documento documentos orcamento preco quanto custa nao voce voces gostaria meu minha pelo pela cumprimentos",
  de: "der die das und fur mit ich bitte danke hallo guten tag brauche ubersetzung ubersetzen beglaubigte dokument dokumente angebot preis wie viel kostet ist nicht ein eine meine mein wir sie mochte gruss grusse",
  nl: "het een ik voor met alstublieft dank dankjewel hallo goedendag vertaling vertalen nodig graag niet mijn wij uw documenten offerte prijs hoeveel kost groeten",
};
const SETS = Object.fromEntries(
  (Object.keys(WORDS) as TextLang[]).map((l) => [l, new Set(WORDS[l].split(" "))])
) as Record<TextLang, Set<string>>;

const TEXT_LANG_ES: Record<TextLang, string> = {
  es: "español", en: "inglés", fr: "francés", it: "italiano", pt: "portugués", de: "alemán", nl: "neerlandés",
};

function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function detectTextLang(text: string): TextLang | null {
  const tokens = fold(text).match(/[a-z]+/g) || [];
  if (tokens.length < 3) return null;
  const score: Record<string, number> = {};
  for (const t of tokens) {
    for (const l of Object.keys(SETS) as TextLang[]) if (SETS[l].has(t)) score[l] = (score[l] || 0) + 1;
  }
  const ranked = Object.entries(score).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  const [best, bestN] = ranked[0];
  const second = ranked[1]?.[1] || 0;
  if (bestN < 2 || bestN < second * 1.5) return null;
  return best as TextLang;
}

// No hay PDF en neerlandés ni escandinavo: se manda en inglés.
function toPdfLang(l: TextLang): QuotePdfLang {
  return l === "nl" ? "en" : l;
}

const PHONE_PREFIX: Record<string, QuotePdfLang | null> = {
  "34": "es",
  "33": "fr", "212": "fr", "213": "fr", "216": "fr", "221": "fr", "225": "fr",
  "32": null, "41": null, // ambiguos (BE nl/fr, CH de/fr/it): no deciden
  "44": "en", "1": "en", "353": "en", "31": "en", "46": "en", "47": "en", "45": "en",
  "55": "pt", "351": "pt", "244": "pt",
  "39": "it",
  "49": "de", "43": "de",
};

function langFromPhone(phone: string): { lang: QuotePdfLang; reason: string } | null {
  const raw = phone.trim();
  let digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const hasPlus = raw.startsWith("+");
  if (!hasPlus && digits.startsWith("00")) digits = digits.slice(2);
  else if (!hasPlus) {
    // Móvil/fijo español sin prefijo (9 cifras, 6-9).
    return /^[6-9]\d{8}$/.test(digits) ? { lang: "es", reason: "teléfono español" } : null;
  }
  for (const len of [3, 2, 1]) {
    const p = digits.slice(0, len);
    if (p in PHONE_PREFIX) {
      const lang = PHONE_PREFIX[p];
      return lang ? { lang, reason: `teléfono +${p}` } : null;
    }
  }
  return null;
}

const TLD: Record<string, QuotePdfLang> = {
  fr: "fr", de: "de", at: "de", it: "it", br: "pt", pt: "pt", nl: "en", uk: "en", ie: "en",
};

function langFromEmail(email: string): { lang: QuotePdfLang; reason: string } | null {
  const m = email.trim().toLowerCase().match(/@[^@\s]+\.([a-z]{2,})$/);
  if (!m || !TLD[m[1]]) return null;
  return { lang: TLD[m[1]], reason: `email .${m[1]}` };
}

export function suggestClientLang(input: {
  text?: string | null;
  phone?: string | null;
  email?: string | null;
  pageLocale?: string | null;
}): ClientLangSuggestion | null {
  if (input.text) {
    const l = detectTextLang(input.text);
    if (l) {
      const lang = toPdfLang(l);
      return { lang, reason: l === "nl" ? "escribió en neerlandés; no hay PDF en neerlandés" : `escribió en ${TEXT_LANG_ES[l]}` };
    }
  }
  const loc = String(input.pageLocale || "").trim().toLowerCase().slice(0, 2);
  if (loc) {
    const l = (loc in SETS ? loc : null) as TextLang | null;
    if (l) return { lang: toPdfLang(l), reason: `entró por la web en ${TEXT_LANG_ES[l]}` };
  }
  if (input.phone) {
    const r = langFromPhone(input.phone);
    if (r) return r;
  }
  if (input.email && !input.email.toLowerCase().endsWith("@whatsapp.local")) {
    const r = langFromEmail(input.email);
    if (r) return r;
  }
  return null;
}
