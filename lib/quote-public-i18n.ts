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

export type PublicLang = "es" | "en" | "fr" | "pt" | "it" | "de";

/** es, fr, pt, it y de tal cual; cualquier otro idioma se atiende en inglés. */
export function pickPublicLang(pdfLang: string | null | undefined): PublicLang {
  const l = String(pdfLang || "").trim().toLowerCase();
  if (l === "es" || !l) return "es";
  if (l === "fr" || l === "pt" || l === "it" || l === "de") return l;
  return "en";
}

/** Locale para fechas e importes coherente con el idioma elegido. */
export function localeFor(lang: PublicLang): string {
  const map: Record<PublicLang, string> = { es: "es-ES", en: "en-GB", fr: "fr-FR", pt: "pt-BR", it: "it-IT", de: "de-DE" };
  return map[lang] ?? "es-ES";
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
  writeYourLang: string;
  bizumSendPre: string;
  bizumSendPost: string;
  secondPayment: string;
  paidFull: string;
  secondPayLater: string;
  balancePayPre: string;
  balancePaySuf: string;
  balanceOpening: string;
  docOpenTab: string;
  docDownload: string;
  docPage: string;
  docPages: string;
  docNoPreview: string;
  docMobileHint: string;
  fbPrompt: string;
  fbPrice: string;
  fbDeadline: string;
  fbNoNeed: string;
  fbElsewhere: string;
  fbOther: string;
  fbThanks: string;
  fbPickReason: string;
  fbNote: string;
  fbSend: string;
  fbSending: string;
  fbErrSend: string;
  fbErrRetry: string;
  docsAllThere: string;
  docsAllThereHelp: string;
  docsYes: string;
  docsMissing: string;
  docsConfirmed: string;
  docsTapHint: string;
  docsClose: string;
  missTitle: string;
  missHelp: string;
  missPick: string;
  missNote: string;
  missSend: string;
  missSending: string;
  missCancel: string;
  missDone: string;
  missPendingWarn: string;
  missErrType: string;
  missErrSize: string;
  missErrCount: string;
  missErrNone: string;
  missErrSend: string;
  billTitle: string;
  billHelp: string;
  billName: string;
  billNif: string;
  billAddress: string;
  billPostal: string;
  billCity: string;
  billCountry: string;
  billFromDoc: string;
  billSimplified: string;
  billNifRequired: string;
  billNameRequired: string;
  billAddressRequired: string;
  billSave: string;
  billSaving: string;
  billSaved: string;
  billEdit: string;
  billErr: string;
  payStepTitle: string;
  billSuggest: string;
  billUse: string;
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
  alreadyTransferredCta: "Ya he pagado: subir justificante",
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
  writeYourLang: "Puedes escribirnos en tu idioma: te respondemos en él.",
  bizumSendPre: "Envía un Bizum por",
  bizumSendPost: "con estos datos:",
  secondPayment: "Segundo pago",
  paidFull: "Pagado. Presupuesto pagado en su totalidad.",
  secondPayLater: "Se paga después del primer pago, con este mismo enlace.",
  balancePayPre: "Pagar",
  balancePaySuf: "con tarjeta",
  balanceOpening: "Abriendo el pago…",
  docOpenTab: "Abrir en otra pestaña",
  docDownload: "Descargar",
  docPage: "pág.",
  docPages: "págs.",
  docNoPreview: "Formato sin vista previa: use «Abrir en otra pestaña» o «Descargar».",
  docMobileHint: "En el móvil puede verse solo la primera página: «Abrir en otra pestaña» enseña el documento entero.",
  fbPrompt: "Si ha decidido no seguir adelante, ¿nos dice el motivo? Un clic basta.",
  fbPrice: "El precio",
  fbDeadline: "El plazo",
  fbNoNeed: "Ya no lo necesito",
  fbElsewhere: "Lo resolví con otro traductor",
  fbOther: "Otro motivo",
  fbThanks: "Gracias por contárnoslo. Nos ayuda a mejorar.",
  fbPickReason: "Elige un motivo.",
  fbNote: "Algo más que quiera contarnos (opcional)",
  fbSend: "Enviar motivo",
  fbSending: "Enviando…",
  fbErrSend: "No se pudo enviar.",
  fbErrRetry: "No se pudo enviar. Inténtalo de nuevo.",
  docsAllThere: "¿Está todo?",
  docsAllThereHelp: "Comprueba que aquí están todos los documentos que quieres traducir.",
  docsYes: "Sí, está todo",
  docsMissing: "Falta algo",
  docsConfirmed: "Perfecto: documentos confirmados.",
  docsTapHint: "Toca un documento para ampliarlo.",
  docsClose: "Cerrar",
  missTitle: "Añade lo que falta",
  missHelp: "Sube uno o varios archivos (PDF o imagen, hasta 20 MB cada uno) y, si quieres, cuéntanos qué falta.",
  missPick: "Elegir archivos",
  missNote: "Nota (opcional)",
  missSend: "Enviar documentos",
  missSending: "Enviando…",
  missCancel: "Cancelar",
  missDone: "Recibido. Te enviaremos el presupuesto actualizado.",
  missPendingWarn: "Has añadido documentos: espera la versión nueva o paga solo lo presupuestado.",
  missErrType: "Solo se admiten PDF e imágenes (JPG, PNG, WEBP, HEIC, TIFF).",
  missErrSize: "Cada archivo debe pesar menos de 20 MB.",
  missErrCount: "Máximo 10 archivos por envío.",
  missErrNone: "Elige al menos un archivo.",
  missErrSend: "No hemos podido enviarlo. Inténtalo de nuevo.",
  billTitle: "Revisa tus datos de facturación",
  billHelp: "Los usaremos para tu factura. Puedes corregirlos.",
  billName: "Nombre o razón social",
  billNif: "NIF / CIF (opcional)",
  billAddress: "Dirección",
  billPostal: "Código postal",
  billCity: "Ciudad",
  billCountry: "País",
  billFromDoc: "Leído de tu documento: revísalo",
  billSimplified: "Sin NIF te emitiremos una factura simplificada (hasta 400 €).",
  billNifRequired: "Para importes superiores a 400 € necesitamos tu NIF para emitir la factura.",
  billNameRequired: "Indica el nombre o la razón social.",
  billAddressRequired: "Con NIF necesitamos también dirección, código postal y ciudad.",
  billSave: "Guardar datos",
  billSaving: "Guardando…",
  billSaved: "Datos guardados. Pasarán a tu factura cuando pagues.",
  billEdit: "Editar",
  billErr: "No hemos podido guardar los datos. Inténtalo de nuevo.",
  payStepTitle: "Pagar",
  billSuggest: "¿Es este el titular de la factura?",
  billUse: "Usar",
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
  alreadyTransferredCta: "I have paid: upload receipt",
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
  writeYourLang: "You can write to us in your own language — we'll reply in it.",
  bizumSendPre: "Send a Bizum of",
  bizumSendPost: "with these details:",
  secondPayment: "Second payment",
  paidFull: "Paid. Quote paid in full.",
  secondPayLater: "Payable after the first payment, with this same link.",
  balancePayPre: "Pay",
  balancePaySuf: "by card",
  balanceOpening: "Opening the payment…",
  docOpenTab: "Open in a new tab",
  docDownload: "Download",
  docPage: "p.",
  docPages: "pp.",
  docNoPreview: "No preview for this format: use “Open in a new tab” or “Download”.",
  docMobileHint: "On mobile only the first page may show: “Open in a new tab” displays the whole document.",
  fbPrompt: "If you have decided not to go ahead, would you tell us why? One click is enough.",
  fbPrice: "The price",
  fbDeadline: "The deadline",
  fbNoNeed: "I no longer need it",
  fbElsewhere: "I used another translator",
  fbOther: "Other reason",
  fbThanks: "Thank you for letting us know. It helps us improve.",
  fbPickReason: "Please choose a reason.",
  fbNote: "Anything else you would like to tell us (optional)",
  fbSend: "Send reason",
  fbSending: "Sending…",
  fbErrSend: "It could not be sent.",
  fbErrRetry: "It could not be sent. Please try again.",
  docsAllThere: "Is everything there?",
  docsAllThereHelp: "Check that all the documents you want translated are here.",
  docsYes: "Yes, everything is there",
  docsMissing: "Something is missing",
  docsConfirmed: "Perfect: documents confirmed.",
  docsTapHint: "Tap a document to enlarge it.",
  docsClose: "Close",
  missTitle: "Add what is missing",
  missHelp: "Upload one or more files (PDF or image, up to 20 MB each) and, if you like, tell us what is missing.",
  missPick: "Choose files",
  missNote: "Note (optional)",
  missSend: "Send documents",
  missSending: "Sending…",
  missCancel: "Cancel",
  missDone: "Received. We will send you the updated quote.",
  missPendingWarn: "You have added documents: wait for the new version or pay only what is quoted.",
  missErrType: "Only PDF and images are accepted (JPG, PNG, WEBP, HEIC, TIFF).",
  missErrSize: "Each file must be smaller than 20 MB.",
  missErrCount: "Maximum 10 files per submission.",
  missErrNone: "Choose at least one file.",
  missErrSend: "We could not send it. Please try again.",
  billTitle: "Check your billing details",
  billHelp: "We will use them for your invoice. You can correct them.",
  billName: "Name or company name",
  billNif: "Tax ID (optional)",
  billAddress: "Address",
  billPostal: "Postal code",
  billCity: "City",
  billCountry: "Country",
  billFromDoc: "Read from your document: please check it",
  billSimplified: "Without a tax ID we will issue a simplified invoice (up to EUR 400).",
  billNifRequired: "For amounts above EUR 400 we need your tax ID to issue the invoice.",
  billNameRequired: "Enter your name or company name.",
  billAddressRequired: "With a tax ID we also need the address, postal code and city.",
  billSave: "Save details",
  billSaving: "Saving…",
  billSaved: "Details saved. They will go on your invoice when you pay.",
  billEdit: "Edit",
  billErr: "We could not save the details. Please try again.",
  payStepTitle: "Pay",
  billSuggest: "Is this the invoice holder?",
  billUse: "Use",
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
  alreadyTransferredCta: "J'ai payé : envoyer le justificatif",
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
  writeYourLang: "Vous pouvez nous écrire dans votre langue : nous vous répondons dans la même langue.",
  bizumSendPre: "Envoyez un Bizum de",
  bizumSendPost: "avec ces coordonnées :",
  secondPayment: "Second paiement",
  paidFull: "Payé. Devis réglé en totalité.",
  secondPayLater: "À régler après le premier paiement, avec ce même lien.",
  balancePayPre: "Payer",
  balancePaySuf: "par carte",
  balanceOpening: "Ouverture du paiement…",
  docOpenTab: "Ouvrir dans un nouvel onglet",
  docDownload: "Télécharger",
  docPage: "p.",
  docPages: "p.",
  docNoPreview: "Pas d'aperçu pour ce format : utilisez « Ouvrir dans un nouvel onglet » ou « Télécharger ».",
  docMobileHint: "Sur mobile, seule la première page peut s'afficher : « Ouvrir dans un nouvel onglet » affiche le document entier.",
  fbPrompt: "Si vous avez décidé de ne pas donner suite, pouvez-vous nous en indiquer la raison ? Un clic suffit.",
  fbPrice: "Le prix",
  fbDeadline: "Le délai",
  fbNoNeed: "Je n'en ai plus besoin",
  fbElsewhere: "Je l'ai fait faire par un autre traducteur",
  fbOther: "Autre raison",
  fbThanks: "Merci de nous l'avoir dit. Cela nous aide à nous améliorer.",
  fbPickReason: "Choisissez un motif.",
  fbNote: "Autre chose à nous dire (facultatif)",
  fbSend: "Envoyer le motif",
  fbSending: "Envoi…",
  fbErrSend: "L'envoi a échoué.",
  fbErrRetry: "L'envoi a échoué. Veuillez réessayer.",
  docsAllThere: "Tout est-il là ?",
  docsAllThereHelp: "Vérifiez que tous les documents à traduire sont bien ici.",
  docsYes: "Oui, tout est là",
  docsMissing: "Il manque quelque chose",
  docsConfirmed: "Parfait : documents confirmés.",
  docsTapHint: "Touchez un document pour l'agrandir.",
  docsClose: "Fermer",
  missTitle: "Ajoutez ce qui manque",
  missHelp: "Envoyez un ou plusieurs fichiers (PDF ou image, jusqu'à 20 Mo chacun) et, si vous le souhaitez, dites-nous ce qui manque.",
  missPick: "Choisir des fichiers",
  missNote: "Note (facultatif)",
  missSend: "Envoyer les documents",
  missSending: "Envoi…",
  missCancel: "Annuler",
  missDone: "Bien reçu. Nous vous enverrons le devis mis à jour.",
  missPendingWarn: "Vous avez ajouté des documents : attendez la nouvelle version ou ne payez que ce qui est chiffré.",
  missErrType: "Seuls les PDF et les images sont acceptés (JPG, PNG, WEBP, HEIC, TIFF).",
  missErrSize: "Chaque fichier doit peser moins de 20 Mo.",
  missErrCount: "Maximum 10 fichiers par envoi.",
  missErrNone: "Choisissez au moins un fichier.",
  missErrSend: "Envoi impossible. Veuillez réessayer.",
  billTitle: "Vérifiez vos données de facturation",
  billHelp: "Nous les utiliserons pour votre facture. Vous pouvez les corriger.",
  billName: "Nom ou raison sociale",
  billNif: "N° fiscal (facultatif)",
  billAddress: "Adresse",
  billPostal: "Code postal",
  billCity: "Ville",
  billCountry: "Pays",
  billFromDoc: "Lu dans votre document : vérifiez-le",
  billSimplified: "Sans n° fiscal, nous émettrons une facture simplifiée (jusqu'à 400 €).",
  billNifRequired: "Au-delà de 400 €, nous avons besoin de votre n° fiscal pour émettre la facture.",
  billNameRequired: "Indiquez votre nom ou raison sociale.",
  billAddressRequired: "Avec un n° fiscal, il nous faut aussi l'adresse, le code postal et la ville.",
  billSave: "Enregistrer",
  billSaving: "Enregistrement…",
  billSaved: "Données enregistrées. Elles figureront sur votre facture après le paiement.",
  billEdit: "Modifier",
  billErr: "Impossible d'enregistrer les données. Veuillez réessayer.",
  payStepTitle: "Payer",
  billSuggest: "Est-ce le titulaire de la facture ?",
  billUse: "Utiliser",
};

