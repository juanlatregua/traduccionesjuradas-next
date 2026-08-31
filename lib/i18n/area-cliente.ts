// lib/i18n/area-cliente.ts — Diccionario i18n del ÁREA DE CLIENTE (es|fr|en).
//
// Idioma del cliente: Order.clientLocale. En la BD suele ser es|fr, pero un cliente
// de otro idioma (en/de/pt…) debe ver INGLÉS como lengua internacional. Regla
// (acLang): "fr"→francés · "es"/sin idioma→español (mercado base) · cualquier otro→inglés.
//
// El sitio público (SEO) soporta 5 idiomas vía prefijo de ruta; la zona privada del
// cliente solo materializa 3 columnas (es/fr/en), suficientes para todo cliente real.
//
// Terminología FR (revisión estricta, dominio traducción jurada / administrativo):
//   pedido = commande · presupuesto = devis · factura = facture · comprobante/justificante
//   = justificatif · transferencia = virement · subir = téléverser · concepto (banco) =
//   motif · envío físico = envoi postal · datos fiscales = données fiscales · zona de
//   cliente = espace client · traducción jurada = traduction assermentée.

export type AcLang = "es" | "fr" | "en";

/** Normaliza un locale a la columna del diccionario. Otros idiomas → inglés internacional. */
export function acLang(locale?: string | null): AcLang {
  if (locale === "fr") return "fr";
  if (!locale || locale === "es") return "es";
  return "en";
}

/** Locale BCP-47 para Intl (fechas/moneda) según el idioma del cliente. */
export function acIntl(locale?: string | null): string {
  const l = acLang(locale);
  return l === "fr" ? "fr-FR" : l === "en" ? "en-GB" : "es-ES";
}

