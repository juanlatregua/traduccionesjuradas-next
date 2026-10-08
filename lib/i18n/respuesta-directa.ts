import type { Locale } from "@/lib/i18n/locales";

export const PORTADAS_UPDATED = "2026-10-08";

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
    lead: "Une traduction assermentée est la traduction officielle d'un document, signée et cachetée par un traducteur assermenté habilité par le Ministère espagnol des Affaires étrangères (MAEC), avec valeur officielle devant les administrations et tribunaux espagnols. Pour le français-espagnol, elle est réalisée par Juan Silva Moreno, traducteur assermenté MAEC n° 3850 : 30 € HT par page de l'original (actes, certificats, diplômes, casier), +5 € si le document est apostillé ; l'allemand-espagnol, 30 € HT par page (35 € s'il y a des tableaux). Livraison en 24 h (1 à 2 pages) ou 48 h (3 pages ou plus) à compter du paiement. Pour les autres langues, le prix et le délai fermes sont confirmés dans le devis, en général le jour même.",
    updated: "Mis à jour le",
    head: ["Document", "Prix HT", "Délai"],
    rows: [
      ["Français → espagnol, par page (acte, certificat, diplôme, casier, apostille…)", "30 € par page · +5 € si apostillé", "24 h (1-2 p.) · 48 h (3 p. ou plus)"],
      ["Allemand → espagnol, par page (35 € si tableaux : relevés de notes, relevés bancaires)", "30 € par page · +5 € si apostillé", "48 h"],
      ["Espagnol → français, 1 page", "à partir de 35 €", "24 h"],
      ["Espagnol → français, 2 pages ou plus", "à partir de 55 €", "24 h"],
      ["Contrats, actes notariés et textes longs en français", "au mot, minimum 35 €", "48 h"],
      ["Autres langues (anglais, néerlandais, portugais, roumain…) et textes longs en allemand", "à partir de 40 € / document", "confirmé dans le devis"],
    ],
    source: "Source : MAEC, traducteurs-interprètes jurés",
  },
  en: {
    lead: "A sworn translation is the official translation of a document, signed and stamped by a sworn translator authorised by Spain's Ministry of Foreign Affairs (MAEC), and it has official status before Spanish administrative and judicial bodies. French → Spanish costs €30 + VAT per page of the original (certificates, records, degrees, criminal records), +€5 if apostilled and German → Spanish €30 + VAT per page (€35 if the page has tables), delivered in 24 h (1–2 pages) or 48 h (3+ pages) from payment. For other languages, including English, the sworn translator confirms a fixed price and deadline in the quote, usually the same day, from €40 + VAT per document.",
    updated: "Updated",
    head: ["Document", "Price excl. VAT", "Turnaround"],
    rows: [
      ["English, Dutch, Portuguese, Romanian… (and long German texts) ↔ Spanish, per document", "from €40", "confirmed in the quote"],
      ["French → Spanish, per page (certificate, record, degree, apostille…)", "€30 per page · +€5 if apostilled", "24 h (1–2 p.) · 48 h (3+ p.)"],
      ["German → Spanish, per page (€35 if tables: transcripts, bank statements)", "€30 per page · +€5 if apostilled", "48 h"],
      ["Spanish → French, 1 page", "from €35", "24 h"],
      ["Spanish → French, 2+ pages", "from €55", "24 h"],
      ["Contracts, deeds and long texts in French", "per word, minimum €35", "48 h"],
    ],
    source: "Source: MAEC, sworn translators and interpreters",
  },
  de: {
    lead: "Eine beglaubigte Übersetzung ist die amtliche Übersetzung eines Dokuments, unterschrieben und gestempelt von einem vom spanischen Außenministerium (MAEC) ermächtigten Übersetzer; sie hat vor spanischen Verwaltungs- und Justizbehörden amtlichen Charakter. Deutsch → Spanisch kostet 30 € zzgl. MwSt. pro Seite des Originals (+5 € mit Apostille; 35 € pro Seite, wenn sie Tabellen enthält: Zeugnisse, Notenübersichten, Kontoauszüge) und wird ab Zahlung in 48 Std. geliefert; der Preis steht sofort fest. Französisch → Spanisch kostet 30 € zzgl. MwSt. pro Seite und wird in 24 Std. (1–2 Seiten) bzw. 48 Std. (ab 3 Seiten) geliefert. Für Verträge und lange Texte sowie von Spanisch ins Deutsche bestätigt der Übersetzer Festpreis und Lieferzeit im Angebot, in der Regel am selben Tag, ab 40 € zzgl. MwSt. pro Dokument.",
    updated: "Aktualisiert am",
    head: ["Dokument", "Preis zzgl. MwSt.", "Lieferzeit"],
    rows: [
      ["Deutsch → Spanisch, pro Seite (Urkunde, Zeugnis, Führungszeugnis, Apostille…)", "30 € pro Seite · +5 € mit Apostille", "48 Std."],
      ["Deutsch → Spanisch, Seite mit Tabellen (Notenübersicht, Kontoauszug)", "35 € pro Seite", "48 Std."],
      ["Französisch → Spanisch, pro Seite (Urkunde, Zeugnis, Führungszeugnis, Apostille…)", "30 € pro Seite · +5 € mit Apostille", "24 Std. (1–2 S.) · 48 Std. (ab 3 S.)"],
      ["Englisch, Niederländisch, Portugiesisch, Rumänisch… ↔ Spanisch, pro Dokument", "ab 40 €", "im Angebot bestätigt"],
      ["Spanisch → Französisch, 1 Seite", "ab 35 €", "24 Std."],
      ["Spanisch → Französisch, ab 2 Seiten", "ab 55 €", "24 Std."],
    ],
    source: "Quelle: MAEC, vereidigte Übersetzer und Dolmetscher",
  },
  pt: {
    lead: "Uma tradução certificada é a tradução oficial de um documento, assinada e carimbada por um tradutor jurado habilitado pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC), com carácter oficial perante os órgãos administrativos e judiciais espanhóis. Para português ↔ espanhol, o tradutor confirma no orçamento o preço fechado e o prazo, normalmente no mesmo dia, desde 40 € + IVA por documento. Francês → espanhol custa 30 € + IVA por página do original (+5 € se apostilado) e alemão → espanhol 30 € + IVA por página (35 € se tiver tabelas), com entrega em 24 h (1 a 2 páginas) ou 48 h (3 ou mais páginas) após o pagamento.",
    updated: "Atualizado em",
    head: ["Documento", "Preço sem IVA", "Prazo"],
    rows: [
      ["Português, inglês, neerlandês, romeno… (e textos longos em alemão) ↔ espanhol, por documento", "desde 40 €", "confirmado no orçamento"],
      ["Francês → espanhol, por página (certidão, diploma, registo criminal, apostila…)", "30 € por página · +5 € se apostilado", "24 h (1-2 p.) · 48 h (3 p. ou mais)"],
      ["Alemão → espanhol, por página (35 € se tiver tabelas: históricos, extratos)", "30 € por página · +5 € se apostilado", "48 h"],
      ["Espanhol → francês, 1 página", "desde 35 €", "24 h"],
      ["Espanhol → francês, 2 ou mais páginas", "desde 55 €", "24 h"],
      ["Contratos, escrituras e textos longos em francês", "à palavra, mínimo 35 €", "48 h"],
    ],
    source: "Fonte: MAEC, tradutores e intérpretes jurados",
  },
};
