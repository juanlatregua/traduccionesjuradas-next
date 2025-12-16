// lib/contact.ts

const WHATSAPP_NUMBER = "34951333614"; // sin el + aquí
const WHATSAPP_MESSAGE = "Hola, quiero pedir un presupuesto de traducción jurada.";

export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  WHATSAPP_MESSAGE
)}`;

export const EMAIL = "hola@traduccionesjuradas.net";
const SUBJECT = "Presupuesto traducción jurada";

export const MAIL_LINK = `mailto:${EMAIL}?subject=${encodeURIComponent(
  SUBJECT
)}`;
