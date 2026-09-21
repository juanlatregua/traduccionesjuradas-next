// lib/payment-proof-auto.ts — Lee el justificante que el cliente subió a su
// pedido y, si cuadra TODO (matchProofToOrder), lanza el pedido por el camino
// canónico (confirmManualPaymentWithSideEffects). Orden de Juan 21-sep: se lanza
// siempre que cuadre, sin tope; queda "pendiente de ver en banco". Si no cuadra,
// no se lanza y staff recibe los motivos por dos canales.
// Rastro primero (paymentProofJson/CheckedAt), avisos después.
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractPaymentProof, type PaymentProofRead } from "@/lib/ai/extract-payment-proof";
import {
  findReusedProof,
  matchProofToOrder,
  proofNeedsManualReview,
  transferFingerprint,
  type ProofDecision,
} from "@/lib/payment-proof-match";
import { transferAccountsLast4 } from "@/lib/payment-labels";
import { getWorkflowState } from "@/lib/workflow";
import { confirmManualPaymentWithSideEffects } from "@/lib/payments-confirm";

const HIGH_AMOUNT_CENTS = 30000;
const FRESH_PROOF_MS = 7 * 24 * 60 * 60 * 1000;
const STATE_GRACE_MS = 60 * 60 * 1000;
const READING_STALE_MS = 15 * 60 * 1000;
const REUSE_WINDOW_MS = 180 * 24 * 60 * 60 * 1000;
const ACTOR = "cron:justificantes";

export type ProofRunResult = { revisados: number; lanzados: number; avisados: number; omitidos: number };

const eur = (cents: number) => `${(cents / 100).toFixed(2)} €`;

