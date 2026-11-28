// Valoración del cliente desde las estrellas del email de entrega. Puro: Prisma,
// token, rate limit y avisos llegan inyectados para probarlo con node --test.
// Sin review gating: la nota nunca decide si se enseña Google (ver la página).

import { greetingName } from "./delivery-message.ts";

export const REVIEW_EVENT_TYPE = "review.stars";
export const COMMENT_MAX = 2000;

export type ReviewLang = "es" | "fr";

export type ReviewOrder = {
  id: string;
  reference: string;
  clientName: string | null;
  clientEmail: string;
  clientLocale: string | null;
};

export type ReviewPayload = { stars: number; comment?: string | null; updatedAt: string };

export type ReviewDeps = {
  verifyOrderToken: (reference: string, token: string) => boolean;
  findOrder: (reference: string) => Promise<ReviewOrder | null>;
  findReview: (orderId: string) => Promise<{ id: string; payload: unknown } | null>;
  createReview: (orderId: string, message: string, payload: ReviewPayload) => Promise<void>;
  updateReview: (id: string, message: string, payload: ReviewPayload) => Promise<void>;
  rateLimit: (key: string, limit: number, windowMs: number) => Promise<{ ok: boolean; retryAfterSec: number }>;
  notifyStaff: (subject: string, text: string) => Promise<void>;
};

export function parseStars(value: unknown): number | null {
  const s = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  return /^[1-5]$/.test(s) ? Number(s) : null;
}

export function reviewLang(locale: string | null | undefined): ReviewLang {
  return locale === "fr" ? "fr" : "es";
}

export function reviewEventMessage(stars: number, comment?: string | null): string {
  return `Valoración: ${stars}★${comment ? ` · «${comment}»` : ""}`;
}

export function reviewStaffSubject(reference: string, stars: number): string {
  return `${stars <= 3 ? `Nota baja (${stars}★)` : `Opinión ${stars}★`} — comentario del pedido ${reference}`;
}

export async function resolveReviewOrder(reference: string, token: string, deps: Pick<ReviewDeps, "verifyOrderToken" | "findOrder">): Promise<ReviewOrder | null> {
  if (!reference || !token || !deps.verifyOrderToken(reference, token)) return null;
  return deps.findOrder(reference);
}

// Lo que enseña la página. Google va siempre primero y nunca depende de la nota.
export type ReviewAction = "google" | "comment";
export type ReviewPageModel =
  | { view: "thanks"; stars: number; order: ReviewOrder; actions: ReviewAction[] }
  | { view: "invalid"; actions: ReviewAction[] };

export async function reviewPageModel(
  reference: string,
  token: string,
  r: unknown,
  deps: Pick<ReviewDeps, "verifyOrderToken" | "findOrder">
): Promise<ReviewPageModel> {
  const stars = parseStars(r);
  const order = stars ? await resolveReviewOrder(reference, token, deps) : null;
  if (!stars || !order) return { view: "invalid", actions: ["google"] };
  return { view: "thanks", stars, order, actions: ["google", "comment"] };
}

export type ReviewPostInput = { reference: string; t: unknown; r: unknown; comment?: unknown; ip: string };
export type ReviewPostResult = { status: number; body: { ok: boolean; error?: string } };

