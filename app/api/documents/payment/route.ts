// app/api/documents/payment/route.ts — Crear sesión Stripe o pedido Bizum/Transferencia para documento analizado

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
    const { documentId, isUrgent, clientName, clientEmail, clientPhone, paymentMethod: rawPaymentMethod } = body;
    const paymentMethod = rawPaymentMethod === "BIZUM" ? "BIZUM" : rawPaymentMethod === "TRANSFER" ? "TRANSFER" : "STRIPE";

    if (!documentId || !clientName || !clientEmail) {
      return NextResponse.json(
        { ok: false, error: "documentId, clientName y clientEmail son obligatorios." },
        { status: 400 }
      );
    }

    // Fetch document analysis
    const doc = await prisma.documentAnalysis.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json(
        { ok: false, error: "Documento no encontrado." },
        { status: 404 }
      );
    }

    if (!doc.quoteAmount) {
      return NextResponse.json(
        { ok: false, error: "El documento aún no tiene presupuesto." },
        { status: 400 }
      );
    }

    // Calculate amount
    const amount = isUrgent ? doc.quoteUrgent || doc.quoteAmount : doc.quoteAmount;
    const amountCents = Math.round(amount * 100);

    // Generate order reference
    const orderReference = generateOrderReference();

    // Create order in DB
    const docTypeLabel =
      (doc.analysisJson as any)?.document_type?.specific_type_es || "Documento";
    const langSource = doc.sourceLanguage || "?";
    const langTarget = doc.targetLanguage || "es";
    const title = `${docTypeLabel} (${langSource.toUpperCase()} → ${langTarget.toUpperCase()})`;

    const order = await prisma.order.create({
      data: {
        reference: orderReference,
        clientEmail: clientEmail,
        clientName: clientName,
        source: "ia-presupuesto",
        title: title,
        langPair: `${langSource}-${langTarget}`,
        words: doc.estimatedWords || 0,
        amountCents: amountCents,
        currency: "eur",
        status: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        paymentMethod: paymentMethod,
        deliveryState: "PRESUPUESTO",
        dueDate: new Date(Date.now() + (isUrgent ? 24 : 48) * 60 * 60 * 1000),
      },
    });

    // Link document to order + update client info
    await prisma.documentAnalysis.update({
      where: { id: documentId },
      data: {
        orderId: order.id,
        clientEmail: clientEmail,
        clientName: clientName,
        clientPhone: clientPhone || null,
        status: "PAYMENT_PENDING",
      },
    });

    if (paymentMethod === "BIZUM" || paymentMethod === "TRANSFER") {
      // Manual payment: redirect to payment page for proof upload
      return NextResponse.json({
        ok: true,
        orderReference: orderReference,
        paymentUrl: `/area-cliente/pedido/${orderReference}/pagar`,
      });
    }

    // Stripe: create checkout session
    const idempotencyKey = `ia-doc-${documentId}-${orderReference}`;

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
        { ok: false, error: "Pasarela de pago no configurada. Contacta con soporte." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { ok: false, error: "Error al procesar el pago. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
