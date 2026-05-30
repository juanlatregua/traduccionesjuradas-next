// lib/i18n/home.ts — Copys del home "banco de utilidades" (mockup aprobado),
// en los 5 idiomas (es·fr·en·de·pt). Lo consume <HomeV2 lang>. El catálogo de
// idiomas/documentos se reutiliza de nav.ts. Añadir un idioma = su columna.
//
// Regla de dos niveles: el nº 3850 (acreditación FRANCESA de Juan) solo aparece
// en es/fr. En en/de/pt la autoridad es genérica ("acreditado por el MAEC").

import type { Locale, Tr } from "@/lib/i18n/locales";

export type HomeLang = Locale;

const tr = (es: string, fr: string, en: string, de: string, pt: string): Tr => ({ es, fr, en, de, pt });

export type HomeStrings = {
  hero: {
    eyebrow: Tr;
    h1pre: Tr;
    h1em: Tr;
    lede: Tr;
    promise: { b: Tr; t: Tr }[];
    ratingNote: Tr;
    priceLine: Tr;
    credit: Tr;
  };
  catalog: { kicker: Tr; h2: Tr; sub: Tr; idiomas: Tr; documentos: Tr; idiomasMore: Tr; docsMore: Tr };
  founder: { quote: Tr; role: Tr };
  reviews: { kicker: Tr; h2: Tr; items: { text: Tr; who: string; date: Tr }[] };
  guides: { kicker: Tr; h2: Tr; sub: Tr; more: Tr; read: Tr; items: { title: Tr; desc: Tr; href: string }[] };
  finalCta: { h2: Tr; p: Tr; primary: Tr; secondary: Tr; micro: Tr };
};

