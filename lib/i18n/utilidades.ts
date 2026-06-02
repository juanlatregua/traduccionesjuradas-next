// lib/i18n/utilidades.ts — Diccionario del "banco de utilidades" del home, en
// los 5 idiomas (es·fr·en·de·pt). Lo consume <BancoUtilidades lang> en cada
// home. Añadir un idioma = añadir su valor en cada Tr.
//
// REGLA: cada utilidad enlaza a un destino REAL (sin enlaces rotos). Las de IA
// (diagnóstico, requerimiento) van a la puerta del propio idioma ("PUERTA").

import type { Locale, Tr } from "@/lib/i18n/locales";

export type UtilLang = Locale;

export type Utilidad = {
  key: string;
  icon: "scan" | "help" | "checklist" | "shield" | "book" | "track";
  title: Tr;
  desc: Tr;
  cta: Tr;
  /** Ruta fija, "PUERTA" (ancla de la puerta del idioma) o "LECTOR" (lector de requerimientos del idioma). */
  href: string;
};

const tr = (es: string, fr: string, en: string, de: string, pt: string): Tr => ({ es, fr, en, de, pt });

export const utilidadesT: Record<UtilLang, { heading: string; sub: string; bridge: string; bridgeCta: string }> = {
  es: {
    heading: "Qué puedes hacer aquí",
    sub: "Seis utilidades. Todas terminan donde lo necesitas: una traducción jurada con validez oficial.",
    bridge: "Sea cual sea la utilidad que uses, para que valga ante la administración necesitas una jurada — y la tienes aquí en 10 segundos.",
    bridgeCta: "Pedir mi jurada",
  },
  fr: {
    heading: "Ce que vous pouvez faire ici",
    sub: "Six utilités. Toutes mènent là où vous en avez besoin : une traduction assermentée avec validité officielle.",
    bridge: "Quelle que soit l'utilité, pour qu'elle soit valable devant l'administration il vous faut une traduction assermentée — et vous l'avez ici en 10 secondes.",
    bridgeCta: "Demander ma traduction",
  },
  en: {
    heading: "What you can do here",
    sub: "Six tools. They all lead where you need to be: a sworn translation with official validity.",
    bridge: "Whichever tool you use, for it to be valid before the authorities you need a sworn translation — and you have it here in 10 seconds.",
    bridgeCta: "Get my sworn translation",
  },
  de: {
    heading: "Was Sie hier tun können",
    sub: "Sechs Werkzeuge. Alle führen dorthin, wo Sie hinmüssen: zu einer beglaubigten Übersetzung mit amtlicher Gültigkeit.",
    bridge: "Welches Werkzeug Sie auch nutzen — damit es vor den Behörden gilt, brauchen Sie eine beglaubigte Übersetzung. Und die haben Sie hier in 10 Sekunden.",
    bridgeCta: "Beglaubigte Übersetzung anfragen",
  },
  pt: {
    heading: "O que pode fazer aqui",
    sub: "Seis ferramentas. Todas terminam onde precisa: uma tradução certificada com validade oficial.",
    bridge: "Seja qual for a ferramenta que use, para ter validade perante a administração precisa de uma tradução certificada — e tem-na aqui em 10 segundos.",
    bridgeCta: "Pedir a minha tradução certificada",
  },
};

