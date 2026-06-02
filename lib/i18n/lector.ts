// lib/i18n/lector.ts — Copy del Lector de requerimientos en 5 idiomas.
//
// Patrón de inversión: cada texto se define UNA vez con sus 5 traducciones
// (tr() devuelve Tr → TS obliga a cubrir es/fr/en/de/pt) y se invierte a
// `lectorT[lang]`. Los textos de la zona de subida los aporta DocumentUploader
// vía puertaT; aquí solo el marco del lector + disclaimers YMYL.

import { LOCALES, type Locale, type Tr } from "@/lib/i18n/locales";

const tr = (es: string, fr: string, en: string, de: string, pt: string): Tr => ({
  es,
  fr,
  en,
  de,
  pt,
});

const FIELDS = {
  // ── Meta / hero ────────────────────────────────────────────────
  metaTitle: tr(
    "¿Qué traducciones necesitas para tu trámite? · Lector de cartas oficiales",
    "Quelles traductions pour votre démarche ? · Lecteur de courriers officiels",
    "Official Letter Reader — what translations do you need?",
    "Behördenbrief-Leser — welche Übersetzungen brauchen Sie?",
    "Leitor de notificações — que traduções precisa?"
  ),
  metaDescription: tr(
    "Sube la carta o notificación de la administración y te explicamos en claro qué documentos te piden, cuáles necesitan traducción jurada y qué legalización puede aplicar. Gratis.",
    "Déposez le courrier de l'administration et nous vous expliquons clairement quels documents on vous demande, lesquels exigent une traduction assermentée et quelle légalisation peut s'appliquer. Gratuit.",
    "Upload the official letter and we'll explain plainly which documents you're asked for, which need a sworn translation, and what legalisation may apply. Free.",
    "Laden Sie das behördliche Schreiben hoch und wir erklären klar, welche Dokumente verlangt werden, welche eine beglaubigte Übersetzung brauchen und welche Legalisation gelten könnte. Kostenlos.",
    "Envie a notificação da administração e explicamos com clareza que documentos lhe pedem, quais precisam de tradução certificada e que legalização se pode aplicar. Grátis."
  ),
  h1: tr(
    "¿Qué te pide este papel oficial?",
    "Que vous demande ce courrier officiel ?",
    "What is this official letter asking for?",
    "Was verlangt dieser Behördenbrief?",
    "O que lhe pede esta notificação oficial?"
  ),
  heroSub: tr(
    "Sube la carta o notificación y te explicamos en tu idioma qué documentos te piden, cuáles necesitan traducción jurada y qué hacer después. Sin tecnicismos.",
    "Déposez le courrier et nous vous expliquons, dans votre langue, quels documents on vous demande, lesquels exigent une traduction assermentée et quoi faire ensuite. Sans jargon.",
    "Upload the letter and we'll explain, in your language, which documents you need, which require a sworn translation and what to do next. No jargon.",
    "Laden Sie das Schreiben hoch und wir erklären Ihnen in Ihrer Sprache, welche Dokumente Sie brauchen, welche eine beglaubigte Übersetzung erfordern und was als Nächstes zu tun ist. Ohne Fachjargon.",
    "Envie a carta e explicamos, no seu idioma, que documentos precisa, quais exigem tradução certificada e o que fazer a seguir. Sem tecnicismos."
  ),
  uploadHeading: tr(
    "Sube tu carta o notificación",
    "Déposez votre courrier ou notification",
    "Upload your letter or notice",
    "Laden Sie Ihr Schreiben oder Ihre Mitteilung hoch",
    "Envie a sua carta ou notificação"
  ),

  // ── Estados ────────────────────────────────────────────────────
  analyzing: tr(
    "Leyendo tu carta…",
    "Lecture de votre courrier…",
    "Reading your letter…",
    "Ihr Schreiben wird gelesen…",
    "A ler a sua carta…"
  ),
  errorTitle: tr(
    "No hemos podido leer tu carta",
    "Nous n'avons pas pu lire votre courrier",
    "We couldn't read your letter",
    "Wir konnten Ihr Schreiben nicht lesen",
    "Não conseguimos ler a sua carta"
  ),
  retry: tr(
    "Probar con otro archivo",
    "Essayer un autre fichier",
    "Try another file",
    "Andere Datei versuchen",
    "Tentar outro ficheiro"
  ),
  whatsappCta: tr(
    "Escríbenos por WhatsApp",
    "Écrivez-nous sur WhatsApp",
    "Message us on WhatsApp",
    "Schreiben Sie uns auf WhatsApp",
    "Fale connosco no WhatsApp"
  ),
  capTitle: tr(
    "Ahora mismo hay mucha demanda",
    "Forte affluence en ce moment",
    "High demand right now",
    "Derzeit hohe Nachfrage",
    "Muita procura neste momento"
  ),
  capBody: tr(
    "Súbenos tu carta por WhatsApp o email y te respondemos a mano en breve.",
    "Envoyez-nous votre courrier par WhatsApp ou e-mail et nous vous répondons à la main rapidement.",
    "Send us your letter by WhatsApp or email and we'll reply by hand shortly.",
    "Senden Sie uns Ihr Schreiben per WhatsApp oder E-Mail und wir antworten Ihnen in Kürze persönlich.",
    "Envie-nos a sua carta por WhatsApp ou email e respondemos à mão em breve."
  ),

  // ── Resultado ──────────────────────────────────────────────────
  bannerYmyl: tr(
    "Esta lectura se basa únicamente en el texto de tu carta. Puede haber requisitos que el organismo no detalle por escrito. No es asesoramiento jurídico: confirma siempre con el organismo.",
    "Cette lecture se fonde uniquement sur le texte de votre courrier. Il peut exister des exigences que l'administration ne détaille pas par écrit. Ce n'est pas un conseil juridique : confirmez toujours auprès de l'organisme.",
    "This reading is based only on the text of your letter. There may be requirements the authority doesn't spell out. This is not legal advice: always confirm with the authority.",
    "Diese Auswertung beruht ausschließlich auf dem Text Ihres Schreibens. Es kann Anforderungen geben, die die Behörde nicht schriftlich nennt. Dies ist keine Rechtsberatung: Bestätigen Sie immer bei der Behörde.",
    "Esta leitura baseia-se apenas no texto da sua carta. Pode haver requisitos que o organismo não detalhe por escrito. Não é aconselhamento jurídico: confirme sempre com o organismo."
  ),
  summaryEyebrow: tr(
    "Esto es lo que hemos leído",
    "Voici ce que nous avons lu",
    "Here's what we read",
    "Das haben wir gelesen",
    "Isto foi o que lemos"
  ),
  procedureLabel: tr("Trámite", "Démarche", "Procedure", "Verfahren", "Trâmite"),
  authorityLabel: tr("Organismo", "Organisme", "Authority", "Behörde", "Organismo"),
  docsHeading: tr(
    "Lo que tu carta pide",
    "Ce que votre courrier demande",
    "What your letter asks for",
    "Was Ihr Schreiben verlangt",
    "O que a sua carta pede"
  ),
  translationLabel: tr("Traducción", "Traduction", "Translation", "Übersetzung", "Tradução"),
  copiesLabel: tr("copias", "copies", "copies", "Exemplare", "cópias"),

  swornLikely: tr(
    "Parece exigir traducción jurada",
    "Semble exiger une traduction assermentée",
    "Appears to require a sworn translation",
    "Scheint eine beglaubigte Übersetzung zu verlangen",
    "Parece exigir tradução certificada"
  ),
  swornPossibly: tr(
    "Podría necesitar traducción jurada",
    "Pourrait nécessiter une traduction assermentée",
    "May need a sworn translation",
    "Könnte eine beglaubigte Übersetzung benötigen",
    "Pode precisar de tradução certificada"
  ),
  swornNot: tr(
    "No parece exigir jurada",
    "Ne semble pas exiger d'assermentée",
    "Doesn't appear to require a sworn one",
    "Scheint keine beglaubigte zu verlangen",
    "Não parece exigir certificada"
  ),
  swornUnclear: tr(
    "Sin determinar — verifícalo",
    "Indéterminé — à vérifier",
    "Unclear — verify it",
    "Unklar — bitte prüfen",
    "Indeterminado — verifique"
  ),
  evidenceLabel: tr(
    "Lo que dice tu carta:",
    "Ce que dit votre courrier :",
    "What your letter says:",
    "Was Ihr Schreiben sagt:",
    "O que diz a sua carta:"
  ),

  legApostille: tr(
    "Posible apostilla",
    "Apostille possible",
    "Possible apostille",
    "Mögliche Apostille",
    "Possível apostila"
  ),
  legConsular: tr(
    "Posible legalización consular",
    "Légalisation consulaire possible",
    "Possible consular legalisation",
    "Mögliche konsularische Legalisation",
    "Possível legalização consular"
  ),
  legEuExempt: tr(
    "Posible exención UE",
    "Exemption UE possible",
    "Possible EU exemption",
    "Mögliche EU-Befreiung",
    "Possível isenção UE"
  ),
  legVerify: tr(
    "Legalización: verifícala",
    "Légalisation : à vérifier",
    "Legalisation: verify",
    "Legalisation: prüfen",
    "Legalização: verifique"
  ),
  inlineDisclaimer: tr(
    "Orientativo — confírmalo con el organismo.",
    "À titre indicatif — confirmez auprès de l'organisme.",
    "For guidance only — confirm with the authority.",
    "Nur als Orientierung — bei der Behörde bestätigen.",
    "A título indicativo — confirme com o organismo."
  ),
  hcchReviewed: tr(
    "Régimen de legalización verificado el",
    "Régime de légalisation vérifié le",
    "Legalisation status checked on",
    "Legalisationsregime geprüft am",
    "Regime de legalização verificado a"
  ),

  deadlineHeading: tr("Plazo", "Délai", "Deadline", "Frist", "Prazo"),
  deadlineConfirm: tr(
    "Calcula el plazo desde tu fecha de recepción y confírmalo con el organismo.",
    "Calculez le délai à partir de votre date de réception et confirmez-le auprès de l'organisme.",
    "Work out the deadline from your date of receipt and confirm it with the authority.",
    "Berechnen Sie die Frist ab Ihrem Empfangsdatum und bestätigen Sie sie bei der Behörde.",
    "Calcule o prazo a partir da sua data de receção e confirme com o organismo."
  ),

  nextStepsHeading: tr(
    "Tus próximos pasos",
    "Vos prochaines étapes",
    "Your next steps",
    "Ihre nächsten Schritte",
    "Os seus próximos passos"
  ),
  ctaOrder: tr(
    "Pedir estas traducciones",
    "Demander ces traductions",
    "Order these translations",
    "Diese Übersetzungen anfragen",
    "Pedir estas traduções"
  ),
  leftOutLabel: tr(
    "Esto también te lo piden, pero no es una traducción que hagamos nosotros:",
    "On vous demande aussi ceci, mais ce n'est pas une traduction que nous réalisons :",
    "You're also asked for this, but it's not a translation we handle:",
    "Dies wird ebenfalls verlangt, ist aber keine Übersetzung, die wir anbieten:",
    "Também lhe pedem isto, mas não é uma tradução que façamos:"
  ),

  notReqTitle: tr(
    "Esto parece un documento, no una notificación",
    "Ceci ressemble à un document, pas à une notification",
    "This looks like a document, not a notice",
    "Das sieht nach einem Dokument aus, nicht nach einer Mitteilung",
    "Isto parece um documento, não uma notificação"
  ),
  notReqBody: tr(
    "Si lo que tienes es el documento a traducir (un certificado, un título…), diagnostícalo y te damos precio y plazo al instante.",
    "Si vous avez le document à traduire (un acte, un diplôme…), diagnostiquez-le et nous vous donnons prix et délai aussitôt.",
    "If what you have is the document to be translated (a certificate, a degree…), diagnose it and we'll give you price and time instantly.",
    "Wenn Sie das zu übersetzende Dokument haben (eine Urkunde, ein Diplom…), diagnostizieren Sie es und wir nennen sofort Preis und Frist.",
    "Se o que tem é o documento a traduzir (uma certidão, um diploma…), diagnostique-o e damos-lhe preço e prazo na hora."
  ),
  ctaDiagnose: tr(
    "Diagnosticar mi documento",
    "Diagnostiquer mon document",
    "Diagnose my document",
    "Mein Dokument diagnostizieren",
    "Diagnosticar o meu documento"
  ),
  backCta: tr(
    "Leer otra carta",
    "Lire un autre courrier",
    "Read another letter",
    "Weiteres Schreiben lesen",
    "Ler outra carta"
  ),

  footerDisclaimer: tr(
    "Herramienta gratuita de orientación. La lectura se basa solo en el texto que subes y puede contener errores; no sustituye el criterio del organismo competente ni constituye asesoramiento jurídico. Verifica siempre los requisitos de apostilla, legalización y traducción jurada con la administración correspondiente.",
    "Outil d'orientation gratuit. La lecture se fonde uniquement sur le texte que vous déposez et peut contenir des erreurs ; elle ne remplace pas l'appréciation de l'organisme compétent et ne constitue pas un conseil juridique. Vérifiez toujours les exigences d'apostille, de légalisation et de traduction assermentée auprès de l'administration concernée.",
    "Free guidance tool. The reading is based only on the text you upload and may contain errors; it does not replace the competent authority's judgement and is not legal advice. Always verify apostille, legalisation and sworn-translation requirements with the relevant administration.",
    "Kostenloses Orientierungswerkzeug. Die Auswertung beruht nur auf dem hochgeladenen Text und kann Fehler enthalten; sie ersetzt nicht die Beurteilung der zuständigen Behörde und ist keine Rechtsberatung. Prüfen Sie Anforderungen an Apostille, Legalisation und beglaubigte Übersetzung stets bei der zuständigen Verwaltung.",
    "Ferramenta gratuita de orientação. A leitura baseia-se apenas no texto que envia e pode conter erros; não substitui o critério do organismo competente nem constitui aconselhamento jurídico. Verifique sempre os requisitos de apostila, legalização e tradução certificada junto da administração correspondente."
  ),
  verifyLinkHcch: tr(
    "Convenio de La Haya (HCCH)",
    "Convention de La Haye (HCCH)",
    "Hague Convention (HCCH)",
    "Haager Übereinkommen (HCCH)",
    "Convenção de Haia (HCCH)"
  ),
  verifyLinkMaec: tr(
    "MAEC · legalizaciones",
    "MAEC · légalisations",
    "MAEC · legalisations",
    "MAEC · Legalisationen",
    "MAEC · legalizações"
  ),
} satisfies Record<string, Tr>;

export type LectorStrings = { [K in keyof typeof FIELDS]: string };
export type LectorLang = Locale;

export const lectorT = Object.fromEntries(
  LOCALES.map((l) => [
    l,
    Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v[l]])),
  ])
) as Record<Locale, LectorStrings>;
