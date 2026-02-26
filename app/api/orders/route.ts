import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createOrder, getOrdersByClientEmail } from "@/lib/orders";
import {
  sendNewOrderStaffEmail,
  sendOrderCreatedEmail,
  sendOrderReviewRoutingEmail,
  sendOrderUnderReviewClientEmail,
} from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { inferFlowProfile, requiresInternalReview } from "@/lib/workflow";
import { getAdminEmails, getCollaboratorEmails, getPmEmails } from "@/lib/staff-access";
import {
  computeQuoteTotals,
  calculateValidUntil,
  generateQuoteNumber,
  generateQuoteToken,
} from "@/lib/quotes";
import { getWordRateForLangOrPair } from "@/lib/pricing";

export const runtime = "nodejs";

/* GET  /api/orders  — list orders for authenticated client */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
  }

  try {
    const orders = await getOrdersByClientEmail(session.user.email);
    return NextResponse.json({ ok: true, orders });
  } catch (err) {
    console.error("[orders] error listing orders", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedidos." }, { status: 500 });
  }
}

/* POST /api/orders  — create a new order (auth OR guest with email) */
type CreateBody = {
  source?: "preset" | "file";
  title?: string;
  langPair?: string;
  words?: number;
  pagesLabel?: string;
  amountCents?: number;
  currency?: string;
  guestEmail?: string;
  guestName?: string;
  urgencyNotes?: string;
  reviewRequired?: boolean;
  reviewReason?: string;
  hasMixedCart?: boolean;
  containsWordCountItem?: boolean;
  sourceChannel?: string;
  sourceAgent?: string;
  sourceCampaign?: string;
  sourceMedium?: string;
  sourceLanding?: string;
  checkoutSessionId?: string;
  checkoutStep?: "SELECT" | "UPLOAD" | "CHECKOUT" | "CONFIRM";
  selectedDocumentTypes?: string[];
  uploadedFilesCount?: number;
  idempotencyKey?: string;
  estimationMeta?: Record<string, unknown>;
};

type AcquisitionSnapshot = {
  source: "WHATSAPP" | "WEB";
  sourceRaw: string | null;
  agent: string | null;
  campaign: string | null;
  medium: string | null;
  landing: string | null;
  referer: string | null;
};

function normalizeToken(raw?: string | null) {
  if (!raw) return null;
  const cleaned = raw.trim().toLowerCase();
  return cleaned || null;
}

function normalizeIdempotencyKey(raw?: string | null) {
  const value = String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9:_\-.]/g, "");
  if (!value) return null;
  return value.slice(0, 140);
}

