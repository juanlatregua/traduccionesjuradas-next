import type { Locale } from "@/lib/i18n/locales";

export const PORTADAS_UPDATED = "2026-09-29";

export const MAEC_TRADUCTORES_URL =
  "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx";

type RespuestaDirecta = {
  lead: string;
  updated: string;
  head: [string, string, string];
  rows: [string, string, string][];
  source: string;
};

export const RESPUESTA_DIRECTA: Record<Exclude<Locale, "es">, RespuestaDirecta> = {
  fr: {
    lead: "Une traduction assermentée est la traduction officielle d'un document, signée et cachetée par un traducteur assermenté habilité par le Ministère espagnol des Affaires étrangères (MAEC), avec valeur officielle devant les administrations et tribunaux espagnols. Pour le français-espagnol, elle est réalisée par Juan Silva Moreno, traducteur assermenté MAEC n° 3850 : à partir de 35 € HT par document, livrée en 24 h (1 à 2 pages) ou 48 h (3 pages ou plus) à compter du paiement. Pour les autres langues, le prix et le délai fermes sont confirmés dans le devis, en général le jour même.",
    updated: "Mis à jour le",
    head: ["Document", "Prix HT", "Délai"],
    rows: [
      ["Français ↔ espagnol, 1 page (acte, certificat)", "à partir de 35 €", "24 h"],
      ["Français ↔ espagnol, 1 page avec apostille", "40 €", "24 h"],
      ["Français ↔ espagnol, 2 pages (livret de famille…)", "à partir de 55 €", "24 h"],
      ["Documents marocains en français, 1 à 2 pages", "40 €", "24 h"],
      ["Français ↔ espagnol, 3 pages ou plus", "à partir de 55 €", "48 h"],
      ["Autres langues (anglais, allemand, néerlandais, portugais, roumain…)", "à partir de 40 € / document", "confirmé dans le devis"],
    ],
    source: "Source : MAEC, traducteurs-interprètes jurés",
  },
  en: {
    lead: "A sworn translation is the official translation of a document, signed and stamped by a sworn translator authorised by Spain's Ministry of Foreign Affairs (MAEC), and it has official status before Spanish administrative and judicial bodies. French ↔ Spanish costs from €35 + VAT per document and is delivered in 24 h (1–2 pages) or 48 h (3+ pages) from payment. For other languages, including English, the sworn translator confirms a fixed price and deadline in the quote, usually the same day, from €40 + VAT per document.",
    updated: "Updated",
    head: ["Document", "Price excl. VAT", "Turnaround"],
    rows: [
      ["English, German, Dutch, Portuguese, Romanian… ↔ Spanish, per document", "from €40", "confirmed in the quote"],
      ["French ↔ Spanish, 1 page (certificate)", "from €35", "24 h"],
      ["French ↔ Spanish, 1 page with apostille", "€40", "24 h"],
      ["French ↔ Spanish, 2 pages", "from €55", "24 h"],
      ["Moroccan documents in French, 1–2 pages", "€40", "24 h"],
      ["French ↔ Spanish, 3+ pages", "from €55", "48 h"],
    ],
    source: "Source: MAEC, sworn translators and interpreters",
  },
  de: {
    lead: "Eine beglaubigte Übersetzung ist die amtliche Übersetzung eines Dokuments, unterschrieben und gestempelt von einem vom spanischen Außenministerium (MAEC) ermächtigten Übersetzer; sie hat vor spanischen Verwaltungs- und Justizbehörden amtlichen Charakter. Für Deutsch ↔ Spanisch bestätigt der Übersetzer Festpreis und Lieferzeit im Angebot, in der Regel am selben Tag, ab 40 € zzgl. MwSt. pro Dokument. Französisch ↔ Spanisch kostet ab 35 € zzgl. MwSt. und wird ab Zahlung in 24 Std. (1–2 Seiten) bzw. 48 Std. (ab 3 Seiten) geliefert.",
    updated: "Aktualisiert am",
    head: ["Dokument", "Preis zzgl. MwSt.", "Lieferzeit"],
    rows: [
      ["Deutsch, Englisch, Niederländisch, Portugiesisch, Rumänisch… ↔ Spanisch, pro Dokument", "ab 40 €", "im Angebot bestätigt"],
      ["Französisch ↔ Spanisch, 1 Seite (Urkunde)", "ab 35 €", "24 Std."],
      ["Französisch ↔ Spanisch, 1 Seite mit Apostille", "40 €", "24 Std."],
      ["Französisch ↔ Spanisch, 2 Seiten", "ab 55 €", "24 Std."],
      ["Marokkanische Dokumente auf Französisch, 1–2 Seiten", "40 €", "24 Std."],
      ["Französisch ↔ Spanisch, ab 3 Seiten", "ab 55 €", "48 Std."],
    ],
    source: "Quelle: MAEC, vereidigte Übersetzer und Dolmetscher",
  },
  pt: {
    lead: "Uma tradução certificada é a tradução oficial de um documento, assinada e carimbada por um tradutor jurado habilitado pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC), com carácter oficial perante os órgãos administrativos e judiciais espanhóis. Para português ↔ espanhol, o tradutor confirma no orçamento o preço fechado e o prazo, normalmente no mesmo dia, desde 40 € + IVA por documento. Francês ↔ espanhol custa desde 35 € + IVA e é entregue em 24 h (1 a 2 páginas) ou 48 h (3 ou mais páginas) após o pagamento.",
    updated: "Atualizado em",
    head: ["Documento", "Preço sem IVA", "Prazo"],
    rows: [
      ["Português, inglês, alemão, neerlandês, romeno… ↔ espanhol, por documento", "desde 40 €", "confirmado no orçamento"],
      ["Francês ↔ espanhol, 1 página (certidão)", "à partir de 35 €", "24 h"],
      ["Francês ↔ espanhol, 1 página com apostila", "40 €", "24 h"],
      ["Francês ↔ espanhol, 2 páginas", "desde 55 €", "24 h"],
      ["Documentos marroquinos em francês, 1 a 2 páginas", "40 €", "24 h"],
      ["Francês ↔ espanhol, 3 ou mais páginas", "desde 55 €", "48 h"],
    ],
    source: "Fonte: MAEC, tradutores e intérpretes jurados",
  },
};
