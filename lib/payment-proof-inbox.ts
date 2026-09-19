// lib/payment-proof-inbox.ts — El carril del justificante que llega por EMAIL.
//
// Hasta hoy (19-sep-2026) el cliente mandaba el comprobante de su transferencia
// por correo y ahí se quedaba: la bandeja solo se sincroniza cuando alguien la
// abre y pulsa, y nadie clasificaba los adjuntos. El caso de Ikbel Dridi hubo
// que hacerlo entero a mano.
//
// Esto hace lo aburrido: mira los correos nuevos con adjunto, pregunta a Haiku
// si es un justificante, y lo cruza con los presupuestos vivos sin pagar.
//
// Lo que NO hace, y es deliberado: cobrar. Un justificante es una afirmación del
// cliente, no un ingreso. El cruce se propone; el cobro lo sella una persona
// (mismo criterio que el endpoint de justificantes del cliente, que deja el
// pedido en JUSTIFICANTE_SUBIDO).

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractPaymentProof, type PaymentProofRead } from "@/lib/ai/extract-payment-proof";

export type QuoteCandidate = {
  id: string;
  quoteNumber: string;
  customerEmail: string;
  customerName: string | null;
  totalCents: number;
};

export type ProofMatch = {
  quote: QuoteCandidate | null;
  motivo: string;
  candidatos: number;
};

/**
 * Cruza la lectura del justificante con los presupuestos vivos sin pagar.
 * Puro (sin Prisma) para poder probarlo.
 *
 * Solo se propone un presupuesto cuando NO hay ambigüedad: importe exacto y, si
 * varios coinciden en importe, que el remitente del correo sea su cliente. Un
 * cruce dudoso que mueve dinero es peor que no cruzar nada.
 */
export function pickQuoteForProof(
  read: Pick<PaymentProofRead, "esJustificante" | "importeCents" | "moneda">,
  fromEmail: string,
  candidatos: QuoteCandidate[]
): ProofMatch {
  if (!read.esJustificante) return { quote: null, motivo: "el adjunto no es un justificante de pago", candidatos: 0 };
  if (!read.importeCents) return { quote: null, motivo: "no se ha podido leer el importe", candidatos: 0 };
  if (read.moneda && read.moneda.toUpperCase() !== "EUR") {
    return { quote: null, motivo: `el justificante viene en ${read.moneda}, no en euros`, candidatos: 0 };
  }

  const mismoImporte = candidatos.filter((q) => q.totalCents === read.importeCents);
  if (mismoImporte.length === 0) {
    return { quote: null, motivo: "ningún presupuesto vivo tiene ese importe", candidatos: 0 };
  }
  if (mismoImporte.length === 1) {
    return { quote: mismoImporte[0], motivo: "importe exacto y único", candidatos: 1 };
  }

  const email = fromEmail.trim().toLowerCase();
  const delRemitente = mismoImporte.filter((q) => q.customerEmail.trim().toLowerCase() === email);
  if (delRemitente.length === 1) {
    return { quote: delRemitente[0], motivo: "importe exacto y remitente del presupuesto", candidatos: mismoImporte.length };
  }
  return {
    quote: null,
    motivo: `${mismoImporte.length} presupuestos con ese mismo importe: hay que elegir a mano`,
    candidatos: mismoImporte.length,
  };
}

type Adjunto = { url?: string; contentType?: string; name?: string };

const LEIBLE = /^(application\/pdf|image\/(jpeg|png|webp|gif))$/;

/** Adjuntos que Claude puede mirar; el resto se ignora sin gastar nada. */
export function usableAttachments(mediaJson: unknown): Adjunto[] {
  if (!Array.isArray(mediaJson)) return [];
  return (mediaJson as Adjunto[]).filter((a) => a?.url && LEIBLE.test(String(a.contentType || "")));
}

export type ScanResult = {
  revisados: number;
  justificantes: number;
  cruzados: number;
  avisados: number;
};

/**
 * Revisa los correos nuevos con adjunto que aún no se han mirado. Cada correo se
 * analiza UNA sola vez (se sella proofAt pase lo que pase): la lección del
 * dedup de documentos vale igual aquí — no se paga dos veces por el mismo papel.
 */