const PT: PublicDict = {
  quote: "Orçamento",
  swornTranslation: "Tradução juramentada",
  status: "Situação",
  validUntil: "Válido até",
  paidOk: "Pagamento recebido com sucesso. Enviamos uma confirmação por e-mail.",
  canceled: "Pagamento cancelado. Você pode tentar de novo quando quiser.",
  detail: "Detalhes",
  client: "Cliente",
  clientProtected: "Dados protegidos",
  languages: "Idiomas",
  delivery: "Entrega",
  deliveryPaper: "Em papel, com envio em 24/48h",
  deliveryDigital: "PDF digital assinado",
  holders: "Titulares",
  translatorIntro: "A sua tradução é realizada por",
  translatorSworn: "tradutor(a)-intérprete juramentado(a)",
  translatorNumber: "n.º",
  translatorAppointed: "nomeado(a) pelo Ministério das Relações Exteriores da Espanha.",
  ourNetwork: "Conheça a nossa rede de tradutores juramentados →",
  colDescription: "Descrição",
  colQty: "Qtd.",
  colPrice: "Preço",
  colTotal: "Total",
  viewDocument: "ver documento",
  download: "baixar",
  summary: "Resumo",
  subtotal: "Subtotal",
  discount: "Desconto",
  shipping: "Envio",
  vat: "IVA",
  total: "Total",
  paperIncluded: "O envio em papel (12 € + IVA) está incluído no total.",
  yourDocuments: "Seus documentos",
  pdfTitle: "PDF do orçamento",
  pdfOpen: "Abrir / baixar o PDF completo",
  pdfPending: "O PDF final será exibido assim que o orçamento for confirmado pela nossa equipe.",
  payHow: "Forma de pagamento",
  tabBizum: "Bizum",
  tabTransfer: "Transferência",
  tabCard: "Cartão",
  transferDo: "Faça uma transferência de",
  beneficiary: "Beneficiário",
  iban: "IBAN",
  bic: "BIC/SWIFT",
  beneficiaryAddress: "Endereço do beneficiário",
  bankAddress: "Endereço do banco",
  concept: "Referência",
  conceptHint: "Informe o número do orçamento na referência. Confirmamos em até 24 horas úteis.",
  sepaNote:
    "De fora da zona SEPA: transferência SWIFT em EUR com o BIC, o IBAN e os endereços acima (despesas compartilhadas, SHA).",
  alreadyTransferredCta: "Já paguei: enviar comprovante",
  proofStepTitle: "Já pagou? Envie aqui o seu comprovante",
  proofStepHelp: "Clique no botão e anexe o comprovante da transferência ou do Bizum. Com isso concluímos o seu pedido.",
  oneMoment: "Um momento...",
  payCard: "Pagar",
  redirecting: "Redirecionando...",
  cardNote: "Pagamento seguro com cartão de crédito ou débito (conforme disponibilidade).",
  notPayable: "Este orçamento não pode ser pago na situação atual.",
  errPay: "Não foi possível iniciar o pagamento.",
  errContinue: "Não foi possível continuar.",
  copied: "Copiado",
  writeYourLang: "Você pode nos escrever no seu idioma: respondemos nele.",
  bizumSendPre: "Envie um Bizum de",
  bizumSendPost: "com estes dados:",
  secondPayment: "Segundo pagamento",
  paidFull: "Pago. Orçamento pago integralmente.",
  secondPayLater: "Será pago após o primeiro pagamento, com este mesmo link.",
  balancePayPre: "Pagar",
  balancePaySuf: "com cartão",
  balanceOpening: "Abrindo o pagamento…",
  docOpenTab: "Abrir em outra aba",
  docDownload: "Baixar",
  docPage: "pág.",
  docPages: "págs.",
  docNoPreview: "Formato sem pré-visualização: use «Abrir em outra aba» ou «Baixar».",
  docMobileHint: "No celular pode aparecer só a primeira página: «Abrir em outra aba» mostra o documento inteiro.",
  fbPrompt: "Se decidiu não seguir em frente, pode nos dizer o motivo? Basta um clique.",
  fbPrice: "O preço",
  fbDeadline: "O prazo",
  fbNoNeed: "Não preciso mais",
  fbElsewhere: "Resolvi com outro tradutor",
  fbOther: "Outro motivo",
  fbThanks: "Obrigado por nos contar. Isso nos ajuda a melhorar.",
  fbPickReason: "Escolha um motivo.",
  fbNote: "Mais alguma coisa que queira nos contar (opcional)",
  fbSend: "Enviar motivo",
  fbSending: "Enviando…",
  fbErrSend: "Não foi possível enviar.",
  fbErrRetry: "Não foi possível enviar. Tente novamente.",
  docsAllThere: "Está tudo?",
  docsAllThereHelp: "Confirme que aqui estão todos os documentos que quer traduzir.",
  docsYes: "Sim, está tudo",
  docsMissing: "Falta algo",
  docsConfirmed: "Perfeito: documentos confirmados.",
  docsTapHint: "Toque num documento para o ampliar.",
  docsClose: "Fechar",
  missTitle: "Adicione o que falta",
  missHelp: "Envie um ou mais ficheiros (PDF ou imagem, até 20 MB cada) e, se quiser, diga-nos o que falta.",
  missPick: "Escolher ficheiros",
  missNote: "Nota (opcional)",
  missSend: "Enviar documentos",
  missSending: "A enviar…",
  missCancel: "Cancelar",
  missDone: "Recebido. Enviaremos o orçamento atualizado.",
  missPendingWarn: "Adicionou documentos: aguarde a nova versão ou pague apenas o que foi orçamentado.",
  missErrType: "Só são aceites PDF e imagens (JPG, PNG, WEBP, HEIC, TIFF).",
  missErrSize: "Cada ficheiro deve ter menos de 20 MB.",
  missErrCount: "Máximo de 10 ficheiros por envio.",
  missErrNone: "Escolha pelo menos um ficheiro.",
  missErrSend: "Não foi possível enviar. Tente novamente.",
  billTitle: "Confirme os seus dados de faturação",
  billHelp: "Vamos usá-los na sua fatura. Pode corrigi-los.",
  billName: "Nome ou denominação social",
  billNif: "NIF (opcional)",
  billAddress: "Morada",
  billPostal: "Código postal",
  billCity: "Cidade",
  billCountry: "País",
  billFromDoc: "Lido do seu documento: confirme",
  billSimplified: "Sem NIF emitiremos uma fatura simplificada (até 400 €).",
  billNifRequired: "Para valores acima de 400 € precisamos do seu NIF para emitir a fatura.",
  billNameRequired: "Indique o nome ou a denominação social.",
  billAddressRequired: "Com NIF precisamos também da morada, do código postal e da cidade.",
  billSave: "Guardar dados",
  billSaving: "A guardar…",
  billSaved: "Dados guardados. Passarão para a sua fatura quando pagar.",
  billEdit: "Editar",
  billErr: "Não foi possível guardar os dados. Tente novamente.",
  payStepTitle: "Pagar",
  billSuggest: "É este o titular da fatura?",
  billUse: "Usar",
};

