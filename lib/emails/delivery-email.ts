// Email de entrega con la imagen de la casa (maqueta «Entrega», 28-nov-2026): tarjetas de descarga,
// estrellas de opinión, área cliente y, si viene, el cupón de recomendación. El texto (el estándar o
// el que edita el staff) manda; los bloques de diseño se mantienen. Puro salvo los tokens firmados.
import { generateOrderToken } from "../order-token.ts";
import { buildClientPortalUrl } from "../client-token.ts";
import { C, SANS, SERIF, SITE, emailButton, emailCard, emailLayout, escapeHtml, stripTextSignature } from "../email-layout.ts";
import { DELIVERY_COPY } from "../email-copy.ts";
import { deliveryTextToHtml, documentDisplayName, greetingName, type DeliveryLang } from "../delivery-message.ts";

export type Referral = { code: string; shareUrl: string };
export type DeliveryCardFile = { name?: string | null; url?: string | null };

const RATING_TTL_SECONDS = 365 * 24 * 60 * 60;

const T = DELIVERY_COPY;

export function ratingUrls(reference: string, token: string): string[] {
  return [1, 2, 3, 4, 5].map((r) => `${SITE}/opinion/${encodeURIComponent(reference)}?t=${encodeURIComponent(token)}&r=${r}`);
}

// Enlaces firmados del email (estrellas, área cliente, estado del pedido). Sin ORDER_TOKEN_SECRET:
// sin estrellas y el área sin enlace mágico.
export function deliveryLinks(reference: string, clientEmail?: string | null) {
  let ratingToken: string | null = null;
  let orderToken: string | null = null;
  let areaUrl = `${SITE}/area-cliente`;
  try {
    ratingToken = generateOrderToken(reference, { ttlSeconds: RATING_TTL_SECONDS });
    orderToken = generateOrderToken(reference);
  } catch {
    /* sin secreto */
  }
  if (clientEmail && /@/.test(clientEmail) && !/@whatsapp\.local$/i.test(clientEmail)) {
    try {
      areaUrl = buildClientPortalUrl(clientEmail);
    } catch {
      /* sin secreto */
    }
  }
  const statusUrl = orderToken ? `${SITE}/pedido/${encodeURIComponent(reference)}?token=${orderToken}` : areaUrl;
  return { ratingToken, areaUrl, statusUrl };
}