function inferAcquisitionSource(req: Request, body: CreateBody): AcquisitionSnapshot {
  const refererRaw = req.headers.get("referer");
  const refererUrl = refererRaw ? (() => { try { return new URL(refererRaw); } catch { return null; } })() : null;

  const sourceRaw =
    normalizeToken(body.sourceChannel) ||
    normalizeToken(refererUrl?.searchParams.get("src")) ||
    normalizeToken(refererUrl?.searchParams.get("utm_source"));
  const agent =
    normalizeToken(body.sourceAgent) ||
    normalizeToken(refererUrl?.searchParams.get("agent"));
  const campaign =
    normalizeToken(body.sourceCampaign) ||
    normalizeToken(refererUrl?.searchParams.get("campaign")) ||
    normalizeToken(refererUrl?.searchParams.get("utm_campaign"));
  const medium =
    normalizeToken(body.sourceMedium) ||
    normalizeToken(refererUrl?.searchParams.get("utm_medium"));
  const landing =
    normalizeToken(body.sourceLanding) ||
    (refererUrl ? refererUrl.pathname + refererUrl.search : null);

  const isWhatsApp =
    sourceRaw === "wa" ||
    sourceRaw === "whatsapp" ||
    sourceRaw === "whatsapp_web" ||
    sourceRaw === "whatsapp_app";

  return {
    source: isWhatsApp ? "WHATSAPP" : "WEB",
    sourceRaw,
    agent,
    campaign,
    medium,
    landing,
    referer: refererRaw || null,
  };
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `orders:create:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Intentalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const session = await getServerSession(authOptions);
  let clientEmail: string;
  let clientName: string | undefined;

  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo invalido." }, { status: 400 });
  }

  if (session?.user?.email) {
    clientEmail = session.user.email;
    clientName = session.user.name || undefined;
  } else if (body.guestEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.guestEmail)) {
    clientEmail = body.guestEmail.trim().toLowerCase();
    clientName = body.guestName?.trim() || undefined;
  } else {
    return NextResponse.json(
      { ok: false, error: "Sesion o email requerido." },
      { status: 401 }
    );
  }

  try {
    if (!body.title || !body.amountCents || body.amountCents < 100) {
      return NextResponse.json(
        { ok: false, error: "Titulo e importe requeridos (minimo 1 EUR)." },
        { status: 400 }
      );
    }

    const idempotencyKey =
      normalizeIdempotencyKey(req.headers.get("x-idempotency-key")) ||
      normalizeIdempotencyKey(body.idempotencyKey) ||
      normalizeIdempotencyKey(body.checkoutSessionId ? `checkout:${body.checkoutSessionId}` : null);

    if (idempotencyKey) {
      const existing = await prisma.order.findFirst({
        where: {
          idempotencyKey,
          clientEmail,
        },
        select: {
          id: true,
          reference: true,
        },
      });
      if (existing) {
        return NextResponse.json({
          ok: true,
          order: { id: existing.id, reference: existing.reference },
          nextStep: "PAY_NOW",
          flowProfile: null,
          acquisitionSource: null,
          idempotentReplay: true,
        });
      }
    }

    const order = await createOrder({
      clientEmail,
      clientName,
      source: body.source || "file",
      title: body.title,
      langPair: body.langPair,
      words: body.words,
      pagesLabel: body.pagesLabel,
      amountCents: body.amountCents,
      currency: body.currency || "eur",
      idempotencyKey: idempotencyKey || undefined,
    });
    const acquisition = inferAcquisitionSource(req, body);

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.acquisition",
        message: `Origen de captacion: ${acquisition.source}.`,
        payload: {
          source: acquisition.source,
          sourceRaw: acquisition.sourceRaw,
          agent: acquisition.agent,
          campaign: acquisition.campaign,
          medium: acquisition.medium,
          landing: acquisition.landing,
          referer: acquisition.referer,
          actorEmail: clientEmail,
        },
      },
    });

    if (acquisition.source === "WHATSAPP") {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "wa.lead_received",
          message: "Lead recibido desde WhatsApp y derivado al flujo web.",
          payload: {
            sourceRaw: acquisition.sourceRaw,
            agent: acquisition.agent,
            campaign: acquisition.campaign,
            actorEmail: clientEmail,
          },
        },
      });
    }

    const flowProfile = inferFlowProfile({
      langPair: body.langPair,
      hasMixedCart: Boolean(body.hasMixedCart),
      containsWordCountItem: Boolean(body.containsWordCountItem),
    });
    const needsInternalReview = body.reviewRequired === true || requiresInternalReview(flowProfile);
    const reviewReason =
      (body.reviewReason || "").trim() ||
      (needsInternalReview ? "Pedido requiere validacion interna antes de cobro." : null);
    const urgencyNotes = (body.urgencyNotes || "").trim() || null;

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "workflow.state_changed",
        message: "Workflow inicial en BORRADOR.",
        payload: {
          from: null,
          to: "BORRADOR",
          actorEmail: "system",
          reason: "order_created",
        },
      },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.flow_profile",
        message: `Perfil de flujo detectado: ${flowProfile}.`,
        payload: {
          profile: flowProfile,
          hasMixedCart: Boolean(body.hasMixedCart),
          containsWordCountItem: Boolean(body.containsWordCountItem),
          reviewRequired: needsInternalReview,
        },
      },
    });

    if (urgencyNotes) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.urgency_notes",
          message: "Observaciones de urgencia registradas.",
          payload: {
            notes: urgencyNotes,
            actorEmail: clientEmail,
          },
        },
      });
    }

    if (body.estimationMeta && typeof body.estimationMeta === "object") {
      const meta = body.estimationMeta;
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.estimation_snapshot",
          message: "Snapshot de estimacion automatica capturado.",
          payload: {
            words: meta.words ?? null,
            rate: meta.rate ?? null,
            estimatedByPages: meta.estimatedByPages ?? null,
            pageCount: meta.pageCount ?? null,
            marginPct: meta.marginPct ?? null,
            extractionMethod: meta.extractionMethod ?? null,
            confidence: meta.confidence ?? null,
            documentType: meta.documentType ?? null,
            hasApostille: meta.hasApostille ?? null,
            warnings: Array.isArray(meta.warnings) ? meta.warnings : [],
            estimatedTotalCents: body.amountCents ?? null,
            actorEmail: clientEmail,
          },
        },
      });
    }

    const checkoutSessionId = String(body.checkoutSessionId || "").trim() || null;
    const checkoutStepRaw = String(body.checkoutStep || "")
      .trim()
      .toUpperCase();
    const checkoutStep = ["SELECT", "UPLOAD", "CHECKOUT", "CONFIRM"].includes(checkoutStepRaw)
      ? checkoutStepRaw
      : null;
    const selectedDocumentTypes = Array.isArray(body.selectedDocumentTypes)
      ? body.selectedDocumentTypes
          .map((item) => String(item || "").trim())
          .filter(Boolean)
          .slice(0, 50)
      : [];
    const uploadedFilesCount = Number.isFinite(Number(body.uploadedFilesCount))
      ? Math.max(0, Math.floor(Number(body.uploadedFilesCount)))
      : null;
    if (checkoutSessionId || checkoutStep || selectedDocumentTypes.length > 0 || uploadedFilesCount != null) {
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "checkout.session_synced",
          message: "Snapshot de checkout recibido para preservar estado del funnel.",
          payload: {
            checkoutSessionId,
            checkoutStep,
            selectedDocumentTypes,
            uploadedFilesCount,
            actorEmail: clientEmail,
          },
        },
      });
    }

    let autoQuoteId: string | null = null;

    if (needsInternalReview) {
      await transitionWorkflowState({
        reference: order.reference,
        to: "PENDIENTE_REVISION",
        actorEmail: clientEmail,
        reason: reviewReason,
      });

      // Auto-create Quote DRAFT for review languages
      try {
        const langPair = String(body.langPair || "").trim().toLowerCase();
        const [sourceLang, targetLang] = langPair.includes("-")
          ? langPair.split("-")
          : [langPair, "es"];
        const unitPrice = getWordRateForLangOrPair(langPair);
        const words = body.words || 0;

        const totals = computeQuoteTotals({
          lines: [{ description: body.title, quantity: words, unitPrice }],
          discountType: "NONE",
          discountValue: 0,
          vatRate: 0.21,
          deliveryType: "DIGITAL_PDF",
        });

        const issuedAt = new Date();
        const validUntil = calculateValidUntil(issuedAt, 15);

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

        const customer = await prisma.customer.upsert({
          where: { email: clientEmail },
          update: { name: clientName || clientEmail },
          create: { name: clientName || clientEmail, email: clientEmail },
        });

        const quote = await prisma.quote.create({
          data: {
            quoteNumber,
            status: "DRAFT",
            customerId: customer.id,
            customerName: clientName || clientEmail,
            customerEmail: clientEmail,
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
            adminCreatedBy: "system:auto",
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
            message: `Presupuesto DRAFT ${quoteNumber} generado automaticamente.`,
            payload: {
              quoteId: quote.id,
              quoteNumber,
              total: totals.total,
              actorEmail: "system:auto",
            },
          },
        });
      } catch (quoteErr) {
        console.error("[orders] auto-quote creation failed (non-blocking)", quoteErr);
      }
    } else {
      await transitionWorkflowState({
        reference: order.reference,
        to: "PENDIENTE_PAGO",
        actorEmail: clientEmail,
        reason: "Pedido listo para cobro directo.",
      });
    }

    // Send emails (non-blocking)
    const baseUrl = process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net";
    const paymentUrl = `${baseUrl}/area-cliente/pedido/${order.reference}/pagar`;
    const pmEmail = getPmEmails()[0] || "juansilva@traduccionesjuradas.net";

    if (needsInternalReview) {
      const reviewers =
        flowProfile === "LANG_REVIEW"
          ? getCollaboratorEmails()
          : Array.from(new Set([...getAdminEmails(), "hola@traduccionesjuradas.net"]));

      prisma.orderEvent
        .create({
          data: {
            orderId: order.id,
            type: "order.review_routed",
            message: "Pedido enviado a revision interna.",
            payload: {
              flowProfile,
              reviewers,
              pmEmail,
              reason: reviewReason,
            },
          },
        })
        .catch((e) => console.error("[orders] failed to save review_routed event", e));

      sendOrderReviewRoutingEmail({
        reference: order.reference,
        title: body.title,
        amountCents: body.amountCents,
        clientEmail,
        langPair: body.langPair,
        flowProfile,
        reviewers,
        pmEmail,
        urgencyNotes,
        reviewReason,
        quoteId: autoQuoteId || undefined,
      }).catch((e) => console.error("[orders] review routing email failed", e));

      sendOrderUnderReviewClientEmail({
        toEmail: clientEmail,
        clientName,
        reference: order.reference,
        title: body.title,
        amountCents: body.amountCents,
      }).catch((e) => console.error("[orders] client review email failed", e));
    } else {
      sendOrderCreatedEmail({
        toEmail: clientEmail,
        clientName,
        reference: order.reference,
        title: body.title,
        amountCents: body.amountCents,
        paymentUrl,
      }).catch((e) => console.error("[orders] email to client failed", e));

      sendNewOrderStaffEmail({
        reference: order.reference,
        title: body.title,
        amountCents: body.amountCents,
        clientEmail,
        langPair: body.langPair,
      }).catch((e) => console.error("[orders] email to staff failed", e));
    }

    return NextResponse.json({
      ok: true,
      order: { id: order.id, reference: order.reference },
      nextStep: needsInternalReview ? "WAIT_REVIEW" : "PAY_NOW",
      flowProfile,
      acquisitionSource: acquisition.source,
      estimatedAmountCents: body.amountCents,
    });
  } catch (err) {
    console.error("[orders] error creating order", err);
    return NextResponse.json({ ok: false, error: "Error al crear pedido." }, { status: 500 });
  }
}