const IT: PublicDict = {
  quote: "Preventivo",
  swornTranslation: "Traduzione giurata",
  status: "Stato",
  validUntil: "Valido fino al",
  paidOk: "Pagamento ricevuto correttamente. Ti abbiamo inviato una conferma via e-mail.",
  canceled: "Pagamento annullato. Puoi riprovare quando vuoi.",
  detail: "Dettaglio",
  client: "Cliente",
  clientProtected: "Dati protetti",
  languages: "Lingue",
  delivery: "Consegna",
  deliveryPaper: "Cartaceo, spedizione in 24/48 h",
  deliveryDigital: "PDF digitale firmato",
  holders: "Intestatari",
  translatorIntro: "La sua traduzione è eseguita da",
  translatorSworn: "traduttore/trice-interprete giurato/a",
  translatorNumber: "n.",
  translatorAppointed: "nominato/a dal Ministero degli Affari Esteri spagnolo.",
  ourNetwork: "Scopra la nostra rete di traduttori giurati →",
  colDescription: "Descrizione",
  colQty: "Qtà",
  colPrice: "Prezzo",
  colTotal: "Totale",
  viewDocument: "vedi documento",
  download: "scarica",
  summary: "Riepilogo",
  subtotal: "Subtotale",
  discount: "Sconto",
  shipping: "Spedizione",
  vat: "IVA",
  total: "Totale",
  paperIncluded: "La spedizione cartacea (12 € + IVA) è inclusa nel totale.",
  yourDocuments: "I suoi documenti",
  pdfTitle: "PDF del preventivo",
  pdfOpen: "Apri / scarica il PDF completo",
  pdfPending: "Il PDF definitivo sarà visibile non appena il preventivo sarà confermato dal nostro team.",
  payHow: "Metodo di pagamento",
  tabBizum: "Bizum",
  tabTransfer: "Bonifico",
  tabCard: "Carta",
  transferDo: "Effettua un bonifico di",
  beneficiary: "Beneficiario",
  iban: "IBAN",
  bic: "BIC/SWIFT",
  beneficiaryAddress: "Indirizzo del beneficiario",
  bankAddress: "Indirizzo della banca",
  concept: "Causale",
  conceptHint: "Indica il numero del preventivo nella causale. Confermiamo entro 24 ore lavorative.",
  sepaNote:
    "Da fuori dall'area SEPA: bonifico SWIFT in EUR con BIC, IBAN e gli indirizzi indicati sopra (spese condivise, SHA).",
  alreadyTransferredCta: "Ho già pagato: carica la ricevuta",
  proofStepTitle: "Hai già pagato? Carica qui la ricevuta",
  proofStepHelp: "Premi il pulsante e allega la ricevuta del bonifico o del Bizum. Con questo completiamo il tuo ordine.",
  oneMoment: "Un momento...",
  payCard: "Paga",
  redirecting: "Reindirizzamento...",
  cardNote: "Pagamento sicuro con carta di credito o di debito (secondo disponibilità).",
  notPayable: "Questo preventivo non può essere pagato nel suo stato attuale.",
  errPay: "Non è stato possibile avviare il pagamento.",
  errContinue: "Non è stato possibile continuare.",
  copied: "Copiato",
  writeYourLang: "Puoi scriverci nella tua lingua: ti rispondiamo nella stessa lingua.",
  bizumSendPre: "Invia un Bizum di",
  bizumSendPost: "con questi dati:",
  secondPayment: "Secondo pagamento",
  paidFull: "Pagato. Preventivo pagato per intero.",
  secondPayLater: "Si paga dopo il primo pagamento, con questo stesso link.",
  balancePayPre: "Paga",
  balancePaySuf: "con carta",
  balanceOpening: "Apertura del pagamento…",
  docOpenTab: "Apri in un'altra scheda",
  docDownload: "Scarica",
  docPage: "pag.",
  docPages: "pagg.",
  docNoPreview: "Formato senza anteprima: usa «Apri in un'altra scheda» o «Scarica».",
  docMobileHint: "Da smartphone potrebbe vedersi solo la prima pagina: «Apri in un'altra scheda» mostra l'intero documento.",
  fbPrompt: "Se hai deciso di non procedere, ci dici il motivo? Basta un clic.",
  fbPrice: "Il prezzo",
  fbDeadline: "I tempi",
  fbNoNeed: "Non mi serve più",
  fbElsewhere: "Ho risolto con un altro traduttore",
  fbOther: "Altro motivo",
  fbThanks: "Grazie per avercelo detto. Ci aiuta a migliorare.",
  fbPickReason: "Scegli un motivo.",
  fbNote: "Altro che vuoi dirci (facoltativo)",
  fbSend: "Invia il motivo",
  fbSending: "Invio…",
  fbErrSend: "Impossibile inviare.",
  fbErrRetry: "Impossibile inviare. Riprova.",
  docsAllThere: "C'è tutto?",
  docsAllThereHelp: "Controlla che qui ci siano tutti i documenti da tradurre.",
  docsYes: "Sì, c'è tutto",
  docsMissing: "Manca qualcosa",
  docsConfirmed: "Perfetto: documenti confermati.",
  docsTapHint: "Tocca un documento per ingrandirlo.",
  docsClose: "Chiudi",
  missTitle: "Aggiungi ciò che manca",
  missHelp: "Carica uno o più file (PDF o immagine, fino a 20 MB ciascuno) e, se vuoi, dicci cosa manca.",
  missPick: "Scegli i file",
  missNote: "Nota (facoltativa)",
  missSend: "Invia i documenti",
  missSending: "Invio in corso…",
  missCancel: "Annulla",
  missDone: "Ricevuto. Ti invieremo il preventivo aggiornato.",
  missPendingWarn: "Hai aggiunto dei documenti: attendi la nuova versione o paga solo ciò che è stato preventivato.",
  missErrType: "Sono accettati solo PDF e immagini (JPG, PNG, WEBP, HEIC, TIFF).",
  missErrSize: "Ogni file deve pesare meno di 20 MB.",
  missErrCount: "Massimo 10 file per invio.",
  missErrNone: "Scegli almeno un file.",
  missErrSend: "Non siamo riusciti a inviarlo. Riprova.",
  billTitle: "Controlla i tuoi dati di fatturazione",
  billHelp: "Li useremo per la tua fattura. Puoi correggerli.",
  billName: "Nome o ragione sociale",
  billNif: "Codice fiscale / P. IVA (facoltativo)",
  billAddress: "Indirizzo",
  billPostal: "CAP",
  billCity: "Città",
  billCountry: "Paese",
  billFromDoc: "Letto dal tuo documento: controllalo",
  billSimplified: "Senza codice fiscale emetteremo una fattura semplificata (fino a 400 €).",
  billNifRequired: "Per importi superiori a 400 € ci serve il tuo codice fiscale per emettere la fattura.",
  billNameRequired: "Indica il nome o la ragione sociale.",
  billAddressRequired: "Con il codice fiscale servono anche indirizzo, CAP e città.",
  billSave: "Salva i dati",
  billSaving: "Salvataggio…",
  billSaved: "Dati salvati. Passeranno alla tua fattura quando pagherai.",
  billEdit: "Modifica",
  billErr: "Non siamo riusciti a salvare i dati. Riprova.",
  payStepTitle: "Paga",
  billSuggest: "È questo l'intestatario della fattura?",
  billUse: "Usa",
};

