// Email de entrega con la imagen de la casa (maqueta «Entrega», 28-nov-2026): tarjetas de descarga,
// estrellas de opinión, área cliente y, si viene, el cupón de recomendación. El texto (el estándar o
// el que edita el staff) manda; los bloques de diseño se mantienen. Puro salvo los tokens firmados.
import { generateOrderToken } from "../order-token.ts";
import { buildClientPortalUrl } from "../client-token.ts";
import { C, SANS, SERIF, SITE, emailButton, emailCard, emailLayout, escapeHtml } from "../email-layout.ts";
import { deliveryTextToHtml, documentDisplayName, greetingName, type DeliveryLang } from "../delivery-message.ts";

export type Referral = { code: string; shareUrl: string };
export type DeliveryCardFile = { name?: string | null; url?: string | null };

const RATING_TTL_SECONDS = 365 * 24 * 60 * 60;

const T = {
  es: {
    label: (ref: string, c: boolean) => `Pedido ${ref} · ${c ? "Corregido" : "Entregado"}`,
    title: (n: string, c: boolean) => (c ? `Tu traducción corregida, ${n}` : `Tu traducción jurada está lista${n ? `, ${n}` : ""}`),
    titleNoName: (c: boolean) => (c ? "Tu traducción corregida" : "Tu traducción jurada está lista"),
    translation: "Traducción jurada",
    attached: "PDF firmado · adjunto a este email",
    direct: "PDF firmado · descarga directa",
    invoice: (n: string) => `Factura ${n}`,
    invoiceMeta: "PDF · adjunta a este email",
    download: "Descargar",
    rateTitle: "¿Qué tal lo hemos hecho?",
    rateBody: "Toca una estrella. Un segundo, y ayuda mucho a quien busca traductor.",
    star: (i: number) => `${i} estrella${i > 1 ? "s" : ""}`,
    areaTitle: "Tu archivo, siempre a mano",
    areaBody: "Guardamos tu traducción en tu área personal. Si un organismo te pide otra copia, la descargas en un minuto, sin volver a pagar la traducción. Entras con un enlace a tu email: sin contraseñas.",
    areaCta: "Entrar en mi área",
    refTag: "Recomiéndanos",
    refTitle: "Regala un 10 % y gana otro 10 %",
    refBody: "Pásale tu código a quien necesite una traducción jurada. Tendrá un 10 % en su encargo y, cuando lo pague, tú recibirás otro 10 % para el tuyo.",
    refShare: "Compartir por WhatsApp",
    refNote: "Código de un solo uso, válido 12 meses. No se suma a otros descuentos.",
    refWa: (code: string) => `Te paso mi código ${code}: tienes un 10 % en tu traducción jurada.`,
  },
  fr: {
    label: (ref: string, c: boolean) => `Commande ${ref} · ${c ? "Corrigée" : "Livrée"}`,
    title: (n: string, c: boolean) => (c ? `Votre traduction corrigée, ${n}` : `Votre traduction assermentée est prête${n ? `, ${n}` : ""}`),
    titleNoName: (c: boolean) => (c ? "Votre traduction corrigée" : "Votre traduction assermentée est prête"),
    translation: "Traduction assermentée",
    attached: "PDF signé · joint à cet email",
    direct: "PDF signé · téléchargement direct",
    invoice: (n: string) => `Facture ${n}`,
    invoiceMeta: "PDF · jointe à cet email",
    download: "Télécharger",
    rateTitle: "Comment l'avons-nous fait ?",
    rateBody: "Touchez une étoile. Une seconde, et cela aide beaucoup ceux qui cherchent un traducteur.",
    star: (i: number) => `${i} étoile${i > 1 ? "s" : ""}`,
    areaTitle: "Votre dossier, toujours à portée de main",
    areaBody: "Nous gardons votre traduction dans votre espace personnel. Si un organisme vous demande une autre copie, vous la téléchargez en une minute, sans payer à nouveau la traduction. Vous entrez avec un lien envoyé à votre email : sans mot de passe.",
    areaCta: "Accéder à mon espace",
    refTag: "Recommandez-nous",
    refTitle: "Offrez 10 % et gagnez 10 %",
    refBody: "Donnez votre code à quelqu'un qui a besoin d'une traduction assermentée. Il aura 10 % sur sa commande et, quand il la paiera, vous recevrez 10 % pour la vôtre.",
    refShare: "Partager sur WhatsApp",
    refNote: "Code à usage unique, valable 12 mois. Non cumulable avec d'autres réductions.",
    refWa: (code: string) => `Voici mon code ${code} : 10 % sur ta traduction assermentée.`,
  },
  en: {
    label: (ref: string, c: boolean) => `Order ${ref} · ${c ? "Corrected" : "Delivered"}`,
    title: (n: string, c: boolean) => (c ? `Your corrected translation, ${n}` : `Your sworn translation is ready${n ? `, ${n}` : ""}`),
    titleNoName: (c: boolean) => (c ? "Your corrected translation" : "Your sworn translation is ready"),
    translation: "Sworn translation",
    attached: "Signed PDF · attached to this email",
    direct: "Signed PDF · direct download",
    invoice: (n: string) => `Invoice ${n}`,
    invoiceMeta: "PDF · attached to this email",
    download: "Download",
    rateTitle: "How did we do?",
    rateBody: "Tap a star. It takes a second and helps people looking for a translator.",
    star: (i: number) => `${i} star${i > 1 ? "s" : ""}`,
    areaTitle: "Your file, always at hand",
    areaBody: "We keep your translation in your personal area. If an authority asks you for another copy, you can download it in a minute without paying for the translation again. You sign in with a link sent to your email: no passwords.",
    areaCta: "Go to my area",
    refTag: "Recommend us",
    refTitle: "Give 10 % and get 10 %",
    refBody: "Pass your code to someone who needs a sworn translation. They get 10 % off their order and, once they pay, you get another 10 % for yours.",
    refShare: "Share on WhatsApp",
    refNote: "Single-use code, valid for 12 months. Cannot be combined with other discounts.",
    refWa: (code: string) => `Here is my code ${code}: 10 % off your sworn translation.`,
  },
} as const;

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

function starsBlock(lang: DeliveryLang, urls: string[]): string {
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
  const stars = links.ratingToken ? starsBlock(input.lang, ratingUrls(input.reference, links.ratingToken)) : "";

  const paras = input.text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const reviewIdx = stars ? paras.findIndex((p) => p.includes(input.reviewUrl)) : -1;
  const signoff = paras.length > 1 ? paras[paras.length - 1] : null;
  const html: string[] = [];
  let cardsIn = false;
  paras.forEach((p, i) => {
    if (signoff !== null && i === paras.length - 1) return;
    if (i === reviewIdx) return;
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
    title: name ? t.title(name, c) : t.titleNoName(c),
    signature: input.houseSignature ? "house" : "juan",
  });
}
