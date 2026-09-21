// lib/quote-public-i18n.ts — La página pública del presupuesto, en tres idiomas.
//
// Hasta hoy (19-sep-2026) el enlace que se manda al cliente estaba SOLO en
// español, aunque el PDF ya podía salir en seis idiomas desde el 21-ago. Y la
// cartera de clientes no es española: Walid (neerlandés), Dridi (Túnez),
// Sasan (Irán), Kashif (Arabia Saudí), Yasmine (Alemania), YOU YIXUAN (China)…
// A todos se les mandaba un enlace que no podían leer, justo en la pantalla
// donde deciden si pagan.
//
// El idioma sale de Quote.pdfLang, que Juan ya elige al montar el presupuesto:
// una sola decisión manda sobre el PDF y sobre la web. Lo que no sea es/fr cae a
// inglés, que es la lengua franca de sus clientes extranjeros.

export type PublicLang = "es" | "en" | "fr";

/** es y fr tal cual; cualquier otro idioma (de, it, pt…) se atiende en inglés. */
export function pickPublicLang(pdfLang: string | null | undefined): PublicLang {
  const l = String(pdfLang || "").trim().toLowerCase();
  if (l === "es" || !l) return "es";
  if (l === "fr") return "fr";
  return "en";
}

/** Locale para fechas e importes coherente con el idioma elegido. */
export function localeFor(lang: PublicLang): string {
  return lang === "en" ? "en-GB" : lang === "fr" ? "fr-FR" : "es-ES";
}

export type PublicDict = {
  quote: string;
  swornTranslation: string;
  status: string;
  validUntil: string;
  paidOk: string;
  canceled: string;
  detail: string;
  client: string;
  clientProtected: string;
  languages: string;
  delivery: string;
  deliveryPaper: string;
  deliveryDigital: string;
  holders: string;
  translatorIntro: string;
  translatorSworn: string;
  translatorNumber: string;
  translatorAppointed: string;
  ourNetwork: string;
  colDescription: string;
  colQty: string;
  colPrice: string;
  colTotal: string;
  viewDocument: string;
  download: string;
  summary: string;
  subtotal: string;
  discount: string;
  shipping: string;
  vat: string;
  total: string;
  paperIncluded: string;
  yourDocuments: string;
  pdfTitle: string;
  pdfOpen: string;
  pdfPending: string;
  payHow: string;
  tabBizum: string;
  tabTransfer: string;
  tabCard: string;
  transferDo: string;
  beneficiary: string;
  iban: string;
  bic: string;
  beneficiaryAddress: string;
  bankAddress: string;
  concept: string;
  conceptHint: string;
  sepaNote: string;
  alreadyTransferred: string;
  alreadyTransferredHelp: string;
  alreadyTransferredCta: string;
  proofStepTitle: string;
  proofStepHelp: string;
  oneMoment: string;
  payCard: string;
  redirecting: string;
  cardNote: string;
  notPayable: string;
  errPay: string;
  errContinue: string;
  copied: string;
};

