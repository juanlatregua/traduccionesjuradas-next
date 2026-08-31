// lib/quote-margin.ts — Guarda de margen de los presupuestos de STAFF.
//
// "Nunca puedo perder" (Juan, 28-ago-2026) protegía SOLO el auto-presupuesto
// (lib/learned-rates.ts:478). Los 6 presupuestos vivos con precio == coste
// (Andressa 165, Daniel 75, Alves 70, Kieper 65, Carol 40 y Paula 137,94 — este
// creado tres días DESPUÉS del freno) salieron todos por el builder, que no
// comprobaba nada. Esta guarda cierra ese camino: la comparten el envío
// (lib/quote-send.ts), la edición (PATCH /api/quotes/[id]) y el presupuesto de
// la ficha del pedido.
//
// Reglas (Juan, 31-ago-2026: "prometemos precio cerrado en francés. En el
// resto, no"):
//  · FRANCÉS exento: Juan es el traductor, coste = precio por construcción y el
//    precio cerrado es la promesa pública.
//  · Sin coste registrado en ninguna línea → pasa: la ausencia de dato no es
//    evidencia de pérdida; el freno actúa sobre lo que sabe.
//  · Margen <= 0 o < MIN_AUTO_MARGIN_PCT → se FRENA antes de emitir, salvo
//    override explícito del staff — y con override se avisa por email + SMS
//    con await, no fire-and-forget (patrón caso 26_34F612).

import { evaluateLinesMargin, evaluateChannelPrice, MIN_AUTO_MARGIN_PCT, type StaffQuoteLine } from "@/lib/learned-rates-math";
import { isFrenchPair } from "@/lib/workflow";

export const MARGIN_BLOCK_CODE = "MARGEN_INSUFICIENTE";
export const CHANNEL_BLOCK_CODE = "CANAL_SIN_VERIFICAR";

export type QuoteMarginLine = StaffQuoteLine;

export type QuoteMarginCheck =
  | { ok: true }
  | { ok: false; priceCents: number; costCents: number; marginCents: number; marginPct: number; detail: string };

export function checkQuoteLinesMargin(input: {
  sourceLang: string | null | undefined;
  targetLang: string | null | undefined;
  lines: QuoteMarginLine[];
  discountCents?: number;
}): QuoteMarginCheck {
  // La aritmetica vive en lib/learned-rates-math (testable sin alias @/).
  const r = evaluateLinesMargin(input.lines, {
    isFrench: isFrenchPair(`${input.sourceLang || ""}-${input.targetLang || ""}`),
    discountCents: input.discountCents,
  });
  if (r.ok) return r;
  const eur = (c: number) => `${(c / 100).toFixed(2)} €`;
  return {
    ...r,
    detail: `precio ${eur(r.priceCents)} − coste ${eur(r.costCents)} = ${eur(r.marginCents)} de margen (${r.marginPct.toFixed(0)} %, mínimo ${MIN_AUTO_MARGIN_PCT} %)`,
  };
}

/** Aviso por DOS canales cuando el staff fuerza un envío por debajo del suelo.
 *  Con await en el llamador: en la lambda, un fire-and-forget muere al responder. */
