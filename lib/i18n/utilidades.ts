// lib/i18n/utilidades.ts — Diccionario del "banco de utilidades" del home.
// Bilingüe (es|fr) y extensible: adaptar a otro idioma = añadir su columna, no
// reescribir el componente. Lo consume <BancoUtilidades lang> en el home ES y FR.
//
// REGLA: cada utilidad enlaza a un destino REAL (sin enlaces rotos). Las de IA
// (diagnóstico, requerimiento) van a la puerta del propio idioma (anchorPuerta).

export type UtilLang = "es" | "fr";

type Bi = { es: string; fr: string };

export type Utilidad = {
  key: string;
  icon: "scan" | "help" | "checklist" | "shield" | "book" | "track";
  title: Bi;
  desc: Bi;
  cta: Bi;
  /** Ruta fija, o "PUERTA" para resolver al ancla de la puerta del idioma. */
  href: string;
};

export const utilidadesT: Record<
  UtilLang,
  { heading: string; sub: string; bridge: string; bridgeCta: string }
> = {
  es: {
    heading: "Qué puedes hacer aquí",
    sub: "Seis utilidades. Todas terminan donde lo necesitas: una traducción jurada con validez oficial.",
    bridge:
      "Sea cual sea la utilidad que uses, para que valga ante la administración necesitas una jurada — y la tienes aquí en 10 segundos.",
    bridgeCta: "Pedir mi jurada",
  },
  fr: {
    heading: "Ce que vous pouvez faire ici",
    sub: "Six utilités. Toutes mènent là où vous en avez besoin : une traduction assermentée avec validité officielle.",
    bridge:
      "Quelle que soit l'utilité, pour qu'elle soit valable devant l'administration il vous faut une traduction assermentée — et vous l'avez ici en 10 secondes.",
    bridgeCta: "Demander ma traduction",
  },
};

export const UTILIDADES: Utilidad[] = [
  {
    key: "diagnostica",
    icon: "scan",
    title: { es: "Diagnostica tu documento", fr: "Diagnostiquez votre document" },
    desc: {
      es: "Súbelo y sabrás al instante qué es, si requiere jurada, cuánto cuesta y cuándo lo tienes.",
      fr: "Déposez-le et sachez aussitôt ce que c'est, s'il faut une assermentée, le prix et le délai.",
    },
    cta: { es: "Empezar arriba", fr: "Commencer en haut" },
    href: "PUERTA",
  },
  {
    key: "requerimiento",
    icon: "help",
    title: { es: "Entiende tu requerimiento", fr: "Comprenez votre demande" },
    desc: {
      es: "¿Tienes un papel oficial y no entiendes qué te piden? Súbelo y te lo explicamos en claro.",
      fr: "Un document officiel et vous ne comprenez pas ce qu'on vous demande ? Déposez-le, on vous l'explique clairement.",
    },
    cta: { es: "Aclarar mi caso", fr: "Clarifier mon cas" },
    href: "PUERTA",
  },
  {
    key: "tramite",
    icon: "checklist",
    title: { es: "Qué necesito para mi trámite", fr: "Ce qu'il me faut pour ma démarche" },
    desc: {
      es: "Los documentos oficiales más frecuentes, por tipo de trámite y país.",
      fr: "Les documents officiels les plus fréquents, par type de démarche et pays.",
    },
    cta: { es: "Ver documentos", fr: "Voir les documents" },
    href: "/documentos-oficiales",
  },
  {
    key: "verifica",
    icon: "shield",
    title: { es: "Verifica un traductor jurado", fr: "Vérifiez un traducteur assermenté" },
    desc: {
      es: "Acreditación oficial ante el MAEC y validez legal de tus traducciones.",
      fr: "Accréditation officielle auprès du MAEC et validité légale de vos traductions.",
    },
    cta: { es: "Ver acreditación", fr: "Voir l'accréditation" },
    href: "/acreditacion",
  },
  {
    key: "guias",
    icon: "book",
    title: { es: "Guías por país y documento", fr: "Guides par pays et document" },
    desc: {
      es: "Apostilla, Convenio de La Haya y trámites por país. Respuestas claras y verificadas.",
      fr: "Apostille, Convention de La Haye et démarches par pays. Réponses claires et vérifiées.",
    },
    cta: { es: "Leer las guías", fr: "Lire les guides" },
    href: "/blog",
  },
  {
    key: "consulta",
    icon: "track",
    title: { es: "Consulta tu pedido", fr: "Suivez votre commande" },
    desc: {
      es: "Sigue el estado de tu traducción con tu referencia y tu email, cuando quieras.",
      fr: "Suivez l'état de votre traduction avec votre référence et votre e-mail, à tout moment.",
    },
    cta: { es: "Consultar estado", fr: "Suivre l'état" },
    href: "/consulta",
  },
];