export const UTILIDADES: Utilidad[] = [
  {
    key: "diagnostica",
    icon: "scan",
    title: tr("Diagnostica tu documento", "Diagnostiquez votre document", "Diagnose your document", "Diagnostizieren Sie Ihr Dokument", "Diagnostique o seu documento"),
    desc: tr(
      "Súbelo y sabrás al instante qué es, si requiere jurada, cuánto cuesta y cuándo lo tienes.",
      "Déposez-le et sachez aussitôt ce que c'est, s'il faut une assermentée, le prix et le délai.",
      "Upload it and instantly know what it is, whether it needs a sworn translation, the price and the delivery date.",
      "Laden Sie es hoch und erfahren Sie sofort, was es ist, ob eine beglaubigte Übersetzung nötig ist, den Preis und den Liefertermin.",
      "Envie-o e saiba na hora o que é, se exige tradução certificada, quanto custa e quando o tem."
    ),
    cta: tr("Empezar arriba", "Commencer en haut", "Start above", "Oben starten", "Começar acima"),
    href: "PUERTA",
  },
  {
    key: "requerimiento",
    icon: "help",
    title: tr("Entiende tu requerimiento", "Comprenez votre courrier officiel", "Understand your official letter", "Verstehen Sie Ihre behördliche Aufforderung", "Entenda a sua notificação"),
    desc: tr(
      "¿Tienes un papel oficial y no entiendes qué te piden? Súbelo y te lo explicamos en claro.",
      "Un document officiel et vous ne comprenez pas ce qu'on vous demande ? Déposez-le, on vous l'explique clairement.",
      "Got an official document and don't understand what's being asked? Upload it and we'll explain it plainly.",
      "Sie haben ein amtliches Schreiben und verstehen nicht, was verlangt wird? Laden Sie es hoch, wir erklären es Ihnen klar.",
      "Tem um documento oficial e não percebe o que lhe pedem? Envie-o e explicamos-lhe com clareza."
    ),
    cta: tr("Aclarar mi caso", "Clarifier mon cas", "Clarify my case", "Meinen Fall klären", "Esclarecer o meu caso"),
    href: "LECTOR",
  },
  {
    key: "tramite",
    icon: "checklist",
    title: tr("Qué necesito para mi trámite", "Ce qu'il me faut pour ma démarche", "What I need for my procedure", "Was ich für mein Verfahren brauche", "O que preciso para o meu trâmite"),
    desc: tr(
      "Los documentos oficiales más frecuentes, por tipo de trámite y país.",
      "Les documents officiels les plus fréquents, par type de démarche et pays.",
      "The most common official documents, by type of procedure and country.",
      "Die häufigsten amtlichen Dokumente, nach Verfahrensart und Land.",
      "Os documentos oficiais mais frequentes, por tipo de trâmite e país."
    ),
    cta: tr("Ver documentos", "Voir les documents", "See documents", "Dokumente ansehen", "Ver documentos"),
    href: "/documentos-oficiales",
  },
  {
    key: "verifica",
    icon: "shield",
    title: tr("Verifica un traductor jurado", "Vérifiez un traducteur assermenté", "Verify a sworn translator", "Einen vereidigten Übersetzer prüfen", "Verifique um tradutor ajuramentado"),
    desc: tr(
      "Acreditación oficial ante el MAEC y validez legal de tus traducciones.",
      "Accréditation officielle auprès du MAEC et validité légale de vos traductions.",
      "Official accreditation with the MAEC and the legal validity of your translations.",
      "Offizielle Akkreditierung beim MAEC und rechtliche Gültigkeit Ihrer Übersetzungen.",
      "Acreditação oficial junto do MAEC e validade legal das suas traduções."
    ),
    cta: tr("Ver acreditación", "Voir l'accréditation", "See accreditation", "Akkreditierung ansehen", "Ver acreditação"),
    href: "/acreditacion",
  },
  {
    key: "guias",
    icon: "book",
    title: tr("Guías por país y documento", "Guides par pays et document", "Guides by country and document", "Leitfäden nach Land und Dokument", "Guias por país e documento"),
    desc: tr(
      "Apostilla, Convenio de La Haya y trámites por país. Respuestas claras y verificadas.",
      "Apostille, Convention de La Haye et démarches par pays. Réponses claires et vérifiées.",
      "Apostille, the Hague Convention and procedures by country. Clear, verified answers.",
      "Apostille, Haager Übereinkommen und Verfahren nach Land. Klare, geprüfte Antworten.",
      "Apostila, Convenção de Haia e trâmites por país. Respostas claras e verificadas."
    ),
    cta: tr("Leer las guías", "Lire les guides", "Read the guides", "Leitfäden lesen", "Ler os guias"),
    href: "/blog",
  },
  {
    key: "consulta",
    icon: "track",
    title: tr("Consulta tu pedido", "Suivez votre commande", "Track your order", "Bestellung verfolgen", "Consulte o seu pedido"),
    desc: tr(
      "Sigue el estado de tu traducción con tu referencia y tu email, cuando quieras.",
      "Suivez l'état de votre traduction avec votre référence et votre e-mail, à tout moment.",
      "Check your translation's status with your reference and email, anytime.",
      "Verfolgen Sie den Status Ihrer Übersetzung mit Referenz und E-Mail, jederzeit.",
      "Acompanhe o estado da sua tradução com a sua referência e o seu email, quando quiser."
    ),
    cta: tr("Consultar estado", "Suivre l'état", "Check status", "Status prüfen", "Consultar estado"),
    href: "/consulta",
  },
];