const ES: PublicDict = {
  quote: "Presupuesto",
  swornTranslation: "Traducción jurada",
  status: "Estado",
  validUntil: "Validez hasta",
  paidOk: "Pago recibido correctamente. Te hemos enviado confirmación por email.",
  canceled: "Pago cancelado. Puedes intentarlo de nuevo cuando quieras.",
  detail: "Detalle",
  client: "Cliente",
  clientProtected: "Datos protegidos",
  languages: "Idiomas",
  delivery: "Entrega",
  deliveryPaper: "Papel con envío 24/48h",
  deliveryDigital: "PDF digital firmado",
  holders: "Titulares",
  translatorIntro: "Su traducción la realiza",
  translatorSworn: "traductor/a-intérprete jurado/a",
  translatorNumber: "nº",
  translatorAppointed: "nombrado/a por el Ministerio de Asuntos Exteriores.",
  ourNetwork: "Conozca nuestra red directa →",
  colDescription: "Descripción",
  colQty: "Cant.",
  colPrice: "Precio",
  colTotal: "Total",
  viewDocument: "ver documento",
  download: "descargar",
  summary: "Resumen",
  subtotal: "Subtotal",
  discount: "Descuento",
  shipping: "Envío",
  vat: "IVA",
  total: "Total",
  paperIncluded: "El envío en papel (12 € + IVA) está incluido en el total.",
  yourDocuments: "Sus documentos",
  pdfTitle: "PDF del presupuesto",
  pdfOpen: "Abrir / descargar PDF completo",
  pdfPending: "El PDF final se mostrará en cuanto el presupuesto sea confirmado por el equipo.",
  payHow: "Forma de pago",
  tabBizum: "Bizum",
  tabTransfer: "Transferencia",
  tabCard: "Tarjeta",
  transferDo: "Realiza una transferencia por",
  beneficiary: "Beneficiario",
  iban: "IBAN",
  bic: "BIC/SWIFT",
  beneficiaryAddress: "Dirección del beneficiario",
  bankAddress: "Dirección del banco",
  concept: "Concepto",
  conceptHint: "Indica el número de presupuesto en el concepto. Se confirma en menos de 24 h laborables.",
  sepaNote:
    "Desde fuera de la zona SEPA: transferencia SWIFT en EUR con BIC, IBAN y las direcciones de arriba (gastos compartidos, SHA).",
  alreadyTransferred: "¿Ya has hecho la transferencia?",
  alreadyTransferredHelp: "Súbenos el justificante y la confirmamos nosotros. Solo tarda un momento.",
  alreadyTransferredCta: "Ya he transferido: subir justificante",
  proofStepTitle: "¿Ya has pagado? Sube aquí tu justificante",
  proofStepHelp: "Pulsa el botón y adjunta el justificante de tu transferencia o Bizum. Con eso terminamos tu pedido.",
  oneMoment: "Un momento...",
  payCard: "Pagar",
  redirecting: "Redirigiendo...",
  cardNote: "Pago seguro con tarjeta de crédito o débito (según disponibilidad).",
  notPayable: "Este presupuesto no admite pago en su estado actual.",
  errPay: "No se pudo iniciar el pago.",
  errContinue: "No se pudo continuar.",
  copied: "Copiado",
};

const EN: PublicDict = {
  quote: "Quote",
  swornTranslation: "Sworn translation",
  status: "Status",
  validUntil: "Valid until",
  paidOk: "Payment received. We have sent you a confirmation by email.",
  canceled: "Payment cancelled. You can try again whenever you like.",
  detail: "Details",
  client: "Client",
  clientProtected: "Data protected",
  languages: "Languages",
  delivery: "Delivery",
  deliveryPaper: "Paper copy, shipped in 24/48h",
  deliveryDigital: "Digitally signed PDF",
  holders: "Document holders",
  translatorIntro: "Your translation is carried out by",
  translatorSworn: "sworn translator-interpreter",
  translatorNumber: "no.",
  translatorAppointed: "appointed by the Spanish Ministry of Foreign Affairs.",
  ourNetwork: "See our network of sworn translators →",
  colDescription: "Description",
  colQty: "Qty",
  colPrice: "Price",
  colTotal: "Total",
  viewDocument: "view document",
  download: "download",
  summary: "Summary",
  subtotal: "Subtotal",
  discount: "Discount",
  shipping: "Shipping",
  vat: "VAT",
  total: "Total",
  paperIncluded: "Paper delivery (€12 + VAT) is included in the total.",
  yourDocuments: "Your documents",
  pdfTitle: "Quote PDF",
  pdfOpen: "Open / download full PDF",
  pdfPending: "The final PDF will appear as soon as the quote is confirmed by our team.",
  payHow: "Payment method",
  tabBizum: "Bizum",
  tabTransfer: "Bank transfer",
  tabCard: "Card",
  transferDo: "Make a bank transfer of",
  beneficiary: "Beneficiary",
  iban: "IBAN",
  bic: "BIC/SWIFT",
  beneficiaryAddress: "Beneficiary address",
  bankAddress: "Bank address",
  concept: "Reference",
  conceptHint: "Please quote the quote number as the payment reference. We confirm within 24 working hours.",
  sepaNote:
    "From outside the SEPA area: SWIFT transfer in EUR using the BIC, IBAN and addresses above (shared charges, SHA).",
  alreadyTransferred: "Already made the transfer?",
  alreadyTransferredHelp: "Upload your receipt and we will confirm it. It only takes a moment.",
  alreadyTransferredCta: "I have transferred: upload receipt",
  proofStepTitle: "Already paid? Upload your receipt here",
  proofStepHelp: "Press the button and attach the receipt of your transfer or Bizum. That is all we need to complete your order.",
  oneMoment: "One moment...",
  payCard: "Pay",
  redirecting: "Redirecting...",
  cardNote: "Secure payment by credit or debit card (subject to availability).",
  notPayable: "This quote cannot be paid in its current status.",
  errPay: "The payment could not be started.",
  errContinue: "We could not continue.",
  copied: "Copied",
};

