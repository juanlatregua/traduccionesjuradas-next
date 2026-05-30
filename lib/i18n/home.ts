// lib/i18n/home.ts — Copys del home "banco de utilidades" (mockup aprobado),
// bilingüe (es|fr) y extensible. Lo consume <HomeV2 lang>. Adaptar a otro idioma
// = añadir su columna. El catálogo de idiomas/documentos se reusa de nav.ts.

export type HomeLang = "es" | "fr";

type Bi = { es: string; fr: string };
const bi = (es: string, fr: string): Bi => ({ es, fr });

export type HomeStrings = {
  hero: {
    eyebrow: Bi;
    h1pre: Bi;
    h1em: Bi;
    lede: Bi;
    promise: { b: Bi; t: Bi }[];
    ratingNote: Bi;
    priceLine: Bi;
    credit: Bi; // línea de autoridad (genérica + especialista FR)
  };
  catalog: { kicker: Bi; h2: Bi; sub: Bi; idiomas: Bi; documentos: Bi; idiomasMore: Bi; docsMore: Bi };
  founder: { quote: Bi; role: Bi };
  reviews: { kicker: Bi; h2: Bi; items: { text: Bi; who: string; date: Bi }[] };
  guides: { kicker: Bi; h2: Bi; sub: Bi; more: Bi; items: { title: Bi; desc: Bi; href: string }[] };
  finalCta: { h2: Bi; p: Bi; primary: Bi; secondary: Bi; micro: Bi };
};