const es = {
  common: {
    backHome: "Volver al inicio",
    backClientArea: "Volver al área de cliente",
    reference: "Referencia",
    date: "Fecha",
    description: "Descripción",
    amount: "Importe",
    total: "Total",
    payment: "Pago",
    status: "Estado",
    download: "Descarga",
    languages: "Idiomas",
    invoiceNumberShort: "Nº",
    open: "Abrir",
    download1: "Descargar",
    translationN: (i: number) => `Traducción ${i}`,
  },

  index: {
    metaTitle: "Área de cliente",
    metaDescription: "Tu zona: presupuestos, pedidos, facturas y descargas.",
    gateTitle: "Tu zona de cliente",
    gateIntro:
      "Recibe un enlace de acceso a tu email y entra a todos tus presupuestos, pedidos, facturas y descargas.",
    gateLookupPrompt: "¿Solo quieres consultar un pedido por su referencia?",
    gateGooglePrompt: "También puedes entrar con Google:",
    googleSignIn: "Entrar con Google",
    eyebrow: "Tu zona de cliente",
    fiscalData: "Datos fiscales",
    nif: "NIF",
    statQuotes: "Presupuestos",
    statOrders: "Pedidos",
    statDelivered: "Entregados",
    statInvoices: "Facturas",
    uploadNewOrder: "Subir documentos · pedido nuevo",
    signOut: "Cerrar sesión",
    translatorZone: "Zona traductor",
    myClients: "Mis clientes",
    myClientsIntro:
      "Los clientes que gestionas. Abre uno para ver sus pedidos, presupuestos y descargas.",
    myOrders: "Mis pedidos",
    noOrders: "Aún no tienes pedidos.",
    thDescription: "Descripción",
    thPayment: "Pago",
    shipmentTracking: (t: string) => ` · envío ${t}`,
    sameCase: (refs: string) => `Junto con ${refs}`,
    myQuotes: "Mis presupuestos",
    thQuoteDate: "Fecha de encargo",
    quoteSeeReceipt: "Ver recibo",
    quoteSeePay: "Ver / pagar",
    quoteSee: "Ver",
    myInvoices: "Mis facturas",
    invoicePaid: "· cobrada",
    invoicePdfHint: "¿Necesitas el PDF de una factura? Escríbenos y te lo enviamos.",
  },

  pedido: {
    metaTitle: "Estado de pedido",
    metaDescription: "Seguimiento del pedido, presupuesto, pago e historial.",
    eyebrowReference: (ref: string) => `Referencia ${ref}`,
    title: "Estado de tu pedido",
    dateAndPair: (date: string, pair: string) => `Fecha: ${date} · Combinación: ${pair}`,
    cardQuote: "Presupuesto",
    paymentVerification: "Verificación de pago",
    paymentVerified: "Pago confirmado",
    paymentProofPending: "Comprobante enviado (pendiente de verificación)",
    paymentPending: "Pendiente de pago",
    noticeUnderReview:
      "Tu pedido está en revisión interna para validar precio y plazo. Te enviaremos el enlace de pago en cuanto esté confirmado.",
    noticeQuoteSent:
      "Ya hemos enviado tu presupuesto final. Puedes completar el pago desde la pantalla de pago del pedido.",
    eta: "Fecha estimada de entrega",
    detailTitle: "Detalle del pedido",
    concept: "Concepto",
    words: "Palabras",
    scope: "Alcance",
    sourceDocTitle: "Documento original",
    sourceDocEmpty: "Aún no hay documento fuente adjunto en este pedido.",
    seeDocument: "Ver documento",
    noDate: "Sin fecha",
    proofTitle: "Comprobante de pago",
    proofEmpty: "Aún no hemos recibido ningún comprobante en este pedido.",
    seeProof: "Ver comprobante",
    timelineTitle: "Agenda del pedido",
    timelineCreated: (d: string) => `Pedido creado: ${d}`,
    timelineProof: (d: string) => `Comprobante recibido: ${d}`,
    timelinePaid: (d: string) => `Pago confirmado: ${d}`,
    timelineEta: (d: string) => `ETA entrega: ${d}`,
    timelineDone: "Traducción finalizada",
    invoiceTitle: "Factura",
    invoiceBillingData: (name: string, nif: string) =>
      `Datos de facturación registrados a nombre de ${name} (${nif}).`,
    invoiceDownload: "Descargar factura PDF",
    filesTitleOne: "Archivo traducido",
    filesTitleMany: (n: number) => `Archivos traducidos (${n})`,
    filesEmpty:
      "Aún no hay archivo disponible. Te avisaremos cuando el pedido pase a estado traducido.",
    fileDownloadOne: "Descargar PDF traducido",
    fileTranslationN: (i: number) => `Traducción ${i} (PDF)`,
    historyTitle: "Historial",
    historyEmpty: "Sin eventos registrados.",
  },

  panel: {
    deliveryTitle: "Entrega",
    modeChosen: "Modalidad elegida",
    shippingRegistered: "Datos de envío registrados",
    shippingMissing: "Faltan datos de envío",
    phName: "Nombre y apellidos",
    phPhone: "Teléfono",
    phAddress: "Dirección",
    phCity: "Ciudad",
    phProvince: "Provincia",
    phPostalCode: "Código postal",
    phCountry: "País",
    saveShipping: "Guardar datos de envío",
    shippingComplete: "Datos de envío completos",
    shippingPending: "Pendiente completar datos de envío",
    noShippingNeeded: "No se requieren datos de envío. Recibirás el documento por PDF firmado.",
    paymentTitle: "Pago",
    paymentDone: "Pago completado.",
    paymentMethods: "Selecciona método: tarjeta, Bizum, PayPal o transferencia.",
    goToPay: "Ir a pagar",
    billingTitle: "Facturación",
    requestInvoice: "Solicitar factura",
    phFiscalName: "Nombre fiscal / Empresa",
    phNif: "NIF / CIF / VAT",
    phFiscalAddress: "Dirección fiscal",
    phInvoiceEmail: "Email para factura",
    saveBilling: "Guardar datos de facturación",
    billingComplete: "Datos de facturación completos",
    billingPending: "Pendiente completar datos de facturación",
    billingNotRequested: "Factura no solicitada",
    requesting: "Solicitando...",
    invoiceHistoryTitle: "Historial de facturas",
    invoiceHistoryEmpty: "Sin movimientos de facturación.",
    noticeShippingSaved: "Datos de envío guardados correctamente.",
    errShippingSave: "Error al guardar datos de envío.",
    errShippingConn: "Error de conexión al guardar datos de envío.",
    noticeBillingSaved: "Datos de facturación guardados correctamente.",
    errBillingSave: "Error al guardar datos de facturación.",
    errBillingConn: "Error de conexión al guardar datos de facturación.",
    errCheckRequest: "Marca la opción de solicitar factura.",
    errCompleteFiscal: "Completa todos los datos fiscales antes de solicitar la factura.",
    noticeInvoiceRequested: "Solicitud de factura enviada correctamente.",
    errInvoiceRequest: "No se pudo solicitar la factura.",
    errInvoiceConn: "Error de conexión al solicitar factura.",
  },

  subcliente: {
    metaTitle: "Cliente — zona",
    back: "← Mis clientes",
    eyebrow: "Cliente que gestionas",
    readOnly: "solo consulta",
    orders: "Pedidos",
    noOrders: "Sin pedidos.",
    quotes: "Presupuestos",
    invoices: "Facturas",
  },

  pagar: {
    loading: "Cargando datos del pedido...",
    notFound: "Pedido no encontrado.",
    connError: "Error de conexión.",
    alreadyPaid: "Este pedido ya está pagado.",
    seePaymentConfirmation: "Ver confirmación de pago",
    checkOrderStatus: "Consultar estado del pedido",
    underReviewTitle: "Pedido en revisión interna",
    underReviewBody: (ref: string) =>
      `Tu pedido ${ref} se está validando antes de habilitar el pago. Te avisaremos por email cuando esté listo.`,
    proofReceivedTitle: "Comprobante recibido",
    proofReceivedBody: (ref: string) =>
      `Hemos recibido tu comprobante para el pedido ${ref}. Lo verificamos y te confirmamos el pago en breve por email.`,
    proofReceivedFollow: "Puedes seguir el avance desde tu área de cliente.",
    eyebrow: "Pagar pedido",
    refAndAmount: (ref: string, amount: string) => `Referencia: ${ref} · Importe: ${amount}`,
    recommendedFlow:
      "Flujo recomendado: revisa tu documento, elige método de pago y confirma el justificante si aplica.",
    mustUploadSource: "Para continuar al pago primero debes subir al menos un documento original.",
    reviewDocTitle: "Revisa tu documento",
    docsReceived: (n: number) =>
      `Ya hemos recibido ${n} documento(s). Revisa miniatura y abre el archivo para confirmar que es correcto.`,
    docExists:
      "Ya consta al menos un documento en el pedido. Puedes subir otro si necesitas reemplazarlo.",
    docHint:
      "Si ya lo enviaste por email o WhatsApp, no necesitas subirlo de nuevo. Solo adjúntalo aquí si quieres reemplazarlo o asegurarte de que aparece en el pedido.",
    openDocument: "Abrir documento",
    uploadOrReplace: "Subir o reemplazar documento",
    uploadSourceRequired: "Subir documento original (obligatorio para pagar)",
    sourceRegistered: "Documento fuente registrado correctamente.",
    uploading: "Subiendo...",
    saveDocInOrder: "Guardar documento en el pedido",
    errUploadSourceFirst: "Sube el documento original antes de continuar al pago.",
    errProofNeedsSource: "Debes subir primero el documento original para poder enviar el comprobante.",
    errProofUnavailable: "La subida automática de justificantes está temporalmente no disponible.",
    errProofUpload: "Error al subir el comprobante.",
    errDocsUnavailable: "La subida automática de documentos está temporalmente no disponible.",
    errDocUpload: "Error al subir el documento.",
    errCardStart: "No se pudo iniciar el pago con tarjeta.",
    errNoPayUrl: "No se recibió URL de pago.",
    tabCard: "Tarjeta",
    tabPaypal: "PayPal",
    tabBizum: "Bizum",
    tabTransfer: "Transferencia",
    cardTitle: "Pago con tarjeta",
    cardSecure: "El pago se procesa de forma segura y la confirmación se refleja automáticamente.",
    cardRedirecting: "Redirigiendo...",
    cardPayNow: "Pagar con tarjeta ahora",
    cardUnavailable: "Tarjeta no disponible en este entorno. Usa Bizum, transferencia o PayPal manual.",
    paypalTitle: "Pago con PayPal",
    paypalAuto: "Completa el pago en PayPal. Al confirmar, te llevamos automáticamente a la confirmación.",
    paypalNeedSource: "Sube primero el documento original para habilitar PayPal.",
    paypalManual:
      "PayPal no está automatizado en este entorno. Puedes pagar por Bizum/transferencia o usar PayPal manual y subir justificante.",
    paypalLink: "Enlace PayPal",
    paypalAccount: "Cuenta PayPal",
    concept: "Concepto",
    bizumPrompt: "Realiza un Bizum con los siguientes datos:",
    includeRefInConcept: (ref: string) => `Incluye la referencia ${ref} en el concepto.`,
    transferPrompt: "Realiza una transferencia bancaria con los siguientes datos:",
    beneficiary: "Beneficiario",
    proofUploadTitle: "Adjunta tu comprobante de pago",
    proofUploadPaypal: "Sube el justificante de PayPal para registrar el pago automáticamente.",
    proofUploadBizumTransfer:
      "Sube una captura del Bizum o el justificante de la transferencia para registrar el pago automáticamente.",
    proofEmailLabel: "Email del pedido (recomendado si no has iniciado sesión)",
    proofEmailPlaceholder: "tu@email.com",
    sending: "Enviando...",
    sendProof: "Enviar comprobante",
    proofNeedsSource: "Sube primero el documento original para habilitar el envío del comprobante.",
    copied: (label: string) => `Copiado: ${label}`,
  },

  // Etiquetas de estado (compartidas). Mantienen los mismos valores que los antiguos
  // helpers de lib/client-area para no cambiar el comportamiento en español.
  statusPayment: {
    PAID: "Pagado",
    FAILED: "Fallido",
    REFUNDED: "Reembolsado",
    PENDING: "Pendiente de pago",
  } as Record<string, string>,
  statusDelivery: {
    EN_PROCESO: "En proceso",
    TRADUCIDO: "Traducido",
    DEFAULT: "Presupuesto emitido",
  } as Record<string, string>,
  deliveryType: {
    envio: "Envío físico",
    pdf: "PDF firmado",
  } as Record<string, string>,
  statusWorkflow: {
    BORRADOR: "Borrador",
    PENDIENTE_REVISION: "Pendiente de revisión interna",
    PRESUPUESTO_ENVIADO: "Presupuesto enviado",
    PENDIENTE_PAGO: "Pendiente de pago",
    JUSTIFICANTE_SUBIDO: "Justificante subido",
    PAGO_VALIDADO: "Pago validado",
    EN_TRADUCCION: "En traducción",
    TRADUCIDO_ENTREGADO: "Traducido y entregado",
    CERRADO: "Cerrado",
    DEFAULT: "Pendiente de pago",
  } as Record<string, string>,
  quoteStatus: {
    DRAFT: "Borrador",
    SENT: "Enviado",
    OPENED: "Abierto",
    ACCEPTED: "Aceptado",
    PAID: "Pagado",
    IN_PROGRESS: "En proceso",
    DELIVERED: "Entregado",
    EXPIRED: "Expirado",
  } as Record<string, string>,
};