export async function scanInboxForPaymentProofs(opts?: { diasAtras?: number; max?: number }): Promise<ScanResult> {
  const dias = opts?.diasAtras ?? 7;
  const desde = new Date(Date.now() - dias * 24 * 3600 * 1000);
  const correos = await prisma.inboundEmail.findMany({
    where: { receivedAt: { gte: desde }, proofAt: null, mediaJson: { not: Prisma.DbNull } },
    orderBy: { receivedAt: "desc" },
    take: opts?.max ?? 20,
  });

  const res: ScanResult = { revisados: 0, justificantes: 0, cruzados: 0, avisados: 0 };

  for (const correo of correos) {
    const adjuntos = usableAttachments(correo.mediaJson);
    if (adjuntos.length === 0) {
      await prisma.inboundEmail.update({ where: { id: correo.id }, data: { proofAt: new Date() } }).catch(() => {});
      continue;
    }
    res.revisados++;
    let read: PaymentProofRead | null = null;
    let match: ProofMatch = { quote: null, motivo: "sin analizar", candidatos: 0 };
    try {
      const a = adjuntos[0];
      const bin = await fetch(a.url as string);
      const base64 = Buffer.from(await bin.arrayBuffer()).toString("base64");
      read = await extractPaymentProof({
        fileBase64: base64,
        mimeType: String(a.contentType),
        fileName: String(a.name || "adjunto"),
        emailSubject: correo.subject,
      });
      if (read.esJustificante) {
        res.justificantes++;
        const vivos = await prisma.quote.findMany({
          where: { paidAt: null, status: { in: ["SENT", "OPENED", "ACCEPTED"] as any } },
          select: { id: true, quoteNumber: true, customerEmail: true, customerName: true, total: true },
        });
        match = pickQuoteForProof(
          read,
          correo.fromEmail,
          vivos.map((q) => ({
            id: q.id,
            quoteNumber: q.quoteNumber,
            customerEmail: q.customerEmail,
            customerName: q.customerName,
            totalCents: Math.round(Number(q.total) * 100),
          }))
        );
        if (match.quote) res.cruzados++;
      }
    } catch (err) {
      console.error("[justificantes] lectura falló", correo.id, err);
      match = { quote: null, motivo: "la lectura del adjunto falló", candidatos: 0 };
    }

    await prisma.inboundEmail
      .update({
        where: { id: correo.id },
        data: {
          proofAt: new Date(),
          proofJson: {
            read: read as any,
            match: { quoteId: match.quote?.id ?? null, quoteNumber: match.quote?.quoteNumber ?? null, motivo: match.motivo, candidatos: match.candidatos },
          } as any,
        },
      })
      .catch((e) => console.error("[justificantes] no se pudo guardar la lectura", correo.id, e));

    if (read?.esJustificante) {
      await avisarStaff(correo.fromEmail, correo.fromName, read, match).catch((e) =>
        console.error("[justificantes] aviso falló", e)
      );
      res.avisados++;
    }
  }

  return res;
}

async function avisarStaff(fromEmail: string, fromName: string | null, read: PaymentProofRead, match: ProofMatch) {
  const { sendMail } = await import("@/lib/azure-mail");
  const { renderSimpleEmailHtml } = await import("@/lib/quote-messages");
  const importe = read.importeCents != null ? `${(read.importeCents / 100).toFixed(2)} €` : "importe ilegible";
  const quien = fromName ? `${fromName} (${fromEmail})` : fromEmail;

  const cuerpo = match.quote
    ? `${quien} ha enviado por email un justificante de ${importe} que cuadra con el presupuesto ${match.quote.quoteNumber} (${match.quote.customerName || match.quote.customerEmail}).

Cruce: ${match.motivo}.
Concepto del justificante: ${read.concepto || "—"} · fecha ${read.fecha || "—"}.

NO se ha cobrado nada: compruébalo contra el banco y confírmalo desde el presupuesto.
https://www.traduccionesjuradas.net/zona-traductor/presupuestos/${match.quote.id}`
    : `${quien} ha enviado por email un justificante de ${importe}, pero no se ha podido cruzar solo.

Motivo: ${match.motivo}.
Concepto: ${read.concepto || "—"} · fecha ${read.fecha || "—"} · ordenante ${read.ordenante || "—"}.

Está en la bandeja: https://www.traduccionesjuradas.net/admin/inbox`;

  await sendMail({
    to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
    subject: match.quote
      ? `Justificante de ${importe} — cuadra con ${match.quote.quoteNumber}`
      : `Justificante de ${importe} sin cruzar`,
    text: cuerpo,
    html: renderSimpleEmailHtml(cuerpo),
  });
}
