// lib/i18n/whatsapp-arrival.ts — Cabecera de la llegada desde WhatsApp
// (?p=whatsapp&l=xx, commit 4861876). La comparten /presupuesto-instantaneo y
// la portada: el mismo aviso y el mismo selector de idioma en los dos sitios.

import type { PuertaLang } from "@/lib/i18n/puerta";

export const PUERTA_LANGS: PuertaLang[] = ["es", "fr", "en", "de", "pt"];

export function toPuertaLang(v: unknown): PuertaLang {
  const l = String(v ?? "").toLowerCase().trim() as PuertaLang;
  return PUERTA_LANGS.includes(l) ? l : "es";
}

export const WHATSAPP_HEAD: Record<PuertaLang, { banner: string; title: string }> = {
  es: { banner: "Vienes de WhatsApp: sube aquí tus documentos y te contestamos por WhatsApp con el precio.", title: "Sube tus documentos" },
  fr: { banner: "Vous venez de WhatsApp : déposez ici vos documents et nous vous répondons sur WhatsApp avec le prix.", title: "Déposez vos documents" },
  en: { banner: "You came from WhatsApp: upload your documents here and we'll reply on WhatsApp with the price.", title: "Upload your documents" },
  de: { banner: "Sie kommen von WhatsApp: Laden Sie hier Ihre Dokumente hoch, wir antworten Ihnen per WhatsApp mit dem Preis.", title: "Laden Sie Ihre Dokumente hoch" },
  pt: { banner: "Vem do WhatsApp: envie aqui os seus documentos e respondemos pelo WhatsApp com o preço.", title: "Envie os seus documentos" },
};
