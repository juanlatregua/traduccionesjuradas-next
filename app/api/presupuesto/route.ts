// app/api/presupuesto/route.ts
import { NextResponse } from "next/server";
import {
  sendPresupuestoEmail,
  sendPresupuestoConfirmationEmail,
  sendOrderReviewRoutingEmail,
  type PresupuestoPayload,
} from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logPresupuesto } from "./logger";
import { createOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { inferFlowProfile } from "@/lib/workflow";
import { getAdminEmails, getPmEmails } from "@/lib/staff-access";
import {
  computeQuoteTotals,
  calculateValidUntil,
  generateQuoteNumber,
  generateQuoteToken,
} from "@/lib/quotes";
import { getWordRateForLangOrPair } from "@/lib/pricing";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `presupuesto:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json()) as PresupuestoPayload;

    // Honeypot
    if (body.website) {
      return NextResponse.json({ ok: true });
    }

    const email = body.contacto?.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Falta un email válido." },
        { status: 400 }
      );
    }

    if (!body.documentos || body.documentos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Añade al menos un documento al presupuesto." },
        { status: 400 }
      );
    }

    if (body.documentos.length > 20) {
      return NextResponse.json(
        { ok: false, error: "Máximo 20 documentos por solicitud." },
        { status: 400 }
      );
    }

    /* ------------------------------------------------------------------ */
    /*  1. Build title & compute totals from cart                          */
    /* ------------------------------------------------------------------ */
    const docLabels = body.documentos.map((d) => d.tipoLabel);
    const title =
      body.documentos.length === 1
        ? docLabels[0]
        : `${body.documentos.length} docs: ${docLabels.join(", ")}`;

    const totalEstimadoEur = body.documentos.reduce(
      (sum, d) => sum + (d.precioEstimado || 0),
      0
    );
    const amountCents = Math.round(totalEstimadoEur * 100);

    // Determine primary langPair from documents
    const combinaciones = [...new Set(body.documentos.map((d) => d.combinacion))];
    const langPair = combinaciones.length === 1 ? combinaciones[0] : combinaciones[0];

    const totalWords = body.documentos.reduce(
      (sum, d) => sum + (d.palabras || 0),
      0
    );

    /* ------------------------------------------------------------------ */
    /*  2. Persist: Customer + Order + Quote                               */
    /* ------------------------------------------------------------------ */
    const customer = await prisma.customer.upsert({
      where: { email },
      update: { name: email },
      create: { name: email, email, phone: body.contacto.telefono || null },
    });

    const order = await createOrder({
      clientEmail: email,
      clientName: undefined,
      source: "estimador",
      title,
      langPair,
      words: totalWords || undefined,
      amountCents: Math.max(amountCents, 0),
    });

    // OrderEvent: acquisition tracking
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.acquisition",
        message: "Captacion desde estimador de presupuestos.",
        payload: {
          source: "estimador",
          paginaOrigen: body.metadata.paginaOrigen,
          idioma: body.metadata.idioma,
          telefono: body.contacto.telefono || null,
          fechaLimite: body.contacto.fechaLimite || null,
        },
      },
    });

    // OrderEvent: items snapshot
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "estimador.items_snapshot",
        message: `${body.documentos.length} documento(s) en carrito estimador.`,
        payload: {
          items: body.documentos.map((d) => ({
            tipo: d.tipo,
            tipoLabel: d.tipoLabel,
            combinacion: d.combinacion,
            palabras: d.palabras,
            precioEstimado: d.precioEstimado,
            archivoNombre: d.archivoNombre || null,
            sinPrecio: d.sinPrecio || false,
            precioFijo: d.precioFijo || false,
          })),
          totalEstimadoEur,
          notas: body.contacto.notas || null,
        },
      },
    });

    // Flow profile
    const hasMixedCart = combinaciones.length > 1;
    const containsWordCountItem = body.documentos.some((d) => d.palabras > 0 && !d.precioFijo);
    const flowProfile = inferFlowProfile({ langPair, hasMixedCart, containsWordCountItem });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.flow_profile",
        message: `Perfil de flujo: ${flowProfile}.`,
        payload: { profile: flowProfile, hasMixedCart, containsWordCountItem },
      },
    });

    // Bootstrap workflow: insert BORRADOR event directly (no prior workflow event exists,
    // so getWorkflowState falls back to PENDIENTE_PAGO and no transition to BORRADOR is valid).
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "workflow.state_changed",
        message: "Workflow actualizado: (nuevo) -> BORRADOR. Motivo: Pedido creado desde estimador.",
        payload: {
          from: "NUEVO",
          to: "BORRADOR",
          actorEmail: email,
          reason: "Pedido creado desde estimador.",
        },
      },
    });

    // Now transition BORRADOR → PENDIENTE_REVISION (allowed by workflow rules)
    await transitionWorkflowState({
      reference: order.reference,
      to: "PENDIENTE_REVISION",
      actorEmail: email,
      reason: "Solicitud desde estimador: revisión previa al cobro.",
    });

    // Set due date if provided
    if (body.contacto.fechaLimite) {
      await prisma.order.update({
        where: { id: order.id },
        data: { dueDate: new Date(body.contacto.fechaLimite) },
      });
    }

    // Notes as event
    if (body.contacto.notas) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.urgency_notes",
          message: body.contacto.notas,
          payload: { actorEmail: email },
        },
      });
    }

    /* ------------------------------------------------------------------ */
    /*  3. Auto-create Quote DRAFT                                         */
    /* ------------------------------------------------------------------ */
    let autoQuoteId: string | null = null;

    try {
      const [sourceLang, targetLang] = langPair.includes("-")
        ? langPair.split("-")
        : [langPair, "es"];

      // Build quote lines: one per document
      const quoteLines = body.documentos.map((doc) => {
        if (doc.sinPrecio || doc.precioEstimado <= 0) {
          return {
            description: `${doc.tipoLabel} (${doc.combinacion.toUpperCase()})`,
            quantity: 1,
            unitPrice: 0,
          };
        }
        if (doc.precioFijo || doc.palabras <= 0) {
          // Fixed-price item: reverse IVA to get base price
          const basePrice = Math.round((doc.precioEstimado / 1.21) * 100) / 100;
          return {
            description: `${doc.tipoLabel} (${doc.combinacion.toUpperCase()}) — precio cerrado`,
            quantity: 1,
            unitPrice: basePrice,
          };
        }
        // Word-count item: use pricing config rate
        const rate = getWordRateForLangOrPair(doc.combinacion);
        return {
          description: `${doc.tipoLabel} (${doc.combinacion.toUpperCase()})`,
          quantity: doc.palabras,
          unitPrice: rate,
        };
      });

      const totals = computeQuoteTotals({
        lines: quoteLines,
        discountType: "NONE",
        discountValue: 0,
        vatRate: 0.21,
        deliveryType: "DIGITAL_PDF",
      });

      const issuedAt = new Date();
      const validUntil = calculateValidUntil(issuedAt, 15);

      // Generate unique quote number
      const year = issuedAt.getFullYear();
      const prefix = `${year}-`;
      const baseCount = await prisma.quote.count({
        where: { quoteNumber: { startsWith: prefix } },
      });
      let quoteNumber: string | null = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = await generateQuoteNumber(baseCount + attempt + 1, issuedAt);
        const exists = await prisma.quote.findUnique({
          where: { quoteNumber: candidate },
          select: { id: true },
        });
        if (!exists) { quoteNumber = candidate; break; }
      }
      if (!quoteNumber) throw new Error("No se pudo generar número de presupuesto único.");

      // Generate unique public token
      let publicToken: string | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = generateQuoteToken(28);
        const exists = await prisma.quote.findUnique({
          where: { publicToken: candidate },
          select: { id: true },
        });
        if (!exists) { publicToken = candidate; break; }
      }
      if (!publicToken) throw new Error("No se pudo generar token público único.");

      const quote = await prisma.quote.create({
        data: {
          quoteNumber,
          status: "DRAFT",
          customerId: customer.id,
          customerName: email,
          customerEmail: email,
          sourceLang: sourceLang || "unknown",
          targetLang: targetLang || "es",
          deliveryType: "DIGITAL_PDF",
          vatRate: 0.21,
          discountType: "NONE",
          discountValue: 0,
          validityDays: 15,
          issuedAt,
          validUntil,
          publicToken,
          subtotal: totals.subtotal,
          discountAmount: totals.discountAmount,
          shippingAmount: totals.shippingAmount,
          vatAmount: totals.vatAmount,
          total: totals.total,
          adminCreatedBy: "system:estimador",
          lines: {
            create: totals.lines.map((line) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
            })),
          },
        },
      });

      autoQuoteId = quote.id;

      await prisma.order.update({
        where: { id: order.id },
        data: { quoteId: quote.id },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.auto_quote_created",
          message: `Presupuesto DRAFT ${quoteNumber} generado desde estimador.`,
          payload: {
            quoteId: quote.id,
            quoteNumber,
            total: totals.total,
            actorEmail: "system:estimador",
          },
        },
      });
    } catch (quoteErr) {
      console.error("[presupuesto] auto-quote creation failed (non-blocking)", quoteErr);
    }

    /* ------------------------------------------------------------------ */
    /*  4. Send emails                                                     */
    /* ------------------------------------------------------------------ */
    const referencia = order.reference;
    const payload: PresupuestoPayload = {
      ...body,
      contacto: { ...body.contacto, email },
      referencia,
      orderReference: order.reference,
      quoteId: autoQuoteId || undefined,
    };

    const skipSend = process.env.SENDGRID_SKIP_DEV === "true";
    const missingEnv =
      !process.env.SENDGRID_API_KEY ||
      !process.env.SENDGRID_FROM ||
      !process.env.PRESUPUESTO_TO;

    if (skipSend) {
      console.warn("[/api/presupuesto] Envío de email omitido por SENDGRID_SKIP_DEV=true");
      logPresupuesto({
        status: "ok",
        referencia,
        orderReference: order.reference,
        quoteId: autoQuoteId || undefined,
        route: "api/presupuesto",
        userEmail: email,
        timestamp: new Date().toISOString(),
        error: "SKIP_DEV",
      });
      return NextResponse.json({
        ok: true,
        mensaje: "Solicitud recibida. Te responderemos en menos de 2 horas laborables.",
        referencia,
      });
    }

    if (missingEnv && process.env.NODE_ENV !== "production") {
      console.warn("[/api/presupuesto] Envío omitido: faltan env SENDGRID_* / PRESUPUESTO_TO");
      logPresupuesto({
        status: "ok",
        referencia,
        orderReference: order.reference,
        quoteId: autoQuoteId || undefined,
        route: "api/presupuesto",
        userEmail: email,
        timestamp: new Date().toISOString(),
        error: "Faltan env SENDGRID (pedido creado en BD)",
      });
      return NextResponse.json({
        ok: true,
        mensaje: "Solicitud recibida. Te responderemos en menos de 2 horas laborables.",
        referencia,
      });
    }

    // Email interno (presupuesto detallado)
    await sendPresupuestoEmail(payload);

    // Email de routing para revisión interna (con link a quote si existe)
    const reviewers = [...new Set([...getAdminEmails(), "hola@traduccionesjuradas.net"])];
    const pmEmail = getPmEmails()[0] || undefined;

    sendOrderReviewRoutingEmail({
      reference: order.reference,
      title,
      amountCents: Math.max(amountCents, 0),
      clientEmail: email,
      langPair,
      flowProfile,
      reviewers: reviewers.filter(Boolean),
      pmEmail,
      urgencyNotes: body.contacto.notas || undefined,
      reviewReason: "Solicitud desde estimador: revisión previa al cobro.",
      quoteId: autoQuoteId || undefined,
    }).catch((e) => console.error("[presupuesto] review routing email failed", e));

    // Confirmación al cliente (no bloqueante)
    sendPresupuestoConfirmationEmail(payload).catch((err: any) => {
      console.error("[/api/presupuesto] Error al enviar confirmación:", err);
    });

    // Review routed event
    prisma.orderEvent
      .create({
        data: {
          orderId: order.id,
          type: "order.review_routed",
          message: "Pedido enviado a revision interna desde estimador.",
          payload: {
            flowProfile,
            reviewers,
            pmEmail,
            reason: "Solicitud desde estimador.",
          },
        },
      })
      .catch((e) => console.error("[presupuesto] failed to save review_routed event", e));

    logPresupuesto({
      status: "ok",
      referencia,
      orderReference: order.reference,
      quoteId: autoQuoteId || undefined,
      route: "api/presupuesto",
      userEmail: email,
      toInternal: process.env.PRESUPUESTO_TO,
      toClient: email,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      mensaje: "Solicitud recibida. Te responderemos en menos de 2 horas laborables.",
      referencia,
    });
  } catch (err: any) {
    console.error("[API /presupuesto] Error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
