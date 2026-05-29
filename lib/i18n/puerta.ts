// lib/i18n/puerta.ts — Textos de "la puerta" (v2 · Fase 3 · idioma).
// ES por defecto (el home español no cambia); FR para la landing francesa.

export type PuertaLang = "es" | "fr";

export type PuertaStrings = {
  locale: string;
  // DeadlineCountdown
  cutoffBefore: (remaining: string) => string;
  cutoffAfter: string;
  // PuertaClient — entrada
  neededByLabel: string;
  neededByHelp: string;
  neededForPrefix: string;
  // PuertaClient — diagnóstico
  totalLabel: (n: number) => string;
  addAnother: string;
  startOver: string;
  contactTitle: string;
  contactHelp: string;
  emailPlaceholder: string;
  phonePlaceholder: string;
  continuePay: string;
  preparingPay: string;
  hintTargetLang: string;
  hintContact: string;
  checkoutErrorDefault: string;
  // PuertaClient — error
  errorTitle: string;
  errorDefault: string;
  retry: string;
  contactWhatsApp: string;
  whatsappPrefill: string;
  // DocumentUploader
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
  // DiagnosisCard
  qSworn: string;
  qPrice: string;
  qDelivery: string;
  qValidity: string;
  pricePending: string;
  orientativoSuffix: string;
  lowConfNote: string;
  ivaIncl: string;
  spanishDocAsk: string;
  deliveryEstimated: string;
  onTimeYes: string;
  onTimeNo: string;
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
    continuePay: "Continuar al pago",
    preparingPay: "Preparando el pago…",
    hintTargetLang: "Indica el idioma de destino de cada documento para continuar.",
    hintContact: "Indica tu email y teléfono para continuar.",
    checkoutErrorDefault: "No se pudo continuar al pago.",
    errorTitle: "No hemos podido analizar el documento",
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
    orientativoSuffix: "(orientativo)",
    lowConfNote: "No hemos podido leer el documento con seguridad. Confirmaremos el precio final antes de empezar.",
    ivaIncl: "IVA incluido",
    spanishDocAsk: "Tu documento está en español. ¿A qué idioma lo necesitas?",
    deliveryEstimated: "Entrega estimada:",
    onTimeYes: "Llega a la fecha que necesitas",
    onTimeNo: "Tu fecha es muy ajustada. Escríbenos y vemos cómo acelerarlo.",
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
    continuePay: "Continuer vers le paiement",
    preparingPay: "Préparation du paiement…",
    hintTargetLang: "Indiquez la langue cible de chaque document pour continuer.",
    hintContact: "Indiquez votre email et téléphone pour continuer.",
    checkoutErrorDefault: "Impossible de continuer vers le paiement.",
    errorTitle: "Nous n'avons pas pu analyser le document",
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
    orientativoSuffix: "(indicatif)",
    lowConfNote: "Nous n'avons pas pu lire le document avec certitude. Nous confirmerons le prix final avant de commencer.",
    ivaIncl: "TVA incluse",
    spanishDocAsk: "Votre document est en espagnol. Vers quelle langue le souhaitez-vous ?",
    deliveryEstimated: "Livraison estimée :",
    onTimeYes: "Arrive à la date dont vous avez besoin",
    onTimeNo: "Votre date est très serrée. Écrivez-nous et voyons comment l'accélérer.",
    targetLanguages: TARGETS_FR,
  },
};