export const HOME: HomeStrings = {
  hero: {
    eyebrow: bi("Banco de utilidades · traducción jurada", "Banque d'utilités · traduction assermentée"),
    h1pre: bi("Sube tu documento y sabes qué, cuánto y cuándo", "Déposez votre document et sachez quoi, combien et quand"),
    h1em: bi("en 10 segundos", "en 10 secondes"),
    lede: bi(
      "No empezamos con un eslogan: empezamos resolviendo tu duda. Diagnóstico instantáneo y precio cerrado, sin compromiso.",
      "On ne commence pas par un slogan : on commence par répondre à votre question. Diagnostic instantané et prix ferme, sans engagement."
    ),
    promise: [
      { b: bi("Qué necesitas:", "Ce qu'il vous faut :"), t: bi("te decimos si requiere jurada y con qué validez.", "on vous dit s'il faut une assermentée et avec quelle validité.") },
      { b: bi("Cuánto:", "Combien :"), t: bi("precio cerrado, desde 35 €/documento. Sin sorpresas.", "prix ferme, dès 35 €/document. Sans surprises.") },
      { b: bi("Cuándo:", "Quand :"), t: bi("entrega en 24–72 h. Del pago a la descarga, no preguntas nada más.", "livraison en 24–72 h. Du paiement au téléchargement, vous ne demandez plus rien.") },
    ],
    ratingNote: bi("4,8 · 46 reseñas en Google", "4,8 · 46 avis sur Google"),
    priceLine: bi("Precio cerrado desde 35 € · 10 idiomas · entrega 24–72 h", "Prix ferme dès 35 € · 10 langues · livraison 24–72 h"),
    credit: bi(
      "Traductores jurados acreditados por el MAEC · PDF firmado con validez oficial. Especialistas en francés (Juan Silva, nº 3850).",
      "Traducteurs assermentés accrédités par le MAEC · PDF signé à validité officielle. Spécialistes du français (Juan Silva, nº 3850)."
    ),
  },
  catalog: {
    kicker: bi("El catálogo, ordenado por iconos", "Le catalogue, classé par icônes"),
    h2: bi("Idiomas y documentos", "Langues et documents"),
    sub: bi("Especialistas en francés ↔ español, con 9 idiomas más y los documentos oficiales más frecuentes.", "Spécialistes du français ↔ espagnol, avec 9 langues de plus et les documents officiels les plus fréquents."),
    idiomas: bi("Idiomas", "Langues"),
    documentos: bi("Documentos oficiales", "Documents officiels"),
    idiomasMore: bi("Ver todos los idiomas →", "Voir toutes les langues →"),
    docsMore: bi("Ver todos los documentos →", "Voir tous les documents →"),
  },
  founder: {
    quote: bi(
      "Detrás de cada jurada hay un nombre y un número de acreditación. El mío. Por eso no recibes un formulario frío, sino la certeza de que tu documento tendrá validez oficial.",
      "Derrière chaque traduction assermentée, il y a un nom et un numéro d'accréditation. Le mien. Vous ne recevez pas un formulaire froid, mais la certitude que votre document aura une validité officielle."
    ),
    role: bi("Juan Silva · Traductor jurado de francés · MAEC nº 3850 · HBTJ Consultores Lingüísticos S.L.", "Juan Silva · Traducteur assermenté de français · MAEC nº 3850 · HBTJ Consultores Lingüísticos S.L."),
  },
  reviews: {
    kicker: bi("Clientes reales", "Clients réels"),
    h2: bi("Confían en nosotros para lo que importa", "Ils nous font confiance pour ce qui compte"),
    items: [
      { text: bi("Necesitábamos con urgencia una traducción jurada del francés y el servicio fue fantástico. Muy profesionales.", "Nous avions besoin en urgence d'une traduction assermentée du français et le service a été formidable. Très professionnels."), who: "Pedro V.", date: bi("abril 2024", "avril 2024") },
      { text: bi("Excelente servicio, rapidez y buena respuesta.", "Excellent service, rapidité et bonne réactivité."), who: "Anaïs A.", date: bi("marzo 2026", "mars 2026") },
      { text: bi("Buen trabajo, bien hecho y a tiempo.", "Bon travail, bien fait et dans les délais."), who: "Yassine E.", date: bi("abril 2026", "avril 2026") },
    ],
  },
  guides: {
    kicker: bi("Guías verificadas · citables", "Guides vérifiés · citables"),
    h2: bi("Resuelve la duda antes de pedir", "Levez le doute avant de commander"),
    sub: bi("Información clara sobre apostilla, La Haya y trámites por país.", "Informations claires sur l'apostille, La Haye et les démarches par pays."),
    more: bi("Ver todas las guías", "Voir tous les guides"),
    items: [
      { title: bi("Documentos de Marruecos", "Documents du Maroc"), desc: bi("Apostilla, legalización y qué traducir para tus trámites en España.", "Apostille, légalisation et quoi traduire pour vos démarches en Espagne."), href: "/blog/documentos-marroquies-guia-completa" },
      { title: bi("Homologar tu título", "Homologuer votre diplôme"), desc: bi("Pasos para homologar un título universitario extranjero en España.", "Étapes pour homologuer un diplôme universitaire étranger en Espagne."), href: "/blog/homologacion-titulo-universitario" },
      { title: bi("Reagrupación familiar", "Regroupement familial"), desc: bi("Qué documentos necesitas y cuáles deben ir con traducción jurada.", "Quels documents vous faut-il et lesquels doivent être traduits."), href: "/blog/reagrupacion-familiar-documentos" },
    ],
  },
  finalCta: {
    h2: bi("Tu documento. Diagnóstico en 10 s. Jurada en 24–72 h.", "Votre document. Diagnostic en 10 s. Assermentée en 24–72 h."),
    p: bi(
      "Sube tu documento y deja de adivinar. Te decimos qué necesitas, cuánto cuesta y cuándo lo tienes — y desde el pago hasta la descarga no vuelves a preguntar nada.",
      "Déposez votre document et arrêtez de deviner. On vous dit ce qu'il vous faut, le prix et le délai — et du paiement au téléchargement, vous ne demandez plus rien."
    ),
    primary: bi("Subir y diagnosticar", "Déposer et diagnostiquer"),
    secondary: bi("Ver utilidades", "Voir les utilités"),
    micro: bi("Pago seguro · precio cerrado desde 35 €/documento · sin compromiso", "Paiement sécurisé · prix ferme dès 35 €/document · sans engagement"),
  },
};

export function pick<T extends Bi>(b: T, lang: HomeLang): string {
  return b[lang];
}
