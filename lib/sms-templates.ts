// lib/sms-templates.ts — Plantillas SMS (max ~160 chars para 1 SMS)
//
// Los 3 hitos núcleo (pago → en proceso → lista) salen en el idioma del cliente
// (Order.clientLocale, capturado en la puerta): el francófono recibe el aviso
// post-pago en francés, no en español.

export type SmsLang = "es" | "fr";

/** Plazo de entrega localizado para el SMS de pago confirmado. */
export function formatDeliveryPlazo(dueDate: Date | null | undefined, lang: SmsLang = "es"): string {
  if (!dueDate) return lang === "fr" ? "3-5 jours ouvrés" : "3-5 días laborables";
  return dueDate.toLocaleDateString(lang === "fr" ? "fr-FR" : "es-ES", {
    day: "numeric",
    month: "long",
  });
}

export function smsPresupuestoListo(data: {
  ref: string;
  precio: string;
  url: string;
}): string {
  return `TraduccionesJuradas.net: Presupuesto ${data.ref} listo: ${data.precio}€. Acepta y paga: ${data.url}`;
}

export function smsTraduccionLista(data: {
  ref: string;
  url: string;
  lang?: SmsLang;
}): string {
  if (data.lang === "fr") {
    return `TraduccionesJuradas.net: Votre traduction ${data.ref} est prête. Téléchargez-la : ${data.url}`;
  }
  return `TraduccionesJuradas.net: Tu traduccion ${data.ref} esta lista. Descargala: ${data.url}`;
}

export function smsRecordatorioPago(data: {
  ref: string;
  precio: string;
  url: string;
}): string {
  return `TraduccionesJuradas.net: Tu presupuesto ${data.ref} (${data.precio}€) caduca pronto. Paga: ${data.url}`;
}

/** Acuse al cliente al salir su solicitud de precio hacia el traductor (lavori).
 *  Texto único del carril del lead (12-ago); lo comparten lead y ficha del pedido. */
export function smsAcuseSolicitudPrecio(lang: SmsLang = "es"): string {
  if (lang === "fr") {
    return (
      "Merci pour votre demande. Vos documents seront traités directement par un " +
      "traducteur assermenté nommé par le MAEC ; Juan Silva Moreno (nº 3850) vous enverra le devis " +
      "en général dans la journée. Merci de votre confiance.\n— Traducciones Juradas · traduccionesjuradas.net"
    );
  }
  return (
    "Gracias por su solicitud. Sus documentos van a ser tratados directamente " +
    "por un traductor jurado nombrado por el MAEC; Juan Silva Moreno (nº 3850) le enviará el " +
    "presupuesto normalmente en el día. Gracias por su atención.\n— Traducciones Juradas · traduccionesjuradas.net"
  );
}

export function smsPresupuestoCaducado(data: { ref: string; url: string }): string {
  return `TraduccionesJuradas.net: Tu presupuesto ${data.ref} ha caducado. Si sigues interesado podemos retomarlo, o dinos el motivo: ${data.url}`;
}

export function smsPagoConfirmado(data: {
  ref: string;
  plazo: string;
  url: string;
  lang?: SmsLang;
}): string {
  if (data.lang === "fr") {
    return `TraduccionesJuradas.net: Paiement confirmé ${data.ref}. Livraison : ${data.plazo}. Suivez l'état : ${data.url}`;
  }
  return `TraduccionesJuradas.net: Pago confirmado ${data.ref}. Entrega: ${data.plazo}. Sigue el estado: ${data.url}`;
}

export function smsEnProceso(data: { ref: string; url: string; lang?: SmsLang }): string {
  if (data.lang === "fr") {
    return `TraduccionesJuradas.net: Votre traduction ${data.ref} est en cours. Suivez l'état : ${data.url}`;
  }
  return `TraduccionesJuradas.net: Tu traduccion ${data.ref} ya esta en proceso. Sigue el estado: ${data.url}`;
}

export function smsReviewRequest(data: { url: string }): string {
  return `TraduccionesJuradas.net: Nos encantaria tu opinion. Dejanos una valoracion en Google: ${data.url}`;
}