function mimeFor(url: string, header: string | null): string {
  const h = String(header || "").split(";")[0].trim().toLowerCase();
  if (/^(application\/pdf|image\/(jpeg|png|webp|gif))$/.test(h)) return h;
  const ext = (url.split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function staffAlert(subject: string, text: string, sms: string, context: string): Promise<unknown> {
  return (async () => {
    const { sendMail } = await import("@/lib/azure-mail");
    const { renderSimpleEmailHtml } = await import("@/lib/quote-messages");
    const { sendStaffAlertSMS } = await import("@/lib/sms");
    await Promise.all([
      sendMail({
        to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
        subject,
        text,
        html: renderSimpleEmailHtml(text),
      }).catch((e) => console.error("[justificantes] email staff", e)),
      sendStaffAlertSMS(sms, context).catch((e) => console.error("[justificantes] sms staff", e)),
    ]);
  })().catch((e) => console.error("[justificantes] aviso staff", e));
}

function staffEmail(subject: string, text: string): Promise<unknown> {
  return (async () => {
    const { sendMail } = await import("@/lib/azure-mail");
    const { renderSimpleEmailHtml } = await import("@/lib/quote-messages");
    await sendMail({
      to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
      subject,
      text,
      html: renderSimpleEmailHtml(text),
    });
  })().catch((e) => console.error("[justificantes] email staff", e));
}

export async function processUploadedProofs(opts?: { max?: number; now?: Date }): Promise<ProofRunResult> {
  const now = opts?.now ?? new Date();
  const res: ProofRunResult = { revisados: 0, lanzados: 0, avisados: 0, omitidos: 0 };
  const avisos: Promise<unknown>[] = [];
  const staleBefore = new Date(now.getTime() - READING_STALE_MS);
  // Pendientes, o reclamados por una pasada que murió leyendo hace >15 min.
  const claimable: Prisma.OrderWhereInput = {
    OR: [
      { paymentProofCheckedAt: null },
      { paymentProofCheckedAt: { lt: staleBefore }, paymentProofJson: { path: ["estado"], equals: "leyendo" } },
    ],
  };

  const candidates = await prisma.order.findMany({
    where: { paymentProofFileKey: { not: null }, paymentStatus: { not: "PAID" }, ...claimable },
    orderBy: { updatedAt: "asc" },
    take: 30,
    select: {
      id: true,
      reference: true,
      title: true,
      amountCents: true,
      clientEmail: true,
      createdAt: true,
      paymentStatus: true,
      deliveryState: true,
      quote: { select: { sentAt: true, quoteNumber: true } },
      events: { orderBy: { createdAt: "desc" }, take: 80, select: { type: true, payload: true, createdAt: true } },
    },
  });

  const seal = (id: string, reference: string, json: Record<string, unknown>) =>
    prisma.order
      .update({ where: { id }, data: { paymentProofJson: { ...json, at: now.toISOString() } as Prisma.InputJsonValue } })
      .catch((e) => console.error("[justificantes] rastro", reference, e));

  const max = opts?.max ?? 10;
  for (const order of candidates) {
    if (res.revisados >= max) break;
    const proofEvent = order.events.find((e) => e.type === "payment.proof_uploaded");
    const payload = (proofEvent?.payload || {}) as { fileUrl?: string; fileName?: string; method?: string; fileHash?: string };
    const state = getWorkflowState(order);

    if (state !== "JUSTIFICANTE_SUBIDO") {
      // Recién subido: la transición aún puede estar en curso, se mira en la próxima pasada.
      if (proofEvent && now.getTime() - proofEvent.createdAt.getTime() < STATE_GRACE_MS) continue;
      await prisma.order
        .updateMany({
          where: { id: order.id, ...claimable },
          data: { paymentProofCheckedAt: now, paymentProofJson: { skipped: `estado ${state}`, at: now.toISOString() } },
        })
        .catch((e) => console.error("[justificantes] rastro", order.reference, e));
      res.omitidos++;
      continue;
    }

    const claimed = await prisma.order.updateMany({
      where: { id: order.id, ...claimable },
      data: { paymentProofCheckedAt: now, paymentProofJson: { estado: "leyendo", desde: now.toISOString() } },
    });
    if (claimed.count !== 1) continue;

    // Justificantes de antes de este cron (o sin fichero localizable): se sellan
    // sin leer ni avisar, para no lanzar ni alertar sobre pedidos viejos.
    if (!proofEvent || !payload.fileUrl || now.getTime() - proofEvent.createdAt.getTime() > FRESH_PROOF_MS) {
      await seal(order.id, order.reference, { skipped: !payload.fileUrl ? "sin fichero" : "justificante antiguo" });
      res.omitidos++;
      continue;
    }

    // Bizum/PayPal no llevan cuenta de destino: revisión manual. Staff ya tiene
    // el email de la subida; aquí no se lee ni se avisa otra vez.
    if (proofNeedsManualReview(payload.method)) {
      await seal(order.id, order.reference, { revision: "manual", method: payload.method || null, fileUrl: payload.fileUrl });
      res.omitidos++;
      continue;
    }

    res.revisados++;
    const orderUrl = `https://www.traduccionesjuradas.net/zona-traductor/pedido/${encodeURIComponent(order.reference)}`;
    let read: PaymentProofRead | null = null;
    let decision: ProofDecision;
    let fileHash: string | null = payload.fileHash || null;
    try {
      const bin = await fetch(payload.fileUrl);
      if (!bin.ok) throw new Error(`descarga ${bin.status}`);
      const buf = Buffer.from(await bin.arrayBuffer());
      fileHash = fileHash || crypto.createHash("sha256").update(buf).digest("hex");
      read = await extractPaymentProof({
        fileBase64: buf.toString("base64"),
        mimeType: mimeFor(payload.fileUrl, bin.headers.get("content-type")),
        fileName: payload.fileName || "justificante",
      });
      decision = matchProofToOrder(read, {
        totalCents: order.amountCents,
        ourAccountsLast4: transferAccountsLast4(),
        since: order.quote?.sentAt ?? order.createdAt,
        now,
      });
    } catch (err: any) {
      console.error("[justificantes] lectura falló", order.reference, err);
      decision = { ok: false, reasons: [`no se pudo leer el justificante (${String(err?.message || err).slice(0, 120)})`] };
    }

    const fingerprint = read ? transferFingerprint(read) : null;
    if (decision.ok) {
      const confirmed = await prisma.order.findMany({
        where: {
          id: { not: order.id },
          paymentProofCheckedAt: { gte: new Date(now.getTime() - REUSE_WINDOW_MS) },
          paymentProofJson: { path: ["autoConfirmed"], equals: true },
        },
        select: { reference: true, paymentProofJson: true },
      });
      const reused = findReusedProof(
        { reference: order.reference, fileHash, fingerprint },
        confirmed.map((c) => {
          const j = (c.paymentProofJson || {}) as { fileHash?: string | null; fingerprint?: string | null };
          return { reference: c.reference, fileHash: j.fileHash ?? null, fingerprint: j.fingerprint ?? null };
        })
      );
      if (reused) {
        decision = {
          ok: false,
          reasons: [`justificante ya usado para lanzar el pedido ${reused.reference} (mismo ${reused.by})`],
        };
      }
    }

    const base = {
      read: read as any,
      decision: decision as any,
      method: payload.method || null,
      fileUrl: payload.fileUrl,
      fileHash,
      fingerprint,
    };
    await seal(order.id, order.reference, base);

    const quien = `${order.reference}${order.quote?.quoteNumber ? ` (presupuesto ${order.quote.quoteNumber})` : ""} · ${order.clientEmail}`;

    if (!decision.ok) {
      res.avisados++;
      const text = `El justificante subido al pedido ${quien} NO cuadra y el pedido NO se ha lanzado.

Motivos:
${decision.reasons.map((r) => `· ${r}`).join("\n")}

Total del pedido: ${eur(order.amountCents)}. Ordenante: ${read?.ordenante || "—"} · fecha ${read?.fecha || "—"} · concepto ${read?.concepto || "—"}.
Justificante: ${payload.fileUrl}
Revísalo contra el banco y confírmalo a mano: ${orderUrl}`;
      avisos.push(
        staffAlert(
          `Justificante sin cuadrar — ${order.reference}`,
          text,
          `TraduccionesJuradas: justificante de ${order.reference} NO cuadra (${decision.reasons[0]}). Pedido sin lanzar. Mira el email.`,
          `justificante ${order.reference}`
        )
      );
      continue;
    }

    try {
      const confirm = await confirmManualPaymentWithSideEffects(order.reference, "TRANSFER", ACTOR);
      await prisma.order
        .update({
          where: { id: order.id },
          data: {
            paymentProofJson: {
              ...base,
              at: now.toISOString(),
              autoConfirmed: confirm.changed,
              ...(confirm.changed ? { nota: "confirmado por justificante, pendiente de ver en banco" } : {}),
            } as Prisma.InputJsonValue,
            ...(confirm.changed
              ? {
                  events: {
                    create: {
                      type: "payment.proof_auto_confirmed",
                      message: "Pago confirmado por justificante (lectura automática), pendiente de ver en banco.",
                      payload: { importeCents: read?.importeCents ?? null, ordenante: read?.ordenante ?? null, fecha: read?.fecha ?? null },
                    },
                  },
                }
              : {}),
          },
        })
        .catch((e) => console.error("[justificantes] rastro confirmado", order.reference, e));
      if (!confirm.changed) continue;
      res.lanzados++;

      const text = `El pedido ${quien} se ha LANZADO por justificante: ${eur(order.amountCents)} de ${read?.ordenante || "—"} (${read?.fecha || "—"}) a la cuenta ····${read?.cuentaDestinoUltimos4 || "—"}.

Confirmado por justificante, pendiente de ver en banco.
Justificante: ${payload.fileUrl}
${orderUrl}`;
      if (order.amountCents > HIGH_AMOUNT_CENTS) {
        avisos.push(
          staffAlert(
            `⚠ ${eur(order.amountCents)} lanzado por justificante — ${order.reference} (ver en banco)`,
            text,
            `TraduccionesJuradas: ${order.reference} LANZADO por justificante de ${eur(order.amountCents)} (>300). Compruébalo en el banco.`,
            `justificante ${order.reference}`
          )
        );
      } else {
        avisos.push(staffEmail(`Lanzado por justificante — ${order.reference} (ver en banco)`, text));
      }
    } catch (err: any) {
      console.error("[justificantes] confirmación falló", order.reference, err);
      res.avisados++;
      avisos.push(
        staffAlert(
          `Justificante cuadra pero NO se pudo lanzar — ${order.reference}`,
          `El justificante del pedido ${quien} cuadra, pero la confirmación falló: ${String(err?.message || err).slice(0, 300)}.\nConfírmalo a mano: ${orderUrl}`,
          `TraduccionesJuradas: ${order.reference} justificante OK pero la confirmación FALLÓ. Confírmalo a mano.`,
          `justificante ${order.reference}`
        )
      );
    }
  }

  await Promise.allSettled(avisos);
  return res;
}