const FR: PublicDict = {
  quote: "Devis",
  swornTranslation: "Traduction assermentée",
  status: "Statut",
  validUntil: "Valable jusqu'au",
  paidOk: "Paiement bien reçu. Nous vous avons envoyé une confirmation par e-mail.",
  canceled: "Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.",
  detail: "Détail",
  client: "Client",
  clientProtected: "Données protégées",
  languages: "Langues",
  delivery: "Livraison",
  deliveryPaper: "Papier, expédition sous 24/48 h",
  deliveryDigital: "PDF signé électroniquement",
  holders: "Titulaires",
  translatorIntro: "Votre traduction est réalisée par",
  translatorSworn: "traducteur/trice-interprète assermenté(e)",
  translatorNumber: "n°",
  translatorAppointed: "nommé(e) par le ministère espagnol des Affaires étrangères.",
  ourNetwork: "Découvrez notre réseau de traducteurs assermentés →",
  colDescription: "Description",
  colQty: "Qté",
  colPrice: "Prix",
  colTotal: "Total",
  viewDocument: "voir le document",
  download: "télécharger",
  summary: "Récapitulatif",
  subtotal: "Sous-total",
  discount: "Remise",
  shipping: "Expédition",
  vat: "TVA",
  total: "Total",
  paperIncluded: "L'envoi papier (12 € + TVA) est compris dans le total.",
  yourDocuments: "Vos documents",
  pdfTitle: "PDF du devis",
  pdfOpen: "Ouvrir / télécharger le PDF complet",
  pdfPending: "Le PDF définitif s'affichera dès que le devis sera confirmé par notre équipe.",
  payHow: "Mode de paiement",
  tabBizum: "Bizum",
  tabTransfer: "Virement",
  tabCard: "Carte",
  transferDo: "Effectuez un virement de",
  beneficiary: "Bénéficiaire",
  iban: "IBAN",
  bic: "BIC/SWIFT",
  beneficiaryAddress: "Adresse du bénéficiaire",
  bankAddress: "Adresse de la banque",
  concept: "Référence",
  conceptHint: "Indiquez le numéro de devis en référence. Nous confirmons sous 24 h ouvrées.",
  sepaNote:
    "Depuis l'extérieur de la zone SEPA : virement SWIFT en EUR avec le BIC, l'IBAN et les adresses ci-dessus (frais partagés, SHA).",
  alreadyTransferred: "Vous avez déjà fait le virement ?",
  alreadyTransferredHelp: "Envoyez-nous le justificatif et nous le confirmons. Cela ne prend qu'un instant.",
  alreadyTransferredCta: "J'ai viré : envoyer le justificatif",
  proofStepTitle: "Vous avez déjà payé ? Envoyez votre justificatif ici",
  proofStepHelp: "Appuyez sur le bouton et joignez le justificatif de votre virement ou Bizum. C'est tout ce qu'il faut pour finaliser votre commande.",
  oneMoment: "Un instant...",
  payCard: "Payer",
  redirecting: "Redirection...",
  cardNote: "Paiement sécurisé par carte de crédit ou de débit (selon disponibilité).",
  notPayable: "Ce devis ne peut pas être payé dans son état actuel.",
  errPay: "Le paiement n'a pas pu être lancé.",
  errContinue: "Impossible de continuer.",
  copied: "Copié",
};

const DICTS: Record<PublicLang, PublicDict> = { es: ES, en: EN, fr: FR };

export function publicDict(lang: PublicLang): PublicDict {
  return DICTS[lang] ?? ES;
}

/** Etiqueta del estado del presupuesto en el idioma del cliente. */
export function statusLabel(status: string, lang: PublicLang): string {
  const mapa: Record<PublicLang, Record<string, string>> = {
    es: { DRAFT: "Borrador", SENT: "Enviado", OPENED: "Abierto", ACCEPTED: "Aceptado", PAID: "Pagado", IN_PROGRESS: "En curso", DELIVERED: "Entregado", EXPIRED: "Caducado" },
    en: { DRAFT: "Draft", SENT: "Sent", OPENED: "Opened", ACCEPTED: "Accepted", PAID: "Paid", IN_PROGRESS: "In progress", DELIVERED: "Delivered", EXPIRED: "Expired" },
    fr: { DRAFT: "Brouillon", SENT: "Envoyé", OPENED: "Ouvert", ACCEPTED: "Accepté", PAID: "Payé", IN_PROGRESS: "En cours", DELIVERED: "Livré", EXPIRED: "Expiré" },
  };
  return mapa[lang]?.[status] ?? mapa.es[status] ?? status;
}
