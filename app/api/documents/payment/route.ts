// app/api/documents/payment/route.ts — Crear sesión Stripe o pedido Bizum/Transferencia para documento(s) analizado(s)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/stripe";
import crypto from "node:crypto";

export const runtime = "nodejs";

function generateOrderReference(): string {
  const year = new Date().getFullYear();
  const random = crypto.randomInt(1000, 9999);
  const seq = Date.now().toString(36).slice(-4).toUpperCase();
  return `TJ-${year}-${seq}${random}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      documentId,
      documentIds: rawDocumentIds,
      isUrgent,
      clientName,
      clientEmail,
      clientPhone,
      paymentMethod: rawPaymentMethod,
    } = body;
    const paymentMethod =
      rawPaymentMethod === "BIZUM"
        ? "BIZUM"
        : rawPaymentMethod === "TRANSFER"
        ? "TRANSFER"
        : rawPaymentMethod === "PAYPAL"
        ? "PAYPAL"
        : "STRIPE";

    // Backward compat: accept single documentId or array documentIds
    const documentIds: string[] = rawDocumentIds
      ? rawDocumentIds
      : documentId
      ? [documentId]
      : [];

    if (documentIds.length === 0 || !clientName || !clientEmail) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "documentIds (o documentId), clientName y clientEmail son obligatorios.",
        },
        { status: 400 }
      );
    }

    // Fetch all document analyses
    const docs = await prisma.documentAnalysis.findMany({
      where: { id: { in: documentIds } },
    });

    if (docs.length !== documentIds.length) {
      return NextResponse.json(
        { ok: false, error: "Uno o más documentos no encontrados." },
        { status: 404 }
      );
    }

    const missingQuote = docs.find((d) => !d.quoteAmount);
    if (missingQuote) {
      return NextResponse.json(
        { ok: false, error: "Uno o más documentos aún no tienen presupuesto." },
        { status: 400 }
      );
    }

    // Calculate combined amount
    const totalAmount = docs.reduce((sum, doc) => {
      const docAmount = isUrgent
        ? doc.quoteUrgent || doc.quoteAmount!
        : doc.quoteAmount!;
      return sum + docAmount;
    }, 0);
    const amountCents = Math.round(totalAmount * 100);

    // Generate order reference
    const orderReference = generateOrderReference();

    // Build title and metadata
    let title: string;
    let langPair: string;
    let totalWords = 0;

    if (docs.length === 1) {
      const doc = docs[0];
      const docTypeLabel =
        (doc.analysisJson as any)?.document_type?.specific_type_es ||
        "Documento";
      const langSource = doc.sourceLanguage || "?";
      const langTarget = doc.targetLanguage || "es";
      title = `${docTypeLabel} (${langSource.toUpperCase()} → ${langTarget.toUpperCase()})`;
      langPair = `${langSource}-${langTarget}`;
      totalWords = doc.estimatedWords || 0;
    } else {
      title = `${docs.length} documentos para traducción jurada`;
      // Use the most common lang pair
      const langSource = docs[0].sourceLanguage || "?";
      const langTarget = docs[0].targetLanguage || "es";
      langPair = `${langSource}-${langTarget}`;
      totalWords = docs.reduce((sum, d) => sum + (d.estimatedWords || 0), 0);
    }

    // Compute the longest due date across all docs
    const maxDueMs = docs.reduce((max, doc) => {
      const days = isUrgent
        ? parseInt(doc.estimatedDaysUrgent || "1") || 1
        : parseInt(doc.estimatedDays || "2") || 2;
      return Math.max(max, days);
    }, 0);

    const order = await prisma.order.create({
      data: {
        reference: orderReference,
        clientEmail: clientEmail,
        clientName: clientName,
        source: "ia-presupuesto",
        title: title,
        langPair: langPair,
        words: totalWords,
        amountCents: amountCents,
        currency: "eur",
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        paymentMethod: paymentMethod,
        deliveryState: "PRESUPUESTO",
        dueDate: new Date(
          Date.now() + maxDueMs * 24 * 60 * 60 * 1000
        ),
      },
    });

    // Link all documents to the order + update client info
    await prisma.documentAnalysis.updateMany({
      where: { id: { in: documentIds } },
      data: {
        orderId: order.id,
        clientEmail: clientEmail,
        clientName: clientName,
        clientPhone: clientPhone || null,
        status: "PAYMENT_PENDING",
      },
    });

    if (paymentMethod === "PAYPAL") {
      return NextResponse.json({
        ok: true,
        orderReference: orderReference,
      });
    }

    if (paymentMethod === "BIZUM" || paymentMethod === "TRANSFER") {
      return NextResponse.json({
        ok: true,
        orderReference: orderReference,
        paymentUrl: `/area-cliente/pedido/${orderReference}/pagar`,
      });
    }

    // Stripe: create checkout session
    const idempotencyKey = `ia-doc-${documentIds.join(",")}-${orderReference}`;

    const session = await createCheckoutSession({
      reference: orderReference,
      amountCents: amountCents,
      title: `Traducción jurada: ${title}`,
      customerEmail: clientEmail,
      idempotencyKey: idempotencyKey,
    });

    return NextResponse.json({
      ok: true,
      checkoutUrl: session.url,
      orderReference: orderReference,
    });
  } catch (err: any) {
    console.error("[documents/payment]", err);

    if (err?.message?.includes("STRIPE_SECRET_KEY")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pasarela de pago no configurada. Contacta con soporte.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Error al procesar el pago. Inténtalo de nuevo.",
      },
      { status: 500 }
    );
  }
}