type Dict = typeof es;

const fr: Dict = {
  common: {
    backHome: "Retour à l'accueil",
    backClientArea: "Retour à l'espace client",
    reference: "Référence",
    date: "Date",
    description: "Description",
    amount: "Montant",
    total: "Total",
    payment: "Paiement",
    status: "Statut",
    download: "Téléchargement",
    languages: "Langues",
    invoiceNumberShort: "N°",
    open: "Ouvrir",
    download1: "Télécharger",
    translationN: (i: number) => `Traduction ${i}`,
  },

  index: {
    metaTitle: "Espace client",
    metaDescription: "Votre espace : devis, commandes, factures et téléchargements.",
    gateTitle: "Votre espace client",
    gateIntro:
      "Recevez un lien d'accès par e-mail et accédez à tous vos devis, commandes, factures et téléchargements.",
    gateLookupPrompt: "Vous souhaitez simplement consulter une commande par sa référence ?",
    gateGooglePrompt: "Vous pouvez aussi vous connecter avec Google :",
    googleSignIn: "Se connecter avec Google",
    eyebrow: "Votre espace client",
    fiscalData: "Données fiscales",
    nif: "NIF",
    statQuotes: "Devis",
    statOrders: "Commandes",
    statDelivered: "Livrées",
    statInvoices: "Factures",
    uploadNewOrder: "Envoyer des documents · nouvelle commande",
    signOut: "Se déconnecter",
    translatorZone: "Espace traducteur",
    myClients: "Mes clients",
    myClientsIntro:
      "Les clients que vous gérez. Ouvrez-en un pour voir ses commandes, devis et téléchargements.",
    myOrders: "Mes commandes",
    noOrders: "Vous n'avez pas encore de commandes.",
    thDescription: "Description",
    thPayment: "Paiement",
    shipmentTracking: (t: string) => ` · envoi ${t}`,
    sameCase: (refs: string) => `Avec ${refs}`,
    myQuotes: "Mes devis",
    thQuoteDate: "Date de la demande",
    quoteSeeReceipt: "Voir le reçu",
    quoteSeePay: "Voir / payer",
    quoteSee: "Voir",
    myInvoices: "Mes factures",
    invoicePaid: "· payée",
    invoicePdfHint: "Besoin du PDF d'une facture ? Écrivez-nous et nous vous l'envoyons.",
  },

  pedido: {
    metaTitle: "Statut de la commande",
    metaDescription: "Suivi de la commande, devis, paiement et historique.",
    eyebrowReference: (ref: string) => `Référence ${ref}`,
    title: "Statut de votre commande",
    dateAndPair: (date: string, pair: string) => `Date : ${date} · Combinaison : ${pair}`,
    cardQuote: "Devis",
    paymentVerification: "Vérification du paiement",
    paymentVerified: "Paiement confirmé",
    paymentProofPending: "Justificatif envoyé (en attente de vérification)",
    paymentPending: "En attente de paiement",
    noticeUnderReview:
      "Votre commande est en cours de vérification interne pour valider le prix et le délai. Nous vous enverrons le lien de paiement dès qu'elle sera confirmée.",
    noticeQuoteSent:
      "Nous avons envoyé votre devis définitif. Vous pouvez procéder au paiement depuis l'écran de paiement de la commande.",
    eta: "Date de livraison estimée",
    detailTitle: "Détail de la commande",
    concept: "Objet",
    words: "Mots",
    scope: "Volume",
    sourceDocTitle: "Document original",
    sourceDocEmpty: "Aucun document source n'est encore joint à cette commande.",
    seeDocument: "Voir le document",
    noDate: "Sans date",
    proofTitle: "Justificatif de paiement",
    proofEmpty: "Nous n'avons encore reçu aucun justificatif pour cette commande.",
    seeProof: "Voir le justificatif",
    timelineTitle: "Suivi de la commande",
    timelineCreated: (d: string) => `Commande créée : ${d}`,
    timelineProof: (d: string) => `Justificatif reçu : ${d}`,
    timelinePaid: (d: string) => `Paiement confirmé : ${d}`,
    timelineEta: (d: string) => `Livraison estimée : ${d}`,
    timelineDone: "Traduction terminée",
    invoiceTitle: "Facture",
    invoiceBillingData: (name: string, nif: string) =>
      `Données de facturation enregistrées au nom de ${name} (${nif}).`,
    invoiceDownload: "Télécharger la facture (PDF)",
    filesTitleOne: "Fichier traduit",
    filesTitleMany: (n: number) => `Fichiers traduits (${n})`,
    filesEmpty:
      "Aucun fichier disponible pour l'instant. Nous vous préviendrons dès que la traduction sera prête.",
    fileDownloadOne: "Télécharger le PDF traduit",
    fileTranslationN: (i: number) => `Traduction ${i} (PDF)`,
    historyTitle: "Historique",
    historyEmpty: "Aucun événement enregistré.",
  },

  panel: {
    deliveryTitle: "Livraison",
    modeChosen: "Mode choisi",
    shippingRegistered: "Coordonnées d'expédition enregistrées",
    shippingMissing: "Coordonnées d'expédition manquantes",
    phName: "Nom et prénom",
    phPhone: "Téléphone",
    phAddress: "Adresse",
    phCity: "Ville",
    phProvince: "Province",
    phPostalCode: "Code postal",
    phCountry: "Pays",
    saveShipping: "Enregistrer les coordonnées d'expédition",
    shippingComplete: "Coordonnées d'expédition complètes",
    shippingPending: "Coordonnées d'expédition à compléter",
    noShippingNeeded:
      "Aucune coordonnée d'expédition requise. Vous recevrez le document en PDF signé.",
    paymentTitle: "Paiement",
    paymentDone: "Paiement effectué.",
    paymentMethods: "Choisissez un moyen de paiement : carte, Bizum, PayPal ou virement.",
    goToPay: "Procéder au paiement",
    billingTitle: "Facturation",
    requestInvoice: "Demander une facture",
    phFiscalName: "Raison sociale / Entreprise",
    phNif: "NIF / CIF / TVA",
    phFiscalAddress: "Adresse fiscale",
    phInvoiceEmail: "E-mail pour la facture",
    saveBilling: "Enregistrer les données de facturation",
    billingComplete: "Données de facturation complètes",
    billingPending: "Données de facturation à compléter",
    billingNotRequested: "Facture non demandée",
    requesting: "Demande en cours...",
    invoiceHistoryTitle: "Historique de facturation",
    invoiceHistoryEmpty: "Aucun mouvement de facturation.",
    noticeShippingSaved: "Coordonnées d'expédition enregistrées.",
    errShippingSave: "Erreur lors de l'enregistrement des coordonnées d'expédition.",
    errShippingConn: "Erreur de connexion lors de l'enregistrement des coordonnées d'expédition.",
    noticeBillingSaved: "Données de facturation enregistrées.",
    errBillingSave: "Erreur lors de l'enregistrement des données de facturation.",
    errBillingConn: "Erreur de connexion lors de l'enregistrement des données de facturation.",
    errCheckRequest: "Cochez l'option « Demander une facture ».",
    errCompleteFiscal: "Complétez toutes les données fiscales avant de demander la facture.",
    noticeInvoiceRequested: "Demande de facture envoyée.",
    errInvoiceRequest: "Impossible de demander la facture.",
    errInvoiceConn: "Erreur de connexion lors de la demande de facture.",
  },

  subcliente: {
    metaTitle: "Client — espace",
    back: "← Mes clients",
    eyebrow: "Client que vous gérez",
    readOnly: "consultation seule",
    orders: "Commandes",
    noOrders: "Aucune commande.",
    quotes: "Devis",
    invoices: "Factures",
  },

  pagar: {
    loading: "Chargement de la commande...",
    notFound: "Commande introuvable.",
    connError: "Erreur de connexion.",
    alreadyPaid: "Cette commande est déjà payée.",
    seePaymentConfirmation: "Voir la confirmation de paiement",
    checkOrderStatus: "Consulter le statut de la commande",
    underReviewTitle: "Commande en cours de vérification interne",
    underReviewBody: (ref: string) =>
      `Votre commande ${ref} est en cours de validation avant l'activation du paiement. Nous vous préviendrons par e-mail dès qu'elle sera prête.`,
    proofReceivedTitle: "Justificatif reçu",
    proofReceivedBody: (ref: string) =>
      `Nous avons bien reçu votre justificatif pour la commande ${ref}. Nous le vérifions et vous confirmons le paiement sous peu par e-mail.`,
    proofReceivedFollow: "Vous pouvez suivre l'avancement depuis votre espace client.",
    eyebrow: "Payer la commande",
    refAndAmount: (ref: string, amount: string) => `Référence : ${ref} · Montant : ${amount}`,
    recommendedFlow:
      "Procédure recommandée : vérifiez votre document, choisissez un moyen de paiement et confirmez le justificatif le cas échéant.",
    mustUploadSource:
      "Pour continuer vers le paiement, vous devez d'abord téléverser au moins un document original.",
    reviewDocTitle: "Vérifiez votre document",
    docsReceived: (n: number) =>
      `Nous avons reçu ${n} document(s). Vérifiez l'aperçu et ouvrez le fichier pour confirmer qu'il est correct.`,
    docExists:
      "Au moins un document figure déjà dans la commande. Vous pouvez en téléverser un autre pour le remplacer si nécessaire.",
    docHint:
      "Si vous l'avez déjà envoyé par e-mail ou WhatsApp, inutile de le téléverser à nouveau. Joignez-le ici uniquement pour le remplacer ou vous assurer qu'il figure dans la commande.",
    openDocument: "Ouvrir le document",
    uploadOrReplace: "Téléverser ou remplacer un document",
    uploadSourceRequired: "Téléverser le document original (obligatoire pour payer)",
    sourceRegistered: "Document original enregistré.",
    uploading: "Téléversement...",
    saveDocInOrder: "Enregistrer le document dans la commande",
    errUploadSourceFirst: "Téléversez le document original avant de continuer vers le paiement.",
    errProofNeedsSource:
      "Vous devez d'abord téléverser le document original pour pouvoir envoyer le justificatif.",
    errProofUnavailable:
      "Le téléversement automatique des justificatifs est temporairement indisponible.",
    errProofUpload: "Erreur lors de l'envoi du justificatif.",
    errDocsUnavailable:
      "Le téléversement automatique des documents est temporairement indisponible.",
    errDocUpload: "Erreur lors du téléversement du document.",
    errCardStart: "Impossible de lancer le paiement par carte.",
    errNoPayUrl: "Aucune URL de paiement reçue.",
    tabCard: "Carte",
    tabPaypal: "PayPal",
    tabBizum: "Bizum",
    tabTransfer: "Virement",
    cardTitle: "Paiement par carte",
    cardSecure:
      "Le paiement est traité de manière sécurisée et la confirmation est enregistrée automatiquement.",
    cardRedirecting: "Redirection...",
    cardPayNow: "Payer par carte maintenant",
    cardUnavailable:
      "Carte indisponible dans cet environnement. Utilisez Bizum, le virement ou PayPal manuel.",
    paypalTitle: "Paiement par PayPal",
    paypalAuto:
      "Effectuez le paiement sur PayPal. Une fois confirmé, vous serez automatiquement redirigé vers la confirmation.",
    paypalNeedSource: "Téléversez d'abord le document original pour activer PayPal.",
    paypalManual:
      "PayPal n'est pas automatisé dans cet environnement. Vous pouvez payer par Bizum/virement ou utiliser PayPal manuel et téléverser un justificatif.",
    paypalLink: "Lien PayPal",
    paypalAccount: "Compte PayPal",
    concept: "Motif",
    bizumPrompt: "Effectuez un Bizum avec les informations suivantes :",
    includeRefInConcept: (ref: string) => `Indiquez la référence ${ref} dans le motif.`,
    transferPrompt: "Effectuez un virement bancaire avec les informations suivantes :",
    beneficiary: "Bénéficiaire",
    proofUploadTitle: "Joignez votre justificatif de paiement",
    proofUploadPaypal:
      "Téléversez le justificatif PayPal pour enregistrer le paiement automatiquement.",
    proofUploadBizumTransfer:
      "Téléversez une capture du Bizum ou le justificatif du virement pour enregistrer le paiement automatiquement.",
    proofEmailLabel: "E-mail de la commande (recommandé si vous n'êtes pas connecté)",
    proofEmailPlaceholder: "vous@exemple.com",
    sending: "Envoi...",
    sendProof: "Envoyer le justificatif",
    proofNeedsSource:
      "Téléversez d'abord le document original pour activer l'envoi du justificatif.",
    copied: (label: string) => `Copié : ${label}`,
  },

  statusPayment: {
    PAID: "Payé",
    FAILED: "Échoué",
    REFUNDED: "Remboursé",
    PENDING: "En attente de paiement",
  },
  statusDelivery: {
    EN_PROCESO: "En cours",
    TRADUCIDO: "Traduit",
    DEFAULT: "Devis émis",
  },
  deliveryType: {
    envio: "Envoi postal",
    pdf: "PDF signé",
  },
  statusWorkflow: {
    BORRADOR: "Brouillon",
    PENDIENTE_REVISION: "En attente de vérification interne",
    PRESUPUESTO_ENVIADO: "Devis envoyé",
    PENDIENTE_PAGO: "En attente de paiement",
    JUSTIFICANTE_SUBIDO: "Justificatif téléversé",
    PAGO_VALIDADO: "Paiement validé",
    EN_TRADUCCION: "En cours de traduction",
    TRADUCIDO_ENTREGADO: "Traduit et livré",
    CERRADO: "Clôturé",
    DEFAULT: "En attente de paiement",
  },
  quoteStatus: {
    DRAFT: "Brouillon",
    SENT: "Envoyé",
    OPENED: "Ouvert",
    ACCEPTED: "Accepté",
    PAID: "Payé",
    IN_PROGRESS: "En cours",
    DELIVERED: "Livré",
    EXPIRED: "Expiré",
  },
};

