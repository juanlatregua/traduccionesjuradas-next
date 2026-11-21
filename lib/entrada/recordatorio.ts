// Recordatorio único a quien dejó su email confirmado y sus archivos pero no pulsó «Pedir mi presupuesto»
// (lo promete el consentimiento: «con un recordatorio si no lo completo»). Puro; la BD y el envío viven en
// app/api/cron/entrada-recordatorio. Una vez por entrada (FunnelEvent «entrada_recordatorio»), entre las 8 y las 22 de Madrid.
import type { EntradaLang } from "./i18n.ts";

export const RECORDATORIO_STEP = "entrada_recordatorio";
export const RECORDATORIO_TRAS_MS = 2 * 36e5;
/** Más allá ya no es «a medias»: no se escribe a nadie por algo de hace días. */
export const RECORDATORIO_HASTA_MS = 48 * 36e5;

export type EntradaAMedias = {
  id: string;
  estado: string;
  canal: string;
  email: string | null;
  emailVerifiedAt: Date | null;
  marketingConsentAt: Date | null;
  updatedAt: Date;
  files: number;
};

export function madridHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(d));
}

export const recordatorioHourOk = (now: Date) => {
  const h = madridHour(now);
  return h >= 8 && h < 22;
};

/** Entradas due a reminder now; `done` = already reminded, `finished` = emails that confirmed another entrada or already have a quote. */
export function selectRecordatorios(entradas: EntradaAMedias[], now: Date, skip: { done: Set<string>; finished: Set<string>; staff(email: string): boolean }): EntradaAMedias[] {
  const t = now.getTime();
  return entradas.filter(
    (e) =>
      (e.estado === "abierta" || e.estado === "leida") &&
      e.canal === "web" &&
      e.email &&
      e.emailVerifiedAt &&
      e.marketingConsentAt &&
      e.files > 0 &&
      t - e.updatedAt.getTime() >= RECORDATORIO_TRAS_MS &&
      t - e.updatedAt.getTime() <= RECORDATORIO_HASTA_MS &&
      !skip.done.has(e.id) &&
      !skip.finished.has(e.email.toLowerCase()) &&
      !skip.staff(e.email),
  );
}

const T: Record<EntradaLang, { subject: string; body(url: string): string }> = {
  es: {
    subject: "Tus documentos siguen guardados — traduccionesjuradas.net",
    body: (url) =>
      "Hola:\nSubiste tus documentos pero aún no nos has pedido el presupuesto. Siguen guardados.\n" +
      `Para recibirlo, vuelve a ${url} desde el mismo dispositivo y pulsa «Pedir mi presupuesto». Si te resulta más cómodo, responde a este correo y Juan te lo prepara con lo que ya subiste.\n` +
      "Si ya no lo necesitas, no hace falta que hagas nada: no te escribiremos más por esto.\nJuan Silva Moreno · Traductor jurado MAEC nº 3850",
  },
  fr: {
    subject: "Vos documents sont toujours enregistrés — traduccionesjuradas.net",
    body: (url) =>
      "Bonjour,\nVous avez envoyé vos documents mais vous ne nous avez pas encore demandé le devis. Ils sont toujours enregistrés.\n" +
      `Pour le recevoir, revenez sur ${url} depuis le même appareil et appuyez sur « Demander mon devis ». Si c'est plus simple, répondez à ce message et Juan vous le prépare avec ce que vous avez déjà envoyé.\n` +
      "Si vous n'en avez plus besoin, vous n'avez rien à faire : nous ne vous écrirons plus à ce sujet.\nJuan Silva Moreno · Traducteur assermenté MAEC nº 3850",
  },
  en: {
    subject: "Your documents are still saved — traduccionesjuradas.net",
    body: (url) =>
      "Hello,\nYou uploaded your documents but have not asked for your quote yet. They are still saved.\n" +
      `To get it, go back to ${url} on the same device and press «Request my quote». If it is easier, just reply to this email and Juan will prepare it with what you already uploaded.\n` +
      "If you no longer need it, there is nothing to do: we will not write to you about this again.\nJuan Silva Moreno · Sworn translator MAEC no. 3850",
  },
  de: {
    subject: "Ihre Unterlagen sind weiterhin gespeichert — traduccionesjuradas.net",
    body: (url) =>
      "Guten Tag,\nSie haben Ihre Unterlagen hochgeladen, aber noch kein Angebot angefordert. Sie sind weiterhin gespeichert.\n" +
      `Um es zu erhalten, öffnen Sie ${url} auf demselben Gerät und tippen Sie auf «Mein Angebot anfordern». Wenn es Ihnen lieber ist, antworten Sie einfach auf diese E-Mail, und Juan erstellt es mit dem, was Sie bereits hochgeladen haben.\n` +
      "Wenn Sie es nicht mehr brauchen, müssen Sie nichts tun: Wir schreiben Ihnen deswegen nicht mehr.\nJuan Silva Moreno · Vereidigter Übersetzer MAEC Nr. 3850",
  },
  pt: {
    subject: "Os seus documentos continuam guardados — traduccionesjuradas.net",
    body: (url) =>
      "Olá,\nEnviou os seus documentos mas ainda não nos pediu o orçamento. Continuam guardados.\n" +
      `Para o receber, volte a ${url} no mesmo dispositivo e carregue em «Pedir meu orçamento». Se for mais prático, responda a este e-mail e o Juan prepara-o com o que já enviou.\n` +
      "Se já não precisar, não tem de fazer nada: não voltaremos a escrever-lhe sobre isto.\nJuan Silva Moreno · Tradutor juramentado MAEC nº 3850",
  },
};

export function recordatorioEmail(lang: string | null, url: string) {
  const t = T[(lang && lang in T ? lang : "es") as EntradaLang];
  return { subject: t.subject, text: t.body(url) };
}