function fileCard(title: string, meta: string, url: string, action: string): string {
  return emailCard(
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" style="font-family:${SANS};"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="font-size:15px;font-weight:bold;color:${C.navy};text-decoration:none;">${escapeHtml(title)}</a><br><span style="font-size:13px;color:${C.muted};">${escapeHtml(meta)}</span></td>
<td align="right" valign="middle" style="font-family:${SANS};padding-left:12px;white-space:nowrap;"><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="font-size:14px;font-weight:bold;color:${C.navy};">${escapeHtml(action)}</a></td>
</tr></table>`,
    { margin: "0 0 10px 0", padding: "16px 18px" }
  );
}

function starsBlock(lang: DeliveryLang, urls: string[], reviewUrl: string): string {
  const t = T[lang];
  const stars = urls
    .map(
      (u, i) =>
        `<td style="padding:0 4px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="48" height="48" align="center" valign="middle" bgcolor="${C.navySoft}" style="width:48px;height:48px;background:${C.navySoft};border-radius:10px;"><a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer" title="${t.star(i + 1)}" aria-label="${t.star(i + 1)}" style="display:block;font-family:${SANS};font-size:30px;line-height:48px;color:${C.gold};text-decoration:none;">&#9733;</a></td></tr></table></td>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:26px 0 8px 0;"><tr><td align="center" bgcolor="${C.navy}" style="background:${C.navy};border-radius:12px;padding:26px 24px;">
<div style="font-family:${SERIF};font-size:21px;color:${C.white};margin:0 0 8px 0;">${t.rateTitle}</div>
<div style="font-family:${SANS};font-size:15px;line-height:1.5;color:${C.cream};margin:0 0 16px 0;">${t.rateBody}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr>${stars}</tr></table>
<div style="font-family:${SANS};font-size:13px;margin:14px 0 0 0;"><a href="${escapeHtml(reviewUrl)}" target="_blank" rel="noopener noreferrer" style="color:${C.cream};">${t.rateGoogle}</a></div>
</td></tr></table>`;
}

function areaBlock(lang: DeliveryLang, url: string): string {
  const t = T[lang];
  return `<div style="margin:26px 0 0 0;"><div style="font-family:${SERIF};font-size:19px;color:${C.navy};margin:0 0 8px 0;">${t.areaTitle}</div>
<p style="margin:0 0 8px 0;font-size:15px;line-height:1.55;">${t.areaBody}</p>${emailButton(t.areaCta, url, { variant: "outline", size: "sm" })}</div>`;
}

export function referralBlock(lang: DeliveryLang, referral: Referral): string {
  const t = T[lang];
  const wa = `https://wa.me/?text=${encodeURIComponent(`${t.refWa(referral.code)} ${referral.shareUrl}`)}`;
  return emailCard(
    `<div style="font-size:12px;font-weight:bold;letter-spacing:1.6px;text-transform:uppercase;color:${C.goldText};margin:0 0 10px 0;">${t.refTag}</div>
<div style="font-family:${SERIF};font-size:22px;line-height:1.3;color:${C.navy};margin:0 0 10px 0;">${t.refTitle}</div>
<p style="margin:0 0 14px 0;">${t.refBody}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 6px 0;"><tr><td bgcolor="${C.white}" style="background:${C.white};border:1px solid ${C.border};border-radius:8px;padding:10px 16px;font-family:'Courier New',Courier,monospace;font-size:20px;font-weight:bold;letter-spacing:3px;color:${C.navy};">${escapeHtml(referral.code)}</td></tr></table>
${emailButton(t.refShare, wa, { size: "sm" })}
<div style="font-size:13px;color:${C.muted};">${t.refNote}</div>`,
    { dashed: true, background: C.coupon, padding: "24px", radius: 12, margin: "26px 0 8px 0" }
  );
}

// La línea que pide la reseña de Google se va; si la URL va dentro de otra frase, se va solo la URL.
export function removeReviewLine(text: string, reviewUrl: string): string {
  return text
    .split("\n")
    .flatMap((l) => {
      if (!l.includes(reviewUrl)) return [l];
      if (/google|reseña|valoraci|opini|avis|review/i.test(l)) return [];
      const rest = l.split(reviewUrl).join("").replace(/\s*:\s*$/, "").trimEnd();
      return rest.trim() ? [rest] : [];
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function renderDeliveryEmailHtml(input: {
  lang: DeliveryLang;
  reference: string;
  text: string;
  clientName?: string | null;
  correction?: boolean;
  invoiceNumber?: string | null;
  attachedFiles?: DeliveryCardFile[];
  fallbackLinks?: DeliveryCardFile[];
  reviewUrl: string;
  clientEmail?: string | null;
  // false = firma de Juan (pares FR); sin decir nada, la de la casa.
  houseSignature?: boolean;
  referral?: Referral | null;
}): string {
  const t = T[input.lang];
  const c = !!input.correction;
  const links = deliveryLinks(input.reference, input.clientEmail);
  const name = greetingName(input.clientName, input.clientEmail);

  const card = (f: DeliveryCardFile, meta: string, url: string) => {
    const doc = f.name ? documentDisplayName(f.name) : "";
    return fileCard(doc ? `${t.translation} · ${doc}` : t.translation, meta, url, t.download);
  };
  const attached = input.attachedFiles && input.attachedFiles.length ? input.attachedFiles : (input.fallbackLinks || []).length ? [] : [{}];
  const cards = [
    ...attached.map((f) => card(f, t.attached, links.statusUrl)),
    ...(input.fallbackLinks || []).filter((f) => f.url).map((f) => card(f, t.direct, f.url as string)),
    ...(input.invoiceNumber && !c ? [fileCard(t.invoice(input.invoiceNumber), t.invoiceMeta, links.areaUrl, t.download)] : []),
  ].join("");
  const cardsHtml = `<div style="margin:6px 0 18px 0;">${cards}</div>`;
  const stars = links.ratingToken ? starsBlock(input.lang, ratingUrls(input.reference, links.ratingToken), input.reviewUrl) : "";

  // Con estrellas, fuera solo la línea de la reseña de Google (o su URL): el resto del texto se queda.
  // Con la tarjeta de firma, fuera el nombre de la firma del texto.
  const withoutReview = stars ? removeReviewLine(input.text, input.reviewUrl) : input.text;
  const paras = stripTextSignature(withoutReview).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const signoff = paras.length > 1 ? paras[paras.length - 1] : null;
  const html: string[] = [];
  let cardsIn = false;
  paras.forEach((p, i) => {
    if (signoff !== null && i === paras.length - 1) return;
    html.push(deliveryTextToHtml(p));
    if (i >= 1 && !cardsIn) {
      html.push(cardsHtml);
      cardsIn = true;
    }
  });
  if (!cardsIn) html.push(cardsHtml);
  if (stars) html.push(stars);
  html.push(areaBlock(input.lang, links.areaUrl));
  if (input.referral) html.push(referralBlock(input.lang, input.referral));
  if (signoff !== null) html.push(`<div style="margin-top:26px;">${deliveryTextToHtml(signoff)}</div>`);

  return emailLayout({
    content: html.join(""),
    label: t.label(input.reference, c),
    labelColor: C.green,
    title: t.title(name, c),
    signature: input.houseSignature === false ? "juan" : "house",
  });
}