const en: Dict = {
  common: {
    backHome: "Back to home",
    backClientArea: "Back to client area",
    reference: "Reference",
    date: "Date",
    description: "Description",
    amount: "Amount",
    total: "Total",
    payment: "Payment",
    status: "Status",
    download: "Download",
    languages: "Languages",
    invoiceNumberShort: "No.",
    open: "Open",
    download1: "Download",
    translationN: (i: number) => `Translation ${i}`,
  },

  index: {
    metaTitle: "Client area",
    metaDescription: "Your area: quotes, orders, invoices and downloads.",
    gateTitle: "Your client area",
    gateIntro:
      "Get an access link by email and view all your quotes, orders, invoices and downloads.",
    gateLookupPrompt: "Just want to check a single order by its reference?",
    gateGooglePrompt: "You can also sign in with Google:",
    googleSignIn: "Sign in with Google",
    eyebrow: "Your client area",
    fiscalData: "Tax details",
    nif: "Tax ID",
    statQuotes: "Quotes",
    statOrders: "Orders",
    statDelivered: "Delivered",
    statInvoices: "Invoices",
    uploadNewOrder: "Upload documents · new order",
    signOut: "Sign out",
    translatorZone: "Translator area",
    myClients: "My clients",
    myClientsIntro:
      "The clients you manage. Open one to see their orders, quotes and downloads.",
    myOrders: "My orders",
    noOrders: "You don't have any orders yet.",
    thDescription: "Description",
    thPayment: "Payment",
    shipmentTracking: (t: string) => ` · shipment ${t}`,
    sameCase: (refs: string) => `Together with ${refs}`,
    myQuotes: "My quotes",
    thQuoteDate: "Request date",
    quoteSeeReceipt: "View receipt",
    quoteSeePay: "View / pay",
    quoteSee: "View",
    myInvoices: "My invoices",
    invoicePaid: "· paid",
    invoicePdfHint: "Need the PDF of an invoice? Write to us and we'll send it.",
  },

  pedido: {
    metaTitle: "Order status",
    metaDescription: "Order tracking, quote, payment and history.",
    eyebrowReference: (ref: string) => `Reference ${ref}`,
    title: "Your order status",
    dateAndPair: (date: string, pair: string) => `Date: ${date} · Language pair: ${pair}`,
    cardQuote: "Quote",
    paymentVerification: "Payment verification",
    paymentVerified: "Payment confirmed",
    paymentProofPending: "Proof of payment sent (pending verification)",
    paymentPending: "Awaiting payment",
    noticeUnderReview:
      "Your order is under internal review to confirm the price and turnaround time. We'll send you the payment link as soon as it's confirmed.",
    noticeQuoteSent:
      "We've sent your final quote. You can complete the payment from the order's payment screen.",
    eta: "Estimated delivery date",
    detailTitle: "Order details",
    concept: "Subject",
    words: "Words",
    scope: "Volume",
    sourceDocTitle: "Original document",
    sourceDocEmpty: "No source document is attached to this order yet.",
    seeDocument: "View document",
    noDate: "No date",
    proofTitle: "Proof of payment",
    proofEmpty: "We haven't received any proof of payment for this order yet.",
    seeProof: "View proof",
    timelineTitle: "Order timeline",
    timelineCreated: (d: string) => `Order created: ${d}`,
    timelineProof: (d: string) => `Proof received: ${d}`,
    timelinePaid: (d: string) => `Payment confirmed: ${d}`,
    timelineEta: (d: string) => `Estimated delivery: ${d}`,
    timelineDone: "Translation completed",
    invoiceTitle: "Invoice",
    invoiceBillingData: (name: string, nif: string) =>
      `Billing details registered under ${name} (${nif}).`,
    invoiceDownload: "Download invoice (PDF)",
    filesTitleOne: "Translated file",
    filesTitleMany: (n: number) => `Translated files (${n})`,
    filesEmpty:
      "No file available yet. We'll notify you once the translation is ready.",
    fileDownloadOne: "Download translated PDF",
    fileTranslationN: (i: number) => `Translation ${i} (PDF)`,
    historyTitle: "History",
    historyEmpty: "No events recorded.",
  },

  panel: {
    deliveryTitle: "Delivery",
    modeChosen: "Chosen method",
    shippingRegistered: "Shipping details saved",
    shippingMissing: "Shipping details missing",
    phName: "Full name",
    phPhone: "Phone",
    phAddress: "Address",
    phCity: "City",
    phProvince: "Province",
    phPostalCode: "Postal code",
    phCountry: "Country",
    saveShipping: "Save shipping details",
    shippingComplete: "Shipping details complete",
    shippingPending: "Shipping details to be completed",
    noShippingNeeded: "No shipping details required. You'll receive the document as a signed PDF.",
    paymentTitle: "Payment",
    paymentDone: "Payment completed.",
    paymentMethods: "Choose a method: card, Bizum, PayPal or bank transfer.",
    goToPay: "Proceed to payment",
    billingTitle: "Billing",
    requestInvoice: "Request an invoice",
    phFiscalName: "Legal name / Company",
    phNif: "Tax ID / VAT",
    phFiscalAddress: "Billing address",
    phInvoiceEmail: "Email for the invoice",
    saveBilling: "Save billing details",
    billingComplete: "Billing details complete",
    billingPending: "Billing details to be completed",
    billingNotRequested: "Invoice not requested",
    requesting: "Requesting...",
    invoiceHistoryTitle: "Billing history",
    invoiceHistoryEmpty: "No billing activity.",
    noticeShippingSaved: "Shipping details saved.",
    errShippingSave: "Error saving shipping details.",
    errShippingConn: "Connection error while saving shipping details.",
    noticeBillingSaved: "Billing details saved.",
    errBillingSave: "Error saving billing details.",
    errBillingConn: "Connection error while saving billing details.",
    errCheckRequest: "Tick the “Request an invoice” option.",
    errCompleteFiscal: "Complete all tax details before requesting the invoice.",
    noticeInvoiceRequested: "Invoice request sent.",
    errInvoiceRequest: "The invoice could not be requested.",
    errInvoiceConn: "Connection error while requesting the invoice.",
  },

  subcliente: {
    metaTitle: "Client — area",
    back: "← My clients",
    eyebrow: "Client you manage",
    readOnly: "view only",
    orders: "Orders",
    noOrders: "No orders.",
    quotes: "Quotes",
    invoices: "Invoices",
  },

  pagar: {
    loading: "Loading order details...",
    notFound: "Order not found.",
    connError: "Connection error.",
    alreadyPaid: "This order has already been paid.",
    seePaymentConfirmation: "View payment confirmation",
    checkOrderStatus: "Check order status",
    underReviewTitle: "Order under internal review",
    underReviewBody: (ref: string) =>
      `Your order ${ref} is being validated before payment is enabled. We'll notify you by email once it's ready.`,
    proofReceivedTitle: "Proof of payment received",
    proofReceivedBody: (ref: string) =>
      `We've received your proof of payment for order ${ref}. We'll verify it and confirm your payment shortly by email.`,
    proofReceivedFollow: "You can track progress from your client area.",
    eyebrow: "Pay order",
    refAndAmount: (ref: string, amount: string) => `Reference: ${ref} · Amount: ${amount}`,
    recommendedFlow:
      "Recommended steps: review your document, choose a payment method and confirm the proof of payment if applicable.",
    mustUploadSource: "To continue to payment, you must first upload at least one original document.",
    reviewDocTitle: "Review your document",
    docsReceived: (n: number) =>
      `We've received ${n} document(s). Check the preview and open the file to confirm it's correct.`,
    docExists:
      "At least one document is already on file for this order. You can upload another one to replace it if needed.",
    docHint:
      "If you already sent it by email or WhatsApp, you don't need to upload it again. Attach it here only to replace it or to make sure it appears in the order.",
    openDocument: "Open document",
    uploadOrReplace: "Upload or replace a document",
    uploadSourceRequired: "Upload the original document (required to pay)",
    sourceRegistered: "Original document saved.",
    uploading: "Uploading...",
    saveDocInOrder: "Save document to the order",
    errUploadSourceFirst: "Upload the original document before continuing to payment.",
    errProofNeedsSource: "You must first upload the original document in order to send the proof of payment.",
    errProofUnavailable: "Automatic upload of proofs of payment is temporarily unavailable.",
    errProofUpload: "Error sending the proof of payment.",
    errDocsUnavailable: "Automatic document upload is temporarily unavailable.",
    errDocUpload: "Error uploading the document.",
    errCardStart: "Card payment could not be started.",
    errNoPayUrl: "No payment URL received.",
    tabCard: "Card",
    tabPaypal: "PayPal",
    tabBizum: "Bizum",
    tabTransfer: "Bank transfer",
    cardTitle: "Card payment",
    cardSecure: "Payment is processed securely and the confirmation is recorded automatically.",
    cardRedirecting: "Redirecting...",
    cardPayNow: "Pay by card now",
    cardUnavailable: "Card unavailable in this environment. Use Bizum, bank transfer or manual PayPal.",
    paypalTitle: "PayPal payment",
    paypalAuto: "Complete the payment on PayPal. Once confirmed, you'll be redirected automatically to the confirmation.",
    paypalNeedSource: "Upload the original document first to enable PayPal.",
    paypalManual:
      "PayPal is not automated in this environment. You can pay by Bizum/bank transfer or use manual PayPal and upload a proof of payment.",
    paypalLink: "PayPal link",
    paypalAccount: "PayPal account",
    concept: "Payment reference",
    bizumPrompt: "Make a Bizum payment with the following details:",
    includeRefInConcept: (ref: string) => `Include reference ${ref} in the payment reference.`,
    transferPrompt: "Make a bank transfer with the following details:",
    beneficiary: "Beneficiary",
    proofUploadTitle: "Attach your proof of payment",
    proofUploadPaypal: "Upload the PayPal receipt to register the payment automatically.",
    proofUploadBizumTransfer:
      "Upload a screenshot of the Bizum or the transfer receipt to register the payment automatically.",
    proofEmailLabel: "Order email (recommended if you're not signed in)",
    proofEmailPlaceholder: "you@example.com",
    sending: "Sending...",
    sendProof: "Send proof of payment",
    proofNeedsSource: "Upload the original document first to enable sending the proof of payment.",
    copied: (label: string) => `Copied: ${label}`,
  },

  statusPayment: {
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded",
    PENDING: "Awaiting payment",
  },
  statusDelivery: {
    EN_PROCESO: "In progress",
    TRADUCIDO: "Translated",
    DEFAULT: "Quote issued",
  },
  deliveryType: {
    envio: "Postal delivery",
    pdf: "Signed PDF",
  },
  statusWorkflow: {
    BORRADOR: "Draft",
    PENDIENTE_REVISION: "Awaiting internal review",
    PRESUPUESTO_ENVIADO: "Quote sent",
    PENDIENTE_PAGO: "Awaiting payment",
    JUSTIFICANTE_SUBIDO: "Proof uploaded",
    PAGO_VALIDADO: "Payment validated",
    EN_TRADUCCION: "In translation",
    TRADUCIDO_ENTREGADO: "Translated and delivered",
    CERRADO: "Closed",
    DEFAULT: "Awaiting payment",
  },
  quoteStatus: {
    DRAFT: "Draft",
    SENT: "Sent",
    OPENED: "Opened",
    ACCEPTED: "Accepted",
    PAID: "Paid",
    IN_PROGRESS: "In progress",
    DELIVERED: "Delivered",
    EXPIRED: "Expired",
  },
};

