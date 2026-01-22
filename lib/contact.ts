// lib/contact.ts

const WHATSAPP_NUMBER = "34951333614"; // sin el + aquí
const WHATSAPP_MESSAGE =
  "Gracias por usar Traduccionesjuradas.net. Un proceso rápido y fácil para encargar 100% online una traducción jurada. Envíe su documento en pdf o fotografía e indique si necesita una traducción jurada en pdf o en papel. En breve le enviamos un presupuesto exacto.";

export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`;

export const EMAIL = "hola@traduccionesjuradas.net";
const SUBJECT = "Presupuesto traducción jurada";

export const MAIL_LINK = `mailto:${EMAIL}?subject=${encodeURIComponent(
  SUBJECT
)}`;