const DE: PublicDict = {
  quote: "Angebot",
  swornTranslation: "Beeidigte Übersetzung",
  status: "Status",
  validUntil: "Gültig bis",
  paidOk: "Zahlung erfolgreich eingegangen. Wir haben Ihnen eine Bestätigung per E-Mail geschickt.",
  canceled: "Zahlung abgebrochen. Sie können es jederzeit erneut versuchen.",
  detail: "Details",
  client: "Kunde",
  clientProtected: "Daten geschützt",
  languages: "Sprachen",
  delivery: "Lieferung",
  deliveryPaper: "Auf Papier, Versand in 24/48 Std.",
  deliveryDigital: "Digital signiertes PDF",
  holders: "Inhaber",
  translatorIntro: "Ihre Übersetzung wird angefertigt von",
  translatorSworn: "beeidigte(r) Übersetzer(in) und Dolmetscher(in)",
  translatorNumber: "Nr.",
  translatorAppointed: "bestellt vom spanischen Außenministerium.",
  ourNetwork: "Unser Netzwerk beeidigter Übersetzer ansehen →",
  colDescription: "Beschreibung",
  colQty: "Menge",
  colPrice: "Preis",
  colTotal: "Gesamt",
  viewDocument: "Dokument ansehen",
  download: "herunterladen",
  summary: "Zusammenfassung",
  subtotal: "Zwischensumme",
  discount: "Rabatt",
  shipping: "Versand",
  vat: "MwSt.",
  total: "Gesamt",
  paperIncluded: "Der Versand in Papierform (12 € + MwSt.) ist im Gesamtbetrag enthalten.",
  yourDocuments: "Ihre Dokumente",
  pdfTitle: "PDF des Angebots",
  pdfOpen: "Vollständiges PDF öffnen / herunterladen",
  pdfPending: "Das endgültige PDF erscheint, sobald unser Team das Angebot bestätigt hat.",
  payHow: "Zahlungsart",
  tabBizum: "Bizum",
  tabTransfer: "Überweisung",
  tabCard: "Karte",
  transferDo: "Überweisen Sie",
  beneficiary: "Empfänger",
  iban: "IBAN",
  bic: "BIC/SWIFT",
  beneficiaryAddress: "Adresse des Empfängers",
  bankAddress: "Adresse der Bank",
  concept: "Verwendungszweck",
  conceptHint: "Geben Sie die Angebotsnummer als Verwendungszweck an. Wir bestätigen innerhalb von 24 Stunden an Werktagen.",
  sepaNote:
    "Von außerhalb des SEPA-Raums: SWIFT-Überweisung in EUR mit BIC, IBAN und den oben genannten Adressen (geteilte Kosten, SHA).",
  alreadyTransferredCta: "Ich habe bezahlt: Beleg hochladen",
  proofStepTitle: "Schon bezahlt? Laden Sie hier Ihren Beleg hoch",
  proofStepHelp: "Klicken Sie auf die Schaltfläche und fügen Sie den Beleg Ihrer Überweisung oder Ihres Bizum bei. Damit schließen wir Ihren Auftrag ab.",
  oneMoment: "Einen Moment...",
  payCard: "Zahlen",
  redirecting: "Weiterleitung...",
  cardNote: "Sichere Zahlung per Kredit- oder Debitkarte (je nach Verfügbarkeit).",
  notPayable: "Dieses Angebot kann in seinem aktuellen Status nicht bezahlt werden.",
  errPay: "Die Zahlung konnte nicht gestartet werden.",
  errContinue: "Wir konnten nicht fortfahren.",
  copied: "Kopiert",
  writeYourLang: "Sie können uns in Ihrer Sprache schreiben: Wir antworten in derselben Sprache.",
  bizumSendPre: "Senden Sie ein Bizum über",
  bizumSendPost: "mit diesen Daten:",
  secondPayment: "Zweite Zahlung",
  paidFull: "Bezahlt. Angebot vollständig bezahlt.",
  secondPayLater: "Wird nach der ersten Zahlung über denselben Link bezahlt.",
  balancePayPre: "Jetzt",
  balancePaySuf: "per Karte zahlen",
  balanceOpening: "Zahlung wird geöffnet…",
  docOpenTab: "In neuem Tab öffnen",
  docDownload: "Herunterladen",
  docPage: "S.",
  docPages: "S.",
  docNoPreview: "Format ohne Vorschau: Nutzen Sie „In neuem Tab öffnen“ oder „Herunterladen“.",
  docMobileHint: "Auf dem Handy wird evtl. nur die erste Seite angezeigt: „In neuem Tab öffnen“ zeigt das ganze Dokument.",
  fbPrompt: "Falls Sie sich gegen das Angebot entschieden haben: Würden Sie uns den Grund nennen? Ein Klick genügt.",
  fbPrice: "Der Preis",
  fbDeadline: "Die Frist",
  fbNoNeed: "Ich brauche es nicht mehr",
  fbElsewhere: "Ich habe einen anderen Übersetzer beauftragt",
  fbOther: "Anderer Grund",
  fbThanks: "Danke für Ihre Rückmeldung. Sie hilft uns, besser zu werden.",
  fbPickReason: "Bitte wählen Sie einen Grund.",
  fbNote: "Möchten Sie uns noch etwas mitteilen? (optional)",
  fbSend: "Grund senden",
  fbSending: "Wird gesendet…",
  fbErrSend: "Senden war nicht möglich.",
  fbErrRetry: "Senden war nicht möglich. Bitte versuchen Sie es erneut.",
  docsAllThere: "Ist alles dabei?",
  docsAllThereHelp: "Prüfen Sie, ob hier alle zu übersetzenden Dokumente enthalten sind.",
  docsYes: "Ja, alles dabei",
  docsMissing: "Es fehlt etwas",
  docsConfirmed: "Perfekt: Dokumente bestätigt.",
  docsTapHint: "Tippen Sie auf ein Dokument, um es zu vergrößern.",
  docsClose: "Schließen",
  missTitle: "Fehlendes hinzufügen",
  missHelp: "Laden Sie eine oder mehrere Dateien hoch (PDF oder Bild, je bis 20 MB) und sagen Sie uns gern, was fehlt.",
  missPick: "Dateien auswählen",
  missNote: "Notiz (optional)",
  missSend: "Dokumente senden",
  missSending: "Wird gesendet…",
  missCancel: "Abbrechen",
  missDone: "Erhalten. Wir senden Ihnen das aktualisierte Angebot.",
  missPendingWarn: "Sie haben Dokumente hinzugefügt: Warten Sie auf die neue Version oder zahlen Sie nur das, was angeboten wurde.",
  missErrType: "Nur PDF und Bilder sind erlaubt (JPG, PNG, WEBP, HEIC, TIFF).",
  missErrSize: "Jede Datei muss kleiner als 20 MB sein.",
  missErrCount: "Höchstens 10 Dateien pro Sendung.",
  missErrNone: "Wählen Sie mindestens eine Datei.",
  missErrSend: "Das Senden war nicht möglich. Bitte versuchen Sie es erneut.",
  billTitle: "Prüfen Sie Ihre Rechnungsdaten",
  billHelp: "Wir verwenden sie für Ihre Rechnung. Sie können sie korrigieren.",
  billName: "Name oder Firmenname",
  billNif: "Steuernummer (optional)",
  billAddress: "Adresse",
  billPostal: "Postleitzahl",
  billCity: "Stadt",
  billCountry: "Land",
  billFromDoc: "Aus Ihrem Dokument gelesen: bitte prüfen",
  billSimplified: "Ohne Steuernummer stellen wir eine Kleinbetragsrechnung aus (bis 400 €).",
  billNifRequired: "Bei Beträgen über 400 € benötigen wir Ihre Steuernummer für die Rechnung.",
  billNameRequired: "Geben Sie Ihren Namen oder Firmennamen an.",
  billAddressRequired: "Mit Steuernummer benötigen wir auch Adresse, Postleitzahl und Stadt.",
  billSave: "Daten speichern",
  billSaving: "Wird gespeichert…",
  billSaved: "Daten gespeichert. Sie werden bei der Zahlung in Ihre Rechnung übernommen.",
  billEdit: "Bearbeiten",
  billErr: "Die Daten konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.",
  payStepTitle: "Bezahlen",
  billSuggest: "Ist das der Rechnungsempfänger?",
  billUse: "Übernehmen",
};

