// lib/chat/ui-strings.ts — Textos del asistente (widget flotante y panel
// anclado de la portada) en los dos idiomas que habla el chat: es y fr.
// El servidor (/api/chat) detecta el idioma del mensaje por su cuenta.

export type ChatLang = "es" | "fr" | "en" | "de" | "pt";

export type QuickReply = { label: string; emoji: string; isWhatsApp?: boolean };

export type ChatStrings = {
  headerTitle: string;
  online: string;
  dialogAria: string;
  openAria: string;
  closeAria: string;
  clearAria: string;
  welcome: string;
  quickReplies: QuickReply[];
  quickRepliesAria: string;
  gateIntro: string;
  gateEmailPlaceholder: string;
  gateStart: string;
  gateConsent: string;
  privacyLabel: string;
  gateErrEmail: string;
  gateErrConsent: string;
  gateErrNeedEmail: string;
  queuedLabel: string;
  inputPlaceholder: string;
  inputAria: string;
  attachAria: string;
  sendAria: string;
  removeAttachment: (name: string) => string;
  attachErrType: string;
  attachErrSize: string;
  attachErrRead: string;
  errGeneric: string;
  errConn: string;
  rateLimitedText: string;
  rateLimitedCta: string;
  newConversation: string;
};

export const CHAT_UI: Record<ChatLang, ChatStrings> = {
  es: {
    headerTitle: "Asistente · traduccionesjuradas.net",
    online: "En línea",
    dialogAria: "Asistente virtual",
    openAria: "Abrir asistente virtual",
    closeAria: "Cerrar asistente",
    clearAria: "Limpiar conversación",
    welcome:
      "¡Hola! Soy el asistente de traduccionesjuradas.net. ¿En qué puedo ayudarte?\n\nPuedo orientarte sobre:\n• Precio de tu traducción jurada\n• Plazos de entrega\n• Documentos necesarios para tu trámite\n• Paquete teletrabajo Marruecos → España\n\n📎 Tip: puedes adjuntar una foto de tu documento y te digo al instante el precio orientativo. ¿No sabes cómo escanear bien? [Mira esta guía rápida](/como-escanear-bien).",
    quickReplies: [
      { label: "Precio cerrado", emoji: "💰" },
      { label: "Documentos necesarios", emoji: "📋" },
      { label: "Teletrabajo Marruecos", emoji: "🇲🇦" },
      { label: "Hablar por WhatsApp", emoji: "📱", isWhatsApp: true },
    ],
    quickRepliesAria: "Respuestas rápidas",
    gateIntro: "Para usar el asistente, indícanos tu email:",
    gateEmailPlaceholder: "tu@email.com",
    gateStart: "Empezar",
    gateConsent: "Consiento el tratamiento de mis datos para atender mi consulta.",
    privacyLabel: "Política de privacidad",
    gateErrEmail: "Indica un email válido.",
    gateErrConsent: "Acepta el tratamiento de tus datos para continuar.",
    gateErrNeedEmail: "Indica primero tu email para usar el asistente.",
    queuedLabel: "Tu pregunta:",
    inputPlaceholder: "Escribe tu consulta...",
    inputAria: "Mensaje",
    attachAria: "Adjuntar imagen",
    sendAria: "Enviar mensaje",
    removeAttachment: (n) => `Quitar ${n}`,
    attachErrType: "Formato no permitido. Usa JPG, PNG o WEBP.",
    attachErrSize: "Imagen demasiado grande (máximo 5 MB).",
    attachErrRead: "No se pudo leer el archivo.",
    errGeneric: "Lo siento, ha ocurrido un error. Inténtalo de nuevo.",
    errConn: "Lo siento, ha ocurrido un error de conexión. Inténtalo de nuevo o escríbenos por WhatsApp.",
    rateLimitedText: "Para continuar la conversación y enviar documentos, te recomiendo escribirnos por WhatsApp:",
    rateLimitedCta: "Continuar por WhatsApp",
    newConversation: "Nueva conversación",
  },
  fr: {
    headerTitle: "Assistant · traduccionesjuradas.net",
    online: "En ligne",
    dialogAria: "Assistant virtuel",
    openAria: "Ouvrir l'assistant virtuel",
    closeAria: "Fermer l'assistant",
    clearAria: "Effacer la conversation",
    welcome:
      "Bonjour ! Je suis l'assistant de traduccionesjuradas.net. Comment puis-je vous aider ?\n\nJe peux vous orienter sur :\n• Le prix de votre traduction assermentée\n• Les délais de livraison\n• Les documents nécessaires pour votre démarche (nationalité, diplôme, mariage, achat immobilier…)\n\n📎 Astuce : joignez une photo de votre document et je vous indique le prix indicatif tout de suite.",
    quickReplies: [
      { label: "Prix", emoji: "💰" },
      { label: "Documents nécessaires", emoji: "📋" },
      { label: "Acheter un bien en Espagne", emoji: "🏠" },
      { label: "Parler sur WhatsApp", emoji: "📱", isWhatsApp: true },
    ],
    quickRepliesAria: "Réponses rapides",
    gateIntro: "Pour utiliser l'assistant, indiquez votre e-mail :",
    gateEmailPlaceholder: "votre@email.fr",
    gateStart: "Commencer",
    gateConsent: "J'accepte le traitement de mes données pour répondre à ma demande.",
    privacyLabel: "Politique de confidentialité",
    gateErrEmail: "Indiquez un e-mail valide.",
    gateErrConsent: "Acceptez le traitement de vos données pour continuer.",
    gateErrNeedEmail: "Indiquez d'abord votre e-mail pour utiliser l'assistant.",
    queuedLabel: "Votre question :",
    inputPlaceholder: "Écrivez votre question...",
    inputAria: "Message",
    attachAria: "Joindre une image",
    sendAria: "Envoyer le message",
    removeAttachment: (n) => `Retirer ${n}`,
    attachErrType: "Format non accepté. Utilisez JPG, PNG ou WEBP.",
    attachErrSize: "Image trop lourde (5 Mo maximum).",
    attachErrRead: "Impossible de lire le fichier.",
    errGeneric: "Désolé, une erreur s'est produite. Réessayez.",
    errConn: "Désolé, erreur de connexion. Réessayez ou écrivez-nous sur WhatsApp.",
    rateLimitedText: "Pour continuer la conversation et envoyer des documents, écrivez-nous sur WhatsApp :",
    rateLimitedCta: "Continuer sur WhatsApp",
    newConversation: "Nouvelle conversation",
  },
  en: {
    headerTitle: "Assistant · traduccionesjuradas.net",
    online: "Online",
    dialogAria: "Virtual assistant",
    openAria: "Open virtual assistant",
    closeAria: "Close assistant",
    clearAria: "Clear conversation",
    welcome:
      "Hello! I'm the traduccionesjuradas.net assistant. How can I help?\n\nI can guide you on:\n• The price of your sworn translation\n• Delivery times\n• The documents you need",
    quickReplies: [
      { label: "Price", emoji: "💰" },
      { label: "Documents I need", emoji: "📋" },
      { label: "Chat on WhatsApp", emoji: "📱", isWhatsApp: true },
    ],
    quickRepliesAria: "Quick replies",
    gateIntro: "To use the assistant, please enter your email:",
    gateEmailPlaceholder: "you@email.com",
    gateStart: "Start",
    gateConsent: "I consent to the processing of my data to answer my enquiry.",
    privacyLabel: "Privacy policy",
    gateErrEmail: "Please enter a valid email.",
    gateErrConsent: "Please accept the processing of your data to continue.",
    gateErrNeedEmail: "Please enter your email first to use the assistant.",
    queuedLabel: "Your question:",
    inputPlaceholder: "Type your question...",
    inputAria: "Message",
    attachAria: "Attach image",
    sendAria: "Send message",
    removeAttachment: (n) => `Remove ${n}`,
    attachErrType: "Format not allowed. Use JPG, PNG or WEBP.",
    attachErrSize: "Image too large (5 MB maximum).",
    attachErrRead: "The file could not be read.",
    errGeneric: "Sorry, something went wrong. Please try again.",
    errConn: "Sorry, there was a connection error. Please try again or message us on WhatsApp.",
    rateLimitedText: "To continue the conversation and send documents, please message us on WhatsApp:",
    rateLimitedCta: "Continue on WhatsApp",
    newConversation: "New conversation",
  },
  de: {
    headerTitle: "Assistent · traduccionesjuradas.net",
    online: "Online",
    dialogAria: "Virtueller Assistent",
    openAria: "Virtuellen Assistenten öffnen",
    closeAria: "Assistenten schließen",
    clearAria: "Unterhaltung löschen",
    welcome:
      "Guten Tag! Ich bin der Assistent von traduccionesjuradas.net. Wie kann ich Ihnen helfen?\n\nIch berate Sie gerne zu:\n• dem Preis Ihrer beglaubigten Übersetzung\n• den Lieferzeiten\n• den benötigten Dokumenten",
    quickReplies: [
      { label: "Preis", emoji: "💰" },
      { label: "Benötigte Dokumente", emoji: "📋" },
      { label: "Per WhatsApp schreiben", emoji: "📱", isWhatsApp: true },
    ],
    quickRepliesAria: "Schnellantworten",
    gateIntro: "Um den Assistenten zu nutzen, geben Sie bitte Ihre E-Mail-Adresse an:",
    gateEmailPlaceholder: "ihre@email.com",
    gateStart: "Starten",
    gateConsent: "Ich willige in die Verarbeitung meiner Daten zur Bearbeitung meiner Anfrage ein.",
    privacyLabel: "Datenschutzerklärung",
    gateErrEmail: "Bitte geben Sie eine gültige E-Mail-Adresse an.",
    gateErrConsent: "Bitte stimmen Sie der Datenverarbeitung zu, um fortzufahren.",
    gateErrNeedEmail: "Bitte geben Sie zuerst Ihre E-Mail-Adresse an.",
    queuedLabel: "Ihre Frage:",
    inputPlaceholder: "Schreiben Sie Ihre Frage...",
    inputAria: "Nachricht",
    attachAria: "Bild anhängen",
    sendAria: "Nachricht senden",
    removeAttachment: (n) => `${n} entfernen`,
    attachErrType: "Format nicht zulässig. Bitte JPG, PNG oder WEBP verwenden.",
    attachErrSize: "Bild zu groß (maximal 5 MB).",
    attachErrRead: "Die Datei konnte nicht gelesen werden.",
    errGeneric: "Es ist leider ein Fehler aufgetreten. Bitte versuchen Sie es erneut.",
    errConn: "Es ist leider ein Verbindungsfehler aufgetreten. Bitte versuchen Sie es erneut oder schreiben Sie uns per WhatsApp.",
    rateLimitedText: "Um das Gespräch fortzusetzen und Dokumente zu senden, schreiben Sie uns bitte per WhatsApp:",
    rateLimitedCta: "Per WhatsApp fortfahren",
    newConversation: "Neue Unterhaltung",
  },
  pt: {
    headerTitle: "Assistente · traduccionesjuradas.net",
    online: "Online",
    dialogAria: "Assistente virtual",
    openAria: "Abrir assistente virtual",
    closeAria: "Fechar assistente",
    clearAria: "Limpar conversa",
    welcome:
      "Olá! Sou o assistente de traduccionesjuradas.net. Em que posso ajudar?\n\nPosso orientar sobre:\n• O preço da sua tradução juramentada\n• Os prazos de entrega\n• Os documentos necessários",
    quickReplies: [
      { label: "Preço", emoji: "💰" },
      { label: "Documentos necessários", emoji: "📋" },
      { label: "Falar pelo WhatsApp", emoji: "📱", isWhatsApp: true },
    ],
    quickRepliesAria: "Respostas rápidas",
    gateIntro: "Para usar o assistente, indique o seu email:",
    gateEmailPlaceholder: "seu@email.com",
    gateStart: "Começar",
    gateConsent: "Autorizo o tratamento dos meus dados para responder à minha consulta.",
    privacyLabel: "Política de privacidade",
    gateErrEmail: "Indique um email válido.",
    gateErrConsent: "Aceite o tratamento dos seus dados para continuar.",
    gateErrNeedEmail: "Indique primeiro o seu email para usar o assistente.",
    queuedLabel: "A sua pergunta:",
    inputPlaceholder: "Escreva a sua pergunta...",
    inputAria: "Mensagem",
    attachAria: "Anexar imagem",
    sendAria: "Enviar mensagem",
    removeAttachment: (n) => `Remover ${n}`,
    attachErrType: "Formato não permitido. Use JPG, PNG ou WEBP.",
    attachErrSize: "Imagem demasiado grande (máximo 5 MB).",
    attachErrRead: "Não foi possível ler o ficheiro.",
    errGeneric: "Lamentamos, ocorreu um erro. Tente novamente.",
    errConn: "Lamentamos, ocorreu um erro de ligação. Tente novamente ou escreva-nos pelo WhatsApp.",
    rateLimitedText: "Para continuar a conversa e enviar documentos, escreva-nos pelo WhatsApp:",
    rateLimitedCta: "Continuar no WhatsApp",
    newConversation: "Nova conversa",
  },
};
