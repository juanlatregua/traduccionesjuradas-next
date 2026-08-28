// lib/i18n/puerta.ts — Textos de "la puerta" (subida · diagnóstico · contacto ·
// checkout) en los 5 idiomas (es·fr·en·de·pt). Lo consume PuertaClient en cada
// home. El francófono (y ahora el anglófono/germano/lusófono) vive la promesa
// entera en su idioma.

import type { Locale } from "@/lib/i18n/locales";

export type PuertaLang = Locale;

export type PuertaStrings = {
  locale: string;
  cutoffBefore: (remaining: string) => string;
  cutoffAfter: string;
  neededByLabel: string;
  neededByHelp: string;
  neededForPrefix: string;
  totalLabel: (n: number) => string;
  addAnother: string;
  startOver: string;
  contactTitle: string;
  contactHelp: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  // Email pedido MIENTRAS corre el análisis: el spinner es tiempo muerto y el
  // usuario ya se comprometió subiendo el documento → se da sin fricción, sin
  // contradecir el "presupuesto instantáneo" de la portada.
  spinnerEmailTitle: string;
  spinnerEmailHelp: string;
  spinnerEmailReady: string;
  spinnerSeeQuote: string;
  // Casilla SEPARADA y no premarcada (LSSI art. 21.1): el consentimiento de la
  // subida solo cubre tratar los documentos, no enviar correo.
  marketingConsent: string;
  marketingRequired: string;
  continuePay: string;
  preparingPay: string;
  hintTargetLang: string;
  hintContact: string;
  checkoutErrorDefault: string;
  errorTitle: string;
  errorAskHuman: string;
  errorDefault: string;
  retry: string;
  contactWhatsApp: string;
  whatsappPrefill: string;
  gdprConsent: string;
  gdprPrivacyLink: string;
  dropTitle: string;
  dropHint: string;
  selectFile: string;
  takePhoto: string;
  scanGuidePre: string;
  scanGuideLink: string;
  uploading: string;
  errTooLarge: string;
  errGdpr: string;
  errUpload: string;
  errConn: string;
  ariaDrop: string;
  qSworn: string;
  qPrice: string;
  qDelivery: string;
  qValidity: string;
  pricePending: string;
  manualQuoteNote: string;
  humanQuoteNote: string;
  requestQuoteCta: string;
  requestQuoteSending: string;
  requestQuoteDone: string;
  requestQuoteDoneLavori: string;
  requestQuoteDoneAuto: string;
  preferHuman: string;
  orientativoSuffix: string;
  lowConfNote: string;
  ivaIncl: string;
  spanishDocAsk: string;
  deliveryEstimated: string;
  onTimeYes: string;
  onTimeNo: string;
  maecCredential: string;
  targetLanguages: { code: string; name: string }[];
};

const TARGETS_ES = [
  { code: "fr", name: "Francés" }, { code: "en", name: "Inglés" }, { code: "de", name: "Alemán" },
  { code: "it", name: "Italiano" }, { code: "pt", name: "Portugués" }, { code: "ar", name: "Árabe" },
];
const TARGETS_FR = [
  { code: "fr", name: "Français" }, { code: "en", name: "Anglais" }, { code: "de", name: "Allemand" },
  { code: "it", name: "Italien" }, { code: "pt", name: "Portugais" }, { code: "ar", name: "Arabe" },
];
const TARGETS_EN = [
  { code: "fr", name: "French" }, { code: "en", name: "English" }, { code: "de", name: "German" },
  { code: "it", name: "Italian" }, { code: "pt", name: "Portuguese" }, { code: "ar", name: "Arabic" },
];
const TARGETS_DE = [
  { code: "fr", name: "Französisch" }, { code: "en", name: "Englisch" }, { code: "de", name: "Deutsch" },
  { code: "it", name: "Italienisch" }, { code: "pt", name: "Portugiesisch" }, { code: "ar", name: "Arabisch" },
];
const TARGETS_PT = [
  { code: "fr", name: "Francês" }, { code: "en", name: "Inglês" }, { code: "de", name: "Alemão" },
  { code: "it", name: "Italiano" }, { code: "pt", name: "Português" }, { code: "ar", name: "Árabe" },
];