const AC: Record<AcLang, Dict> = { es, fr, en };

/** Diccionario del área de cliente para el idioma del cliente (es|fr|en). */
export function getAc(locale?: string | null): Dict {
  return AC[acLang(locale)];
}

// ── Etiquetas de estado (fuente única, con idioma) ───────────────────────────
// Mantienen la firma retrocompatible: sin `locale` → español (no cambia el
// comportamiento de los llamadores existentes, p. ej. GuestOrderLookup).

export function getPaymentStateLabel(status: string, locale?: string | null) {
  const t = getAc(locale).statusPayment;
  return t[status] || t.PENDING;
}

export function getDeliveryStateLabel(state: string, locale?: string | null) {
  const t = getAc(locale).statusDelivery;
  return t[state] || t.DEFAULT;
}

export function getDeliveryTypeLabel(type: string, locale?: string | null) {
  const t = getAc(locale).deliveryType;
  return type === "envio" ? t.envio : t.pdf;
}

export function getWorkflowStateLabel(state?: string | null, locale?: string | null) {
  const t = getAc(locale).statusWorkflow;
  return t[String(state || "")] || t.DEFAULT;
}

export function getQuoteStatusLabel(status: string, locale?: string | null) {
  const t = getAc(locale).quoteStatus;
  return t[status] || status;
}
