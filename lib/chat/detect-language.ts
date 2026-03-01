const FRENCH_KEYWORDS = [
  "bonjour", "merci", "salut", "comment", "besoin", "traduction",
  "document", "combien", "prix", "quel", "quelle", "voudrais",
  "pouvez", "français", "s'il vous plaît", "je", "nous", "vous",
  "oui", "non", "est-ce que", "pourquoi", "quand", "où",
  "certificat", "naissance", "mariage", "casier", "judiciaire",
];

const ENGLISH_KEYWORDS = [
  "hello", "thank", "thanks", "need", "translation", "how much",
  "price", "would", "could", "please", "want", "looking for",
  "document", "certificate", "birth", "marriage", "criminal",
  "record", "sworn", "official", "yes", "the", "and",
];

const ARABIC_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function detectLanguage(text: string): "es" | "fr" | "en" | "ar" {
  if (ARABIC_PATTERN.test(text)) return "ar";

  const lower = text.toLowerCase();

  let frScore = 0;
  let enScore = 0;

  for (const kw of FRENCH_KEYWORDS) {
    if (lower.includes(kw)) frScore++;
  }

  for (const kw of ENGLISH_KEYWORDS) {
    if (lower.includes(kw)) enScore++;
  }

  if (frScore > enScore && frScore >= 2) return "fr";
  if (enScore > frScore && enScore >= 2) return "en";
  if (frScore >= 1 && enScore === 0) return "fr";
  if (enScore >= 1 && frScore === 0) return "en";

  return "es";
}