export const puertaT: Record<PuertaLang, PuertaStrings> = {
  es: {
    locale: "es-ES",
    cutoffBefore: (r) => `Pídela antes de las 18:00 y la ponemos en marcha hoy mismo — quedan ${r}.`,
    cutoffAfter: "La pondremos en marcha el próximo día laborable. El diagnóstico te confirma la fecha de entrega exacta.",
    neededByLabel: "¿Para cuándo lo necesitas?",
    neededByHelp: "Opcional. Nos ayuda a confirmarte si el plazo llega a tu fecha.",
    neededForPrefix: "Lo necesitas para el",
    totalLabel: (n) => `Total (${n} documentos)`,
    addAnother: "Añadir otro documento",
    startOver: "Empezar de nuevo",
    contactTitle: "¿Dónde te avisamos cuando esté lista?",
    contactHelp: "Te enviamos la confirmación y el aviso de entrega por email y WhatsApp.",
    emailPlaceholder: "tu@email.com",
    phonePlaceholder: "Teléfono",
    spinnerEmailTitle: "Mientras analizamos, ¿te guardamos el presupuesto?",
    spinnerEmailHelp: "Tu presupuesto aparece aquí en segundos. El email es para que no lo pierdas y puedas retomarlo.",
    spinnerEmailReady: "Tu presupuesto ya está listo.",
    spinnerSeeQuote: "Ver mi presupuesto",
    marketingConsent: "Quiero recibir mi presupuesto por email y un recordatorio si no llego a completarlo.",
    marketingRequired: "Marca la casilla para que podamos enviártelo.",
    continuePay: "Continuar al pago",
    preparingPay: "Preparando el pago…",
    hintTargetLang: "Indica el idioma de destino de cada documento para continuar.",
    hintContact: "Indica tu email y teléfono para continuar.",
    checkoutErrorDefault: "No se pudo continuar al pago.",
    errorTitle: "No hemos podido analizar el documento",
    errorAskHuman: "O deja tu email y te mandamos el presupuesto hoy: tu documento ya está subido.",
    errorDefault: "Ha ocurrido un error inesperado.",
    retry: "Intentar de nuevo",
    contactWhatsApp: "Contactar por WhatsApp",
    whatsappPrefill: "Hola, tengo una duda sobre un presupuesto de traducción jurada.",
    gdprConsent: "Consiento el tratamiento de mis documentos para generar un presupuesto de traducción jurada. Los documentos se eliminan automáticamente tras 30 días de la entrega.",
    gdprPrivacyLink: "Ver política de privacidad",
    dropTitle: "Arrastra tu documento aquí",
    dropHint: "PDF, foto o escaneo · Máx. 20 MB",
    selectFile: "Seleccionar archivo",
    takePhoto: "Tomar foto",
    scanGuidePre: "¿No sabes cómo escanear bien?",
    scanGuideLink: "Ver guía de 2 minutos",
    uploading: "Subiendo documento...",
    errTooLarge: "El archivo es demasiado grande. Máximo 20 MB.",
    errGdpr: "Debes aceptar el tratamiento de datos para continuar.",
    errUpload: "Error al subir el archivo.",
    errConn: "Error de conexión. Inténtalo de nuevo.",
    ariaDrop: "Arrastra tu documento aquí o haz clic para seleccionar",
    qSworn: "¿Necesita traducción jurada?",
    qPrice: "Precio",
    qDelivery: "Plazo de entrega",
    qValidity: "Validez",
    pricePending: "Indícanos abajo el idioma de destino y calculamos el precio.",
    manualQuoteNote:
      "Por su contenido, este documento necesita un presupuesto a medida. Escríbenos por WhatsApp y te lo preparamos al momento.",
    humanQuoteNote:
      "Documento analizado. En este idioma el precio te lo confirma directamente tu traductor jurado nombrado por el MAEC — normalmente hoy mismo. Si tienes prisa, escríbenos por WhatsApp.",
    requestQuoteCta: "Solicitar presupuesto — te respondemos hoy",
    requestQuoteSending: "Enviando solicitud…",
    requestQuoteDone: "Solicitud recibida. Tu traductor jurado te confirmará el precio en breve.",
    requestQuoteDoneLavori: "Tu documento ya está con un traductor jurado de {lang} del colectivo. Te enviamos el presupuesto en breve, normalmente en el día.",
    requestQuoteDoneAuto: "Tu presupuesto ya está enviado a tu email (o por SMS) con el precio cerrado y el enlace de pago. En cuanto pagues, tu traductor jurado empieza.",
    preferHuman: "Prefiero que me lo confirme el traductor",
    orientativoSuffix: "(orientativo)",
    lowConfNote: "No hemos podido leer el documento con seguridad. Confirmaremos el precio final antes de empezar.",
    ivaIncl: "IVA incluido",
    spanishDocAsk: "Tu documento está en español. ¿A qué idioma lo necesitas?",
    deliveryEstimated: "Entrega estimada:",
    onTimeYes: "Llega a la fecha que necesitas",
    onTimeNo: "Tu fecha es muy ajustada. Escríbenos y vemos cómo acelerarlo.",
    maecCredential: "La firma un traductor jurado acreditado por el MAEC — validez oficial.",
    targetLanguages: TARGETS_ES,
  },
  fr: {
    locale: "fr-FR",
    cutoffBefore: (r) => `Commandez avant 18h00 et nous la lançons aujourd'hui même — il reste ${r}.`,
    cutoffAfter: "Nous la lancerons le prochain jour ouvrable. Le diagnostic vous confirme la date de livraison exacte.",
    neededByLabel: "Pour quand en avez-vous besoin ?",
    neededByHelp: "Facultatif. Cela nous aide à confirmer si le délai correspond à votre date.",
    neededForPrefix: "Vous en avez besoin pour le",
    totalLabel: (n) => `Total (${n} documents)`,
    addAnother: "Ajouter un autre document",
    startOver: "Recommencer",
    contactTitle: "Où vous prévenons-nous quand elle sera prête ?",
    contactHelp: "Nous vous envoyons la confirmation et l'avis de livraison par email et WhatsApp.",
    emailPlaceholder: "votre@email.com",
    phonePlaceholder: "Téléphone",
    spinnerEmailTitle: "Pendant l'analyse, on vous garde le devis ?",
    spinnerEmailHelp: "Votre devis s'affiche ici en quelques secondes. L'e-mail sert à ne pas le perdre et à pouvoir le reprendre.",
    spinnerEmailReady: "Votre devis est prêt.",
    spinnerSeeQuote: "Voir mon devis",
    marketingConsent: "Je souhaite recevoir mon devis par e-mail et un rappel si je ne le finalise pas.",
    marketingRequired: "Cochez la case pour que nous puissions vous l'envoyer.",
    continuePay: "Continuer vers le paiement",
    preparingPay: "Préparation du paiement…",
    hintTargetLang: "Indiquez la langue cible de chaque document pour continuer.",
    hintContact: "Indiquez votre email et téléphone pour continuer.",
    checkoutErrorDefault: "Impossible de continuer vers le paiement.",
    errorTitle: "Nous n'avons pas pu analyser le document",
    errorAskHuman: "Ou laissez votre e-mail et nous vous envoyons le devis aujourd'hui : votre document est déjà transmis.",
    errorDefault: "Une erreur inattendue s'est produite.",
    retry: "Réessayer",
    contactWhatsApp: "Nous contacter sur WhatsApp",
    whatsappPrefill: "Bonjour, j'ai une question sur un devis de traduction assermentée.",
    gdprConsent: "Je consens au traitement de mes documents pour générer un devis de traduction assermentée. Les documents sont supprimés automatiquement 30 jours après la livraison.",
    gdprPrivacyLink: "Voir la politique de confidentialité",
    dropTitle: "Déposez votre document ici",
    dropHint: "PDF, photo ou scan · Max. 20 Mo",
    selectFile: "Sélectionner un fichier",
    takePhoto: "Prendre une photo",
    scanGuidePre: "Vous ne savez pas bien scanner ?",
    scanGuideLink: "Voir le guide de 2 minutes",
    uploading: "Envoi du document...",
    errTooLarge: "Le fichier est trop volumineux. Maximum 20 Mo.",
    errGdpr: "Vous devez accepter le traitement des données pour continuer.",
    errUpload: "Erreur lors de l'envoi du fichier.",
    errConn: "Erreur de connexion. Veuillez réessayer.",
    ariaDrop: "Déposez votre document ici ou cliquez pour sélectionner",
    qSworn: "Traduction assermentée requise ?",
    qPrice: "Prix",
    qDelivery: "Délai de livraison",
    qValidity: "Validité",
    pricePending: "Indiquez ci-dessous la langue cible et nous calculons le prix.",
    manualQuoteNote:
      "Par son contenu, ce document nécessite un devis sur mesure. Écrivez-nous sur WhatsApp et nous le préparons aussitôt.",
    humanQuoteNote:
      "Document analysé. Pour cette langue, le prix vous est confirmé directement par votre traducteur assermenté nommé par le MAEC — normalement aujourd'hui même. Pressé ? Écrivez-nous sur WhatsApp.",
    requestQuoteCta: "Demander un devis — réponse aujourd'hui",
    requestQuoteSending: "Envoi de la demande…",
    requestQuoteDone: "Demande reçue. Votre traducteur assermenté vous confirmera le prix très prochainement.",
    requestQuoteDoneLavori: "Votre document est déjà entre les mains d'un traducteur assermenté ({lang}) du collectif. Vous recevrez le devis très prochainement, en général dans la journée.",
    requestQuoteDoneAuto: "Votre devis est déjà envoyé à votre e-mail (ou par SMS) avec le prix ferme et le lien de paiement. Dès votre paiement, votre traducteur assermenté commence.",
    preferHuman: "Je préfère une confirmation du traducteur",
    orientativoSuffix: "(indicatif)",
    lowConfNote: "Nous n'avons pas pu lire le document avec certitude. Nous confirmerons le prix final avant de commencer.",
    ivaIncl: "TVA incluse",
    spanishDocAsk: "Votre document est en espagnol. Vers quelle langue le souhaitez-vous ?",
    deliveryEstimated: "Livraison estimée :",
    onTimeYes: "Arrive à la date dont vous avez besoin",
    onTimeNo: "Votre date est très serrée. Écrivez-nous et voyons comment l'accélérer.",
    maecCredential: "Réalisée par un traducteur assermenté accrédité par le MAEC — validité officielle.",
    targetLanguages: TARGETS_FR,
  },
  en: {
    locale: "en-GB",
    cutoffBefore: (r) => `Order before 6:00 p.m. and we'll start today — ${r} left.`,
    cutoffAfter: "We'll start it on the next business day. The diagnosis confirms your exact delivery date.",
    neededByLabel: "When do you need it by?",
    neededByHelp: "Optional. It helps us confirm whether the deadline meets your date.",
    neededForPrefix: "You need it by",
    totalLabel: (n) => `Total (${n} documents)`,
    addAnother: "Add another document",
    startOver: "Start over",
    contactTitle: "Where shall we notify you when it's ready?",
    contactHelp: "We'll send you the confirmation and delivery notice by email and WhatsApp.",
    emailPlaceholder: "you@email.com",
    phonePlaceholder: "Phone",
    spinnerEmailTitle: "While we analyse it, shall we save your quote?",
    spinnerEmailHelp: "Your quote appears here in seconds. The email is so you don't lose it and can pick it up later.",
    spinnerEmailReady: "Your quote is ready.",
    spinnerSeeQuote: "See my quote",
    marketingConsent: "I want to receive my quote by email and a reminder if I don't complete it.",
    marketingRequired: "Tick the box so we can send it to you.",
    continuePay: "Continue to payment",
    preparingPay: "Preparing payment…",
    hintTargetLang: "Select the target language of each document to continue.",
    hintContact: "Enter your email and phone to continue.",
    checkoutErrorDefault: "We couldn't continue to payment.",
    errorTitle: "We couldn't analyse the document",
    errorAskHuman: "Or leave your email and we'll send you the quote today: your document is already uploaded.",
    errorDefault: "An unexpected error occurred.",
    retry: "Try again",
    contactWhatsApp: "Contact us on WhatsApp",
    whatsappPrefill: "Hello, I have a question about a sworn translation quote.",
    gdprConsent: "I consent to the processing of my documents to generate a sworn translation quote. Documents are deleted automatically 30 days after delivery.",
    gdprPrivacyLink: "View privacy policy",
    dropTitle: "Drag your document here",
    dropHint: "PDF, photo or scan · Max. 20 MB",
    selectFile: "Select file",
    takePhoto: "Take a photo",
    scanGuidePre: "Not sure how to scan well?",
    scanGuideLink: "See the 2-minute guide",
    uploading: "Uploading document...",
    errTooLarge: "The file is too large. Maximum 20 MB.",
    errGdpr: "You must accept data processing to continue.",
    errUpload: "Error uploading the file.",
    errConn: "Connection error. Please try again.",
    ariaDrop: "Drag your document here or click to select",
    qSworn: "Does it need a sworn translation?",
    qPrice: "Price",
    qDelivery: "Delivery time",
    qValidity: "Validity",
    pricePending: "Tell us the target language below and we'll calculate the price.",
    manualQuoteNote:
      "Because of its content, this document needs a tailored quote. Message us on WhatsApp and we'll prepare it right away.",
    humanQuoteNote:
      "Document analysed. For this language, the price is confirmed directly by your MAEC-appointed sworn translator — usually the same day. In a hurry? Message us on WhatsApp.",
    requestQuoteCta: "Request a quote — we reply today",
    requestQuoteSending: "Sending request…",
    requestQuoteDone: "Request received. Your sworn translator will confirm the price shortly.",
    requestQuoteDoneLavori: "Your document is already with a sworn {lang} translator from the collective. We will send you the quote shortly, usually the same day.",
    requestQuoteDoneAuto: "Your quote has already been sent to your email (or by SMS) with the final price and the payment link. As soon as you pay, your sworn translator starts.",
    preferHuman: "I'd rather have the translator confirm it",
    orientativoSuffix: "(estimate)",
    lowConfNote: "We couldn't read the document with certainty. We'll confirm the final price before starting.",
    ivaIncl: "VAT included",
    spanishDocAsk: "Your document is in Spanish. Which language do you need it in?",
    deliveryEstimated: "Estimated delivery:",
    onTimeYes: "It meets the date you need",
    onTimeNo: "Your date is very tight. Write to us and we'll see how to speed it up.",
    maecCredential: "Signed by a sworn translator accredited by the MAEC — official validity.",
    targetLanguages: TARGETS_EN,
  },
  de: {
    locale: "de-DE",
    cutoffBefore: (r) => `Bestellen Sie vor 18:00 Uhr und wir starten noch heute — nur noch ${r}.`,
    cutoffAfter: "Wir starten am nächsten Werktag. Die Diagnose bestätigt Ihren genauen Liefertermin.",
    neededByLabel: "Bis wann brauchen Sie es?",
    neededByHelp: "Optional. So können wir bestätigen, ob der Termin zu Ihrem Datum passt.",
    neededForPrefix: "Sie brauchen es bis zum",
    totalLabel: (n) => `Gesamt (${n} Dokumente)`,
    addAnother: "Weiteres Dokument hinzufügen",
    startOver: "Neu beginnen",
    contactTitle: "Wo sollen wir Sie benachrichtigen, sobald Ihre Übersetzung fertig ist?",
    contactHelp: "Wir senden Ihnen die Bestätigung und die Liefermitteilung per E-Mail und WhatsApp.",
    emailPlaceholder: "ihre@email.de",
    phonePlaceholder: "Telefon",
    spinnerEmailTitle: "Sollen wir Ihnen den Kostenvoranschlag während der Analyse speichern?",
    spinnerEmailHelp: "Ihr Kostenvoranschlag erscheint hier in Sekunden. Die E-Mail dient dazu, ihn nicht zu verlieren.",
    spinnerEmailReady: "Ihr Kostenvoranschlag ist fertig.",
    spinnerSeeQuote: "Kostenvoranschlag ansehen",
    marketingConsent: "Ich möchte meinen Kostenvoranschlag per E-Mail erhalten und eine Erinnerung, falls ich ihn nicht abschließe.",
    marketingRequired: "Bitte kreuzen Sie das Kästchen an, damit wir ihn senden können.",
    continuePay: "Weiter zur Zahlung",
    preparingPay: "Zahlung wird vorbereitet…",
    hintTargetLang: "Wählen Sie die Zielsprache jedes Dokuments, um fortzufahren.",
    hintContact: "Geben Sie Ihre E-Mail und Ihr Telefon ein, um fortzufahren.",
    checkoutErrorDefault: "Weiterleitung zur Zahlung nicht möglich.",
    errorTitle: "Wir konnten das Dokument nicht analysieren",
    errorAskHuman: "Oder hinterlassen Sie Ihre E-Mail und wir schicken Ihnen das Angebot heute: Ihr Dokument ist bereits hochgeladen.",
    errorDefault: "Ein unerwarteter Fehler ist aufgetreten.",
    retry: "Erneut versuchen",
    contactWhatsApp: "Über WhatsApp kontaktieren",
    whatsappPrefill: "Hallo, ich habe eine Frage zu einem Angebot für eine beglaubigte Übersetzung.",
    gdprConsent: "Ich willige in die Verarbeitung meiner Dokumente ein, um ein Angebot für eine beglaubigte Übersetzung zu erstellen. Die Dokumente werden 30 Tage nach der Lieferung automatisch gelöscht.",
    gdprPrivacyLink: "Datenschutzerklärung ansehen",
    dropTitle: "Ziehen Sie Ihr Dokument hierher",
    dropHint: "PDF, Foto oder Scan · Max. 20 MB",
    selectFile: "Datei auswählen",
    takePhoto: "Foto aufnehmen",
    scanGuidePre: "Unsicher, wie man richtig scannt?",
    scanGuideLink: "2-Minuten-Anleitung ansehen",
    uploading: "Dokument wird hochgeladen...",
    errTooLarge: "Die Datei ist zu groß. Maximal 20 MB.",
    errGdpr: "Sie müssen der Datenverarbeitung zustimmen, um fortzufahren.",
    errUpload: "Fehler beim Hochladen der Datei.",
    errConn: "Verbindungsfehler. Bitte versuchen Sie es erneut.",
    ariaDrop: "Ziehen Sie Ihr Dokument hierher oder klicken Sie zum Auswählen",
    qSworn: "Ist eine beglaubigte Übersetzung nötig?",
    qPrice: "Preis",
    qDelivery: "Lieferzeit",
    qValidity: "Gültigkeit",
    pricePending: "Geben Sie unten die Zielsprache an, und wir berechnen den Preis.",
    manualQuoteNote:
      "Aufgrund seines Inhalts braucht dieses Dokument ein individuelles Angebot. Schreiben Sie uns per WhatsApp und wir erstellen es sofort.",
    humanQuoteNote:
      "Dokument analysiert. Für diese Sprache bestätigt Ihnen Ihr vom MAEC ermächtigter vereidigter Übersetzer den Preis direkt — normalerweise noch am selben Tag. Eilig? Schreiben Sie uns per WhatsApp.",
    requestQuoteCta: "Angebot anfordern — Antwort noch heute",
    requestQuoteSending: "Anfrage wird gesendet…",
    requestQuoteDone: "Anfrage erhalten. Ihr vereidigter Übersetzer bestätigt Ihnen den Preis in Kürze.",
    requestQuoteDoneLavori: "Ihr Dokument liegt bereits einem vereidigten Übersetzer ({lang}) des Kollektivs vor. Sie erhalten das Angebot in Kürze, in der Regel noch am selben Tag.",
    requestQuoteDoneAuto: "Ihr Angebot wurde bereits an Ihre E-Mail (oder per SMS) gesendet – mit Festpreis und Zahlungslink. Sobald Sie bezahlen, beginnt Ihr vereidigter Übersetzer.",
    preferHuman: "Ich möchte lieber die Bestätigung des Übersetzers",
    orientativoSuffix: "(Richtwert)",
    lowConfNote: "Wir konnten das Dokument nicht sicher lesen. Wir bestätigen den Endpreis vor Beginn.",
    ivaIncl: "inkl. MwSt.",
    spanishDocAsk: "Ihr Dokument ist auf Spanisch. In welche Sprache brauchen Sie es?",
    deliveryEstimated: "Voraussichtliche Lieferung:",
    onTimeYes: "Erreicht das von Ihnen benötigte Datum",
    onTimeNo: "Ihr Datum ist sehr knapp. Schreiben Sie uns, wir sehen, wie wir es beschleunigen.",
    maecCredential: "Von einem vom MAEC ermächtigten vereidigten Übersetzer unterschrieben — amtlich gültig.",
    targetLanguages: TARGETS_DE,
  },
  pt: {
    locale: "pt-PT",
    cutoffBefore: (r) => `Peça antes das 18:00 e começamos hoje mesmo — faltam ${r}.`,
    cutoffAfter: "Começamos no próximo dia útil. O diagnóstico confirma a data de entrega exata.",
    neededByLabel: "Para quando precisa da tradução?",
    neededByHelp: "Opcional. Ajuda-nos a confirmar se cumprimos a data de que precisa.",
    neededForPrefix: "Precisa para o dia",
    totalLabel: (n) => `Total (${n} documentos)`,
    addAnother: "Adicionar outro documento",
    startOver: "Recomeçar",
    contactTitle: "Onde o avisamos quando estiver pronta?",
    contactHelp: "Enviamos a confirmação e o aviso de entrega por email e WhatsApp.",
    emailPlaceholder: "o-seu@email.com",
    phonePlaceholder: "Telefone",
    spinnerEmailTitle: "Enquanto analisamos, guardamos-lhe o orçamento?",
    spinnerEmailHelp: "O seu orçamento aparece aqui em segundos. O email é para não o perder e poder retomá-lo.",
    spinnerEmailReady: "O seu orçamento já está pronto.",
    spinnerSeeQuote: "Ver o meu orçamento",
    marketingConsent: "Quero receber o meu orçamento por email e um lembrete se não o concluir.",
    marketingRequired: "Assinale a caixa para lho podermos enviar.",
    continuePay: "Continuar para o pagamento",
    preparingPay: "A preparar o pagamento…",
    hintTargetLang: "Indique o idioma de destino de cada documento para continuar.",
    hintContact: "Indique o seu email e telefone para continuar.",
    checkoutErrorDefault: "Não foi possível continuar para o pagamento.",
    errorTitle: "Não conseguimos analisar o documento",
    errorAskHuman: "Ou deixe o seu email e enviamos-lhe o orçamento hoje: o seu documento já está carregado.",
    errorDefault: "Ocorreu um erro inesperado.",
    retry: "Tentar novamente",
    contactWhatsApp: "Contactar por WhatsApp",
    whatsappPrefill: "Olá, tenho uma dúvida sobre um orçamento de tradução certificada.",
    gdprConsent: "Consinto o tratamento dos meus documentos para gerar um orçamento de tradução certificada. Os documentos são eliminados automaticamente 30 dias após a entrega.",
    gdprPrivacyLink: "Ver política de privacidade",
    dropTitle: "Arraste o seu documento aqui",
    dropHint: "PDF, foto ou digitalização · Máx. 20 MB",
    selectFile: "Selecionar ficheiro",
    takePhoto: "Tirar foto",
    scanGuidePre: "Não sabe como digitalizar bem?",
    scanGuideLink: "Ver guia de 2 minutos",
    uploading: "A enviar documento...",
    errTooLarge: "O ficheiro é demasiado grande. Máximo 20 MB.",
    errGdpr: "Tem de aceitar o tratamento de dados para continuar.",
    errUpload: "Erro ao enviar o ficheiro.",
    errConn: "Erro de ligação. Tente novamente.",
    ariaDrop: "Arraste o seu documento aqui ou clique para selecionar",
    qSworn: "Precisa de tradução certificada?",
    qPrice: "Preço",
    qDelivery: "Prazo de entrega",
    qValidity: "Validade",
    pricePending: "Indique abaixo o idioma de destino e calculamos o preço.",
    manualQuoteNote:
      "Pelo seu conteúdo, este documento precisa de um orçamento à medida. Escreva-nos pelo WhatsApp e preparamo-lo de imediato.",
    humanQuoteNote:
      "Documento analisado. Nesta língua o preço é confirmado diretamente pelo seu tradutor ajuramentado nomeado pelo MAEC — normalmente no próprio dia. Com pressa? Escreva-nos pelo WhatsApp.",
    requestQuoteCta: "Pedir orçamento — respondemos hoje",
    requestQuoteSending: "A enviar o pedido…",
    requestQuoteDone: "Pedido recebido. O seu tradutor ajuramentado confirmará o preço em breve.",
    requestQuoteDoneLavori: "O seu documento já está com um tradutor ajuramentado de {lang} do coletivo. Enviamos-lhe o orçamento em breve, normalmente no próprio dia.",
    requestQuoteDoneAuto: "O seu orçamento já foi enviado para o seu email (ou por SMS) com o preço fechado e o link de pagamento. Assim que pagar, o seu tradutor ajuramentado começa.",
    preferHuman: "Prefiro a confirmação do tradutor",
    orientativoSuffix: "(indicativo)",
    lowConfNote: "Não conseguimos ler o documento com segurança. Confirmaremos o preço final antes de começar.",
    ivaIncl: "IVA incluído",
    spanishDocAsk: "O seu documento está em espanhol. Para que idioma o precisa?",
    deliveryEstimated: "Entrega estimada:",
    onTimeYes: "Cumpre a data de que precisa",
    onTimeNo: "A sua data é muito apertada. Escreva-nos e vemos como acelerar.",
    maecCredential: "Assinada por um tradutor ajuramentado acreditado pelo MAEC — validade oficial.",
    targetLanguages: TARGETS_PT,
  },
};