export async function handleReviewPost(input: ReviewPostInput, deps: ReviewDeps, now = new Date()): Promise<ReviewPostResult> {
  const hasComment = input.comment !== undefined && input.comment !== null;
  const rl = hasComment
    ? await deps.rateLimit(`opinion:comment:${input.ip}`, 5, 10 * 60 * 1000)
    : await deps.rateLimit(`opinion:stars:${input.ip}`, 30, 10 * 60 * 1000);
  if (!rl.ok) return { status: 429, body: { ok: false, error: "rate_limited" } };

  const stars = parseStars(input.r);
  if (!stars) return { status: 400, body: { ok: false, error: "invalid_stars" } };

  const token = typeof input.t === "string" ? input.t : "";
  const order = await resolveReviewOrder(input.reference, token, deps);
  if (!order) return { status: 403, body: { ok: false, error: "invalid_token" } };

  const comment = hasComment ? String(input.comment).trim().slice(0, COMMENT_MAX) : "";
  if (hasComment && !comment) return { status: 400, body: { ok: false, error: "empty_comment" } };

  const existing = await deps.findReview(order.id);
  const prev = (existing?.payload && typeof existing.payload === "object" ? existing.payload : {}) as Partial<ReviewPayload>;
  const keptComment = comment || prev.comment || null;
  const payload: ReviewPayload = { stars, comment: keptComment, updatedAt: now.toISOString() };
  const message = reviewEventMessage(stars, keptComment);

  if (existing) await deps.updateReview(existing.id, message, payload);
  else await deps.createReview(order.id, message, payload);

  if (comment) {
    const name = greetingName(order.clientName, order.clientEmail) || order.clientEmail;
    const text = [
      `${name} (${order.clientEmail}) ha valorado el pedido ${order.reference} con ${stars}★ y ha escrito:`,
      "",
      comment,
      "",
      `Ficha: https://www.traduccionesjuradas.net/zona-traductor/pedido/${encodeURIComponent(order.reference)}`,
    ].join("\n");
    await deps.notifyStaff(reviewStaffSubject(order.reference, stars), text).catch((e) => console.error("[opinion] aviso staff", e));
  }

  return { status: 200, body: { ok: true } };
}

export type ReviewStrings = {
  thanks: (name: string) => string;
  saved: string;
  ask: string;
  googleButton: string;
  googleHint: string;
  improveTitle: string;
  improveHint: string;
  commentLabel: string;
  send: string;
  sending: string;
  sent: string;
  error: string;
  invalidTitle: string;
  invalidText: string;
  starsLabel: (n: number) => string;
};

export const REVIEW_STRINGS: Record<ReviewLang, ReviewStrings> = {
  es: {
    thanks: (n) => (n ? `Gracias, ${n}` : "Gracias"),
    saved: "Tu nota ya está guardada.",
    ask: "¿Nos dejas dos líneas en Google? Es lo que más ayuda a otras personas a encontrar un traductor de confianza.",
    googleButton: "Escribir mi opinión en Google",
    googleHint: "Tarda unos 30 segundos",
    improveTitle: "¿Algo que podamos hacer mejor?",
    improveHint: "Le llega directamente a Juan.",
    commentLabel: "Tu comentario (opcional)",
    send: "Enviar a Juan",
    sending: "Enviando…",
    sent: "Recibido. Gracias por contárnoslo.",
    error: "No se ha podido enviar. Inténtalo de nuevo en unos minutos.",
    invalidTitle: "Gracias por tu opinión",
    invalidText: "Este enlace ha caducado o no es válido, así que no hemos podido guardar la nota. Si quieres, puedes dejarnos dos líneas en Google: es lo que más ayuda a otras personas a encontrar un traductor de confianza.",
    starsLabel: (n) => `${n} de 5 estrellas`,
  },
  fr: {
    thanks: (n) => (n ? `Merci, ${n}` : "Merci"),
    saved: "Votre note est bien enregistrée.",
    ask: "Pourriez-vous nous laisser deux lignes sur Google ? C’est ce qui aide le plus d’autres personnes à trouver un traducteur de confiance.",
    googleButton: "Écrire mon avis sur Google",
    googleHint: "Cela prend environ 30 secondes",
    improveTitle: "Quelque chose que nous pourrions améliorer ?",
    improveHint: "Votre message arrive directement à Juan.",
    commentLabel: "Votre commentaire (facultatif)",
    send: "Envoyer à Juan",
    sending: "Envoi…",
    sent: "Bien reçu. Merci de nous l’avoir dit.",
    error: "L’envoi a échoué. Réessayez dans quelques minutes.",
    invalidTitle: "Merci pour votre avis",
    invalidText: "Ce lien a expiré ou n’est pas valide, nous n’avons donc pas pu enregistrer la note. Si vous le souhaitez, vous pouvez nous laisser deux lignes sur Google : c’est ce qui aide le plus d’autres personnes à trouver un traducteur de confiance.",
    starsLabel: (n) => `${n} étoiles sur 5`,
  },
};