export const HOME: HomeStrings = {
  hero: {
    eyebrow: tr(
      "Banco de utilidades · traducción jurada",
      "Banque d'utilités · traduction assermentée",
      "Toolkit · sworn translation",
      "Werkzeugkasten · beglaubigte Übersetzung",
      "Caixa de ferramentas · tradução certificada"
    ),
    h1pre: tr(
      "Sube tu documento y sabes qué, cuánto y cuándo",
      "Déposez votre document et sachez quoi, combien et quand",
      "Upload your document and know what, how much and when",
      "Laden Sie Ihr Dokument hoch und erfahren Sie was, wie viel und wann",
      "Envie o seu documento e saiba o quê, quanto e quando"
    ),
    h1em: tr("en 10 segundos", "en 10 secondes", "in 10 seconds", "in 10 Sekunden", "em 10 segundos"),
    lede: tr(
      "No empezamos con un eslogan: empezamos resolviendo tu duda. Diagnóstico instantáneo y precio cerrado, sin compromiso.",
      "On ne commence pas par un slogan : on commence par répondre à votre question. Diagnostic instantané et prix ferme, sans engagement.",
      "We don't start with a slogan: we start by answering your question. Instant diagnosis and a fixed price, no commitment.",
      "Wir beginnen nicht mit einem Slogan, sondern mit der Antwort auf Ihre Frage. Sofortige Diagnose und Festpreis, unverbindlich.",
      "Não começamos com um slogan: começamos por responder à sua dúvida. Diagnóstico instantâneo e preço fechado, sem compromisso."
    ),
    promise: [
      {
        b: tr("Qué necesitas:", "Ce qu'il vous faut :", "What you need:", "Was Sie brauchen:", "O que precisa:"),
        t: tr(
          "te decimos si requiere jurada y con qué validez.",
          "on vous dit s'il faut une assermentée et avec quelle validité.",
          "we tell you whether it needs a sworn translation and with what validity.",
          "wir sagen Ihnen, ob eine beglaubigte Übersetzung nötig ist und mit welcher Gültigkeit.",
          "dizemos-lhe se exige tradução certificada e com que validade."
        ),
      },
      {
        b: tr("Cuánto:", "Combien :", "How much:", "Wie viel:", "Quanto:"),
        t: tr(
          "precio cerrado, desde 35 €/documento. Sin sorpresas.",
          "prix ferme, dès 35 €/document. Sans surprises.",
          "a fixed price, from €35/document. No surprises.",
          "Festpreis, ab 35 €/Dokument. Keine Überraschungen.",
          "preço fechado, desde 35 €/documento. Sem surpresas."
        ),
      },
      {
        b: tr("Cuándo:", "Quand :", "When:", "Wann:", "Quando:"),
        t: tr(
          "entrega en 24–72 h. Del pago a la descarga, no preguntas nada más.",
          "livraison en 24–72 h. Du paiement au téléchargement, vous ne demandez plus rien.",
          "delivery in 24–72 h. From payment to download, there's nothing more for you to do.",
          "Lieferung in 24–72 Std. Von der Zahlung bis zum Download müssen Sie sich um nichts weiter kümmern.",
          "entrega em 24–72 h. Do pagamento ao download, não pergunta mais nada."
        ),
      },
    ],
    ratingNote: tr(
      "4,8 · 46 reseñas en Google",
      "4,8 · 46 avis sur Google",
      "4.8 · 46 Google reviews",
      "4,8 · 46 Google-Bewertungen",
      "4,8 · 46 avaliações no Google"
    ),
    priceLine: tr(
      "Precio cerrado desde 35 € · 10 idiomas · entrega 24–72 h",
      "Prix ferme dès 35 € · 10 langues · livraison 24–72 h",
      "Fixed price from €35 · 10 languages · delivery 24–72 h",
      "Festpreis ab 35 € · 10 Sprachen · Lieferung 24–72 Std.",
      "Preço fechado desde 35 € · 10 idiomas · entrega 24–72 h"
    ),
    credit: tr(
      "Traductores jurados acreditados por el MAEC · PDF firmado con validez oficial. Especialistas en francés (Juan Silva, nº 3850).",
      "Traducteurs assermentés accrédités par le MAEC · PDF signé ayant valeur officielle. Spécialistes du français (Juan Silva, nº 3850).",
      "Sworn translators accredited by Spain's Ministry of Foreign Affairs (MAEC) · officially valid signed PDF.",
      "Vom spanischen Außenministerium (MAEC) ermächtigte vereidigte Übersetzer · amtlich gültiges, signiertes PDF.",
      "Tradutores ajuramentados acreditados pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC) · PDF assinado com validade oficial."
    ),
  },
  catalog: {
    kicker: tr(
      "El catálogo, ordenado por iconos",
      "Le catalogue, classé par icônes",
      "The catalogue, organised by icons",
      "Der Katalog, nach Symbolen geordnet",
      "O catálogo, organizado por ícones"
    ),
    h2: tr("Idiomas y documentos", "Langues et documents", "Languages and documents", "Sprachen und Dokumente", "Idiomas e documentos"),
    sub: tr(
      "Especialistas en francés ↔ español, con 9 idiomas más y los documentos oficiales más frecuentes.",
      "Spécialistes du français ↔ espagnol, avec 9 langues de plus et les documents officiels les plus fréquents.",
      "Specialists in French ↔ Spanish, plus 9 more languages and the most common official documents.",
      "Spezialisten für Französisch ↔ Spanisch, plus 9 weitere Sprachen und die häufigsten amtlichen Dokumente.",
      "Especialistas em francês ↔ espanhol, com mais 9 idiomas e os documentos oficiais mais frequentes."
    ),
    idiomas: tr("Idiomas", "Langues", "Languages", "Sprachen", "Idiomas"),
    documentos: tr("Documentos oficiales", "Documents officiels", "Official documents", "Amtliche Dokumente", "Documentos oficiais"),
    idiomasMore: tr("Ver todos los idiomas →", "Voir toutes les langues →", "See all languages →", "Alle Sprachen ansehen →", "Ver todos os idiomas →"),
    docsMore: tr("Ver todos los documentos →", "Voir tous les documents →", "See all documents →", "Alle Dokumente ansehen →", "Ver todos os documentos →"),
  },
  founder: {
    quote: tr(
      "Detrás de cada jurada hay un nombre y un número de acreditación. El mío. Por eso no recibes un formulario frío, sino la certeza de que tu documento tendrá validez oficial.",
      "Derrière chaque traduction assermentée, il y a un nom et un numéro d'accréditation. Le mien. Vous ne recevez pas un formulaire froid, mais la certitude que votre document aura une validité officielle.",
      "Behind every sworn translation there's a name and an accreditation number. Mine. That's why you don't get a cold form, but the certainty that your document will be officially valid.",
      "Hinter jeder beglaubigten Übersetzung stehen ein Name und eine Akkreditierungsnummer. Meine. Deshalb erhalten Sie kein kaltes Formular, sondern die Gewissheit, dass Ihr Dokument amtlich gültig ist.",
      "Por trás de cada tradução certificada há um nome e um número de acreditação. O meu. Por isso não recebe um formulário frio, mas a certeza de que o seu documento terá validade oficial."
    ),
    role: tr(
      "Juan Silva · Traductor jurado de francés · MAEC nº 3850 · HBTJ Consultores Lingüísticos S.L.",
      "Juan Silva · Traducteur assermenté de français · MAEC nº 3850 · HBTJ Consultores Lingüísticos S.L.",
      "Juan Silva · Founder · Sworn translator accredited by the MAEC · HBTJ Consultores Lingüísticos S.L.",
      "Juan Silva · Gründer · Vom MAEC ermächtigter Übersetzer · HBTJ Consultores Lingüísticos S.L.",
      "Juan Silva · Fundador · Tradutor ajuramentado acreditado pelo MAEC · HBTJ Consultores Lingüísticos S.L."
    ),
  },
  reviews: {
    kicker: tr("Clientes reales", "Clients réels", "Real clients", "Echte Kunden", "Clientes reais"),
    h2: tr(
      "Confían en nosotros para lo que importa",
      "Ils nous font confiance pour ce qui compte",
      "They trust us with what matters",
      "Sie vertrauen uns bei dem, was zählt",
      "Confiam em nós para o que importa"
    ),
    items: [
      {
        text: tr(
          "Necesitábamos con urgencia una traducción jurada del francés y el servicio fue fantástico. Muy profesionales.",
          "Nous avions besoin en urgence d'une traduction assermentée du français et le service a été formidable. Très professionnels.",
          "We urgently needed a sworn translation from French and the service was fantastic. Very professional.",
          "Wir brauchten dringend eine beglaubigte Übersetzung aus dem Französischen und der Service war fantastisch. Sehr professionell.",
          "Precisávamos com urgência de uma tradução certificada do francês e o serviço foi fantástico. Muito profissionais."
        ),
        who: "Pedro V.",
        date: tr("abril 2024", "avril 2024", "April 2024", "April 2024", "abril de 2024"),
      },
      {
        text: tr(
          "Excelente servicio, rapidez y buena respuesta.",
          "Excellent service, rapidité et bonne réactivité.",
          "Excellent service, fast and responsive.",
          "Ausgezeichneter Service, schnell und reaktionsschnell.",
          "Excelente serviço, rapidez e boa resposta."
        ),
        who: "Anaïs A.",
        date: tr("marzo 2026", "mars 2026", "March 2026", "März 2026", "março de 2026"),
      },
      {
        text: tr(
          "Buen trabajo, bien hecho y a tiempo.",
          "Bon travail, bien fait et dans les délais.",
          "Good job, well done and on time.",
          "Gute Arbeit, gut gemacht und pünktlich.",
          "Bom trabalho, bem feito e a tempo."
        ),
        who: "Yassine E.",
        date: tr("abril 2026", "avril 2026", "April 2026", "April 2026", "abril de 2026"),
      },
    ],
  },
  guides: {
    kicker: tr("Guías verificadas · citables", "Guides vérifiés · citables", "Verified guides · citable", "Geprüfte Leitfäden · zitierfähig", "Guias verificados · citáveis"),
    h2: tr(
      "Resuelve la duda antes de pedir",
      "Levez le doute avant de commander",
      "Clear up your doubts before you order",
      "Klären Sie Ihre Fragen, bevor Sie bestellen",
      "Esclareça a dúvida antes de pedir"
    ),
    sub: tr(
      "Información clara sobre apostilla, La Haya y trámites por país.",
      "Informations claires sur l'apostille, La Haye et les démarches par pays.",
      "Clear information on the apostille, the Hague Convention and procedures by country.",
      "Klare Infos zu Apostille, Haager Übereinkommen und Verfahren nach Land.",
      "Informação clara sobre apostila, Convenção de Haia e trâmites por país."
    ),
    more: tr("Ver todas las guías", "Voir tous les guides", "See all guides", "Alle Leitfäden ansehen", "Ver todos os guias"),
    read: tr("Leer guía", "Lire le guide", "Read guide", "Leitfaden lesen", "Ler guia"),
    items: [
      {
        title: tr("Documentos de Marruecos", "Documents du Maroc", "Documents from Morocco", "Dokumente aus Marokko", "Documentos de Marrocos"),
        desc: tr(
          "Apostilla, legalización y qué traducir para tus trámites en España.",
          "Apostille, légalisation et quoi traduire pour vos démarches en Espagne.",
          "Apostille, legalisation and what to translate for your procedures in Spain.",
          "Apostille, Legalisierung und was Sie für Ihre Verfahren in Spanien übersetzen lassen müssen.",
          "Apostila, legalização e o que traduzir para os seus trâmites em Espanha."
        ),
        href: "/blog/documentos-marroquies-guia-completa",
      },
      {
        title: tr("Homologar tu título", "Homologuer votre diplôme", "Recognise your degree", "Abschluss anerkennen lassen", "Reconhecer o seu diploma"),
        desc: tr(
          "Pasos para homologar un título universitario extranjero en España.",
          "Étapes pour homologuer un diplôme universitaire étranger en Espagne.",
          "Steps to have a foreign university degree recognised in Spain.",
          "Schritte zur Anerkennung eines ausländischen Hochschulabschlusses in Spanien.",
          "Passos para homologar um diploma universitário estrangeiro em Espanha."
        ),
        href: "/blog/homologacion-titulo-universitario",
      },
      {
        title: tr("Reagrupación familiar", "Regroupement familial", "Family reunification", "Familienzusammenführung", "Reagrupamento familiar"),
        desc: tr(
          "Qué documentos necesitas y cuáles deben ir con traducción jurada.",
          "Quels documents vous faut-il et lesquels doivent être traduits.",
          "Which documents you need and which require a sworn translation.",
          "Welche Dokumente Sie brauchen und welche eine beglaubigte Übersetzung erfordern.",
          "Que documentos precisa e quais exigem tradução certificada."
        ),
        href: "/blog/reagrupacion-familiar-documentos",
      },
    ],
  },
  finalCta: {
    h2: tr(
      "Tu documento. Diagnóstico en 10 s. Jurada en 24–72 h.",
      "Votre document. Diagnostic en 10 s. Assermentée en 24–72 h.",
      "Your document. Diagnosis in 10 s. Sworn translation in 24–72 h.",
      "Ihr Dokument. Diagnose in 10 Sekunden. Beglaubigte Übersetzung in 24–72 Std.",
      "O seu documento. Diagnóstico em 10 s. Tradução certificada em 24–72 h."
    ),
    p: tr(
      "Sube tu documento y deja de adivinar. Te decimos qué necesitas, cuánto cuesta y cuándo lo tienes — y desde el pago hasta la descarga no vuelves a preguntar nada.",
      "Déposez votre document et arrêtez de deviner. On vous dit ce qu'il vous faut, le prix et le délai — et du paiement au téléchargement, vous ne demandez plus rien.",
      "Upload your document and stop guessing. We tell you what you need, the price and the delivery date — and from payment to download, there's nothing more for you to do.",
      "Laden Sie Ihr Dokument hoch und hören Sie auf zu raten. Wir sagen Ihnen, was Sie brauchen, den Preis und den Liefertermin — und von der Zahlung bis zum Download müssen Sie sich um nichts weiter kümmern.",
      "Envie o seu documento e deixe de adivinhar. Dizemos-lhe o que precisa, quanto custa e quando o tem — e do pagamento ao download não volta a perguntar nada."
    ),
    primary: tr("Subir y diagnosticar", "Déposer et diagnostiquer", "Upload and diagnose", "Hochladen und diagnostizieren", "Enviar e diagnosticar"),
    secondary: tr("Ver utilidades", "Voir les utilités", "See the toolkit", "Werkzeuge ansehen", "Ver ferramentas"),
    micro: tr(
      "Pago seguro · precio cerrado desde 35 €/documento · sin compromiso",
      "Paiement sécurisé · prix ferme dès 35 €/document · sans engagement",
      "Secure payment · fixed price from €35/document · no commitment",
      "Sichere Zahlung · Festpreis ab 35 €/Dokument · unverbindlich",
      "Pagamento seguro · preço fechado desde 35 €/documento · sem compromisso"
    ),
  },
};