export async function notifyMarginOverride(input: {
  kind: "presupuesto" | "pedido";
  label: string;
  actorEmail: string;
  detail: string;
  url: string;
  /** "enviado" (salio al cliente) | "guardado" (repreciado sin reenvio). */
  action?: "enviado" | "guardado";
  /** Con quoteId, el override deja RASTRO PERSISTIDO (MessageLog) ANTES del
   *  envio de los avisos — regla de la casa: rastro primero, canales despues. */
  quoteId?: string;
}): Promise<void> {
  const { sendMail } = await import("@/lib/azure-mail");
  const { renderSimpleEmailHtml } = await import("@/lib/quote-messages");
  const { sendStaffAlertSMS } = await import("@/lib/sms");
  const adminEmail = process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";
  const accion = input.action === "guardado" ? "se ha GUARDADO" : "ha salido";
  if (input.quoteId) {
    const { prisma } = await import("@/lib/prisma");
    await prisma.messageLog
      .create({
        data: {
          quoteId: input.quoteId,
          channel: "EMAIL",
          type: "MARGIN_OVERRIDE",
          recipient: adminEmail,
          subject: `Override de margen/canal por ${input.actorEmail}`,
          body: input.detail,
          sentAt: new Date(),
          status: "SENT",
        },
      })
      .catch((err) => console.error("[quote-margin] rastro fallo:", err));
  }
  const texto = [
    `El ${input.kind} ${input.label} ${accion} POR DEBAJO DEL SUELO DE MARGEN (o sin canal verificado) con override de ${input.actorEmail}.`,
    "",
    input.detail,
    "",
    "Si no has sido tú, o el coste está mal, corrígelo antes de que el cliente pague.",
    input.url,
  ].join("\n");
  await Promise.all([
    sendMail({
      to: adminEmail,
      subject: `⚠ ${input.label} enviado bajo el suelo de margen (override)`,
      text: texto,
      html: renderSimpleEmailHtml(texto),
    }).catch((err) => console.error("[quote-margin] email fallo:", err)),
    sendStaffAlertSMS(
      `TraduccionesJuradas: ${input.label} enviado BAJO EL SUELO DE MARGEN (override). Mira el email.`,
      `margen ${input.label}`
    ).catch((err) => console.error("[quote-margin] sms fallo:", err)),
  ]);
}

/** Verificacion de PROCEDENCIA (no-FR): el precio previo del traductor tiene
 *  que existir EN EL CANAL — solicitud de lavori PRICED/ACCEPTED enlazada al
 *  presupuesto (quoteId, con fallback por expedienteRef) — y las lineas cubrirlo.
 *  El auto-presupuesto queda exento via channelPriceSource: "learned-rate"
 *  (la tarifa APROBADA por Juan ya ES su verificacion del canal). */
export async function verifyTranslatorChannelPrice(input: {
  quoteId: string;
  expedienteRef?: string | null;
  sourceLang: string | null | undefined;
  targetLang: string | null | undefined;
  lines: QuoteMarginLine[];
}): Promise<{ ok: true } | { ok: false; detail: string }> {
  const isFrench = isFrenchPair(`${input.sourceLang || ""}-${input.targetLang || ""}`);
  if (isFrench) return { ok: true };

  const { prisma } = await import("@/lib/prisma");
  const req = await prisma.lavoriPriceRequest.findFirst({
    where: {
      status: { in: ["PRICED", "ACCEPTED"] },
      priceCents: { not: null },
      OR: [{ quoteId: input.quoteId }, ...(input.expedienteRef ? [{ expedienteRef: input.expedienteRef }] : [])],
    },
    orderBy: { updatedAt: "desc" },
    select: { ref: true, priceCents: true, miembroNombre: true },
  });

  const toCents = (n: number | null | undefined) => Math.round((Number(n) || 0) * 100);
  const costCents = input.lines.reduce((a, l) => a + Math.round((Number(l.quantity) || 1) * toCents(l.supplierUnitCost)), 0);
  const r = evaluateChannelPrice({ isFrench, channelPriceCents: req?.priceCents ?? null, costCents });
  if (r.ok) return r;

  const eur = (c: number) => `${(c / 100).toFixed(2)} €`;
  if (r.reason === "sin_precio_en_canal") {
    return {
      ok: false,
      detail: `no hay precio previo del traductor en el canal (ninguna solicitud PRICED/ACCEPTED enlazada a este presupuesto). Pide precio por lavori antes de enviar.`,
    };
  }
  return {
    ok: false,
    detail: `el coste de las líneas (${eur(r.costCents)}) no cubre el precio del jurado en el canal (${eur(r.channelPriceCents!)}${req?.miembroNombre ? `, ${req.miembroNombre}` : ""}, ${req?.ref}).`,
  };
}
