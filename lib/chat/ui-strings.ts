// lib/chat/ui-strings.ts — Textos del asistente (widget flotante y panel
// anclado de la portada) en los dos idiomas que habla el chat: es y fr.
// El servidor (/api/chat) detecta el idioma del mensaje por su cuenta.

export type ChatLang = "es" | "fr";

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
};