const DICTS: Record<PublicLang, PublicDict> = { es: ES, en: EN, fr: FR, pt: PT, it: IT, de: DE };

export function publicDict(lang: PublicLang): PublicDict {
  return DICTS[lang] ?? ES;
}

/** Etiqueta del estado del presupuesto en el idioma del cliente. */
export function statusLabel(status: string, lang: PublicLang): string {
  const mapa: Record<PublicLang, Record<string, string>> = {
    es: { DRAFT: "Borrador", SENT: "Enviado", OPENED: "Abierto", ACCEPTED: "Aceptado", PAID: "Pagado", IN_PROGRESS: "En curso", DELIVERED: "Entregado", EXPIRED: "Caducado" },
    en: { DRAFT: "Draft", SENT: "Sent", OPENED: "Opened", ACCEPTED: "Accepted", PAID: "Paid", IN_PROGRESS: "In progress", DELIVERED: "Delivered", EXPIRED: "Expired" },
    fr: { DRAFT: "Brouillon", SENT: "Envoyé", OPENED: "Ouvert", ACCEPTED: "Accepté", PAID: "Payé", IN_PROGRESS: "En cours", DELIVERED: "Livré", EXPIRED: "Expiré" },
    pt: { DRAFT: "Rascunho", SENT: "Enviado", OPENED: "Aberto", ACCEPTED: "Aceito", PAID: "Pago", IN_PROGRESS: "Em andamento", DELIVERED: "Entregue", EXPIRED: "Expirado" },
    it: { DRAFT: "Bozza", SENT: "Inviato", OPENED: "Aperto", ACCEPTED: "Accettato", PAID: "Pagato", IN_PROGRESS: "In corso", DELIVERED: "Consegnato", EXPIRED: "Scaduto" },
    de: { DRAFT: "Entwurf", SENT: "Gesendet", OPENED: "Geöffnet", ACCEPTED: "Angenommen", PAID: "Bezahlt", IN_PROGRESS: "In Bearbeitung", DELIVERED: "Geliefert", EXPIRED: "Abgelaufen" },
  };
  return mapa[lang]?.[status] ?? mapa.es[status] ?? status;
}
