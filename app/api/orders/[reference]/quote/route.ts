import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getWorkflowState } from "@/lib/workflow";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { sendOrderCreatedEmail } from "@/lib/email";
import { netFromGross } from "@/lib/quotes";
import { isFrenchPair } from "@/lib/workflow";
import { notifyMarginOverride, MARGIN_BLOCK_CODE } from "@/lib/quote-margin";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type QuoteLineInput = {
  documentName?: string;
  amountCents?: number;
  notes?: string;
};

type Body = {
  lines?: QuoteLineInput[];
  sendToClient?: boolean;
  overrideLowMargin?: boolean;
  quotePreviewFileKey?: string | null;
  quotePreviewFileUrl?: string | null;
};

type NormalizedLine = {
  documentName: string;
  amountCents: number;
  notes: string | null;
};

const SEND_ALLOWED_STATES = new Set([
  "BORRADOR",
  "PENDIENTE_REVISION",
  "PRESUPUESTO_ENVIADO",
  "PENDIENTE_PAGO",
  "JUSTIFICANTE_SUBIDO",
]);

function normalizeLines(lines: QuoteLineInput[] | undefined) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false as const, error: "Debes añadir al menos una linea de coste." };
  }

  const normalized: NormalizedLine[] = [];

  for (const rawLine of lines) {
    const documentName = String(rawLine?.documentName || "").trim();
    const amountCentsRaw = Number(rawLine?.amountCents);
    const notes = String(rawLine?.notes || "").trim();

    if (!documentName) {
      return { ok: false as const, error: "Cada linea debe tener nombre de documento." };
    }

    if (!Number.isFinite(amountCentsRaw) || amountCentsRaw < 0) {
      return { ok: false as const, error: "Importe invalido en una de las lineas." };
    }

    normalized.push({
      documentName,
      amountCents: Math.round(amountCentsRaw),
      notes: notes || null,
    });
  }

  return { ok: true as const, lines: normalized };
}

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const body = (await req.json()) as Body;
    const parsed = normalizeLines(body.lines);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
    }

    const lines = parsed.lines;
    const totalCents = lines.reduce((acc, line) => acc + line.amountCents, 0);
    if (totalCents < 100) {
      return NextResponse.json(
        { ok: false, error: "El total del presupuesto debe ser al menos 1 EUR." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        title: true,
        clientEmail: true,
        clientName: true,
        clientLocale: true,
        amountCents: true,
        paymentStatus: true,
        deliveryState: true,
        langPair: true,
        supplierCostCents: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 80,
          select: {
            type: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    // FRENO DE MARGEN contra el coste YA COMPROMETIDO (auditoría 31-ago): para
    // cuando se reajusta aquí el precio, el puente de lavori o una adjudicación
    // pueden haber fijado supplierCostCents. Bajar el precio por debajo de ese
    // coste y enviarlo cobraría en pérdidas sin que saltara nada. Francés exento
    // (Juan es el traductor). Se compara neto contra neto.
    const committedCost = order.supplierCostCents ?? 0;
    const marginVsCommitted = committedCost > 0 ? netFromGross(totalCents) - committedCost : null;
    // El gate aplica a CUALQUIER guardado, no solo al reenvío: el update de
    // amountCents es inmediato y el enlace de pago firmado ya en manos del
    // cliente cobra el importe VIVO — guardar ya es repreciar.
    if (
      marginVsCommitted != null &&
      marginVsCommitted <= 0 &&
      !isFrenchPair(order.langPair) &&
      !body.overrideLowMargin
    ) {
      const eur = (c: number) => `${(c / 100).toFixed(2)} €`;
      return NextResponse.json(
        {
          ok: false,
          code: MARGIN_BLOCK_CODE,
          error: `${MARGIN_BLOCK_CODE}: el traductor ya tiene comprometidos ${eur(committedCost)} y este total deja ${eur(marginVsCommitted)} de margen neto.`,
        },
        { status: 409 }
      );
    }

    let workflowState = getWorkflowState(order);
    if (body.sendToClient && !SEND_ALLOWED_STATES.has(workflowState)) {
      return NextResponse.json(
        {
          ok: false,
          error: `No se puede enviar presupuesto en estado ${workflowState}.`,
        },
        { status: 400 }
      );
    }

    await prisma.order.update({
      where: { reference: params.reference },
      data: {
        amountCents: totalCents,
        quoteSnapshotJson: {
          lines,
          totalCents,
          currency: "EUR",
          updatedAt: new Date().toISOString(),
          terms:
            "Presupuesto para traduccion jurada. Incluye revision y gestion administrativa segun encargo.",
        },
        quotePreviewFileKey: body.quotePreviewFileKey
          ? String(body.quotePreviewFileKey).trim()
          : undefined,
        quotePreviewFileUrl: body.quotePreviewFileUrl
          ? String(body.quotePreviewFileUrl).trim()
          : undefined,
      },
    });

    // El snapshot de margen se refresca con el importe NUEVO: sin esto, el panel
    // seguiría enseñando el margen bueno calculado con el importe antiguo.
    if (committedCost > 0) {
      // netFromGross asume el IVA por defecto (21%): en un pedido exento
      // (extra-UE) el neto se infravalora y el freno es MAS conservador de lo
      // necesario — preferible a lo contrario; Order no guarda su IVA.
      const revenueNetCents = netFromGross(totalCents);
      const marginCents = revenueNetCents - committedCost;
      // El snapshot nuevo ARRASTRA los costes manuales del anterior
      // (gatewayFeeCents/otherCostCents/marginPct): getMargin lee SOLO el
      // último snapshot con default 0 — sin esto, guardar aquí borraría la
      // comisión de pasarela registrada a mano.
      const prevSnap = await prisma.orderEvent.findFirst({
        where: { orderId: order.id, type: "finance.margin.snapshot" },
        orderBy: { createdAt: "desc" },
        select: { payload: true },
      });
      const prev = (prevSnap?.payload ?? {}) as Record<string, unknown>;
      const carried: Record<string, unknown> = {};
      for (const k of ["gatewayFeeCents", "otherCostCents", "marginPct"]) {
        if (prev[k] != null) carried[k] = prev[k];
      }
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "finance.margin.snapshot",
          message: `Snapshot de margen (precio reajustado): ingreso neto ${(revenueNetCents / 100).toFixed(2)}€ − coste ${(committedCost / 100).toFixed(2)}€ = ${(marginCents / 100).toFixed(2)}€.`,
          payload: {
            ...carried,
            supplierCostCents: committedCost,
            revenueCents: revenueNetCents,
            grossRevenueCents: totalCents,
            marginCents,
            marginBasis: "net_of_vat",
          },
        },
      });
      if (marginCents <= 0 && body.overrideLowMargin) {
        await notifyMarginOverride({
          kind: "pedido",
          action: body.sendToClient ? "enviado" : "guardado",
          label: order.reference,
          actorEmail,
          detail: `precio nuevo ${(revenueNetCents / 100).toFixed(2)} € netos − coste comprometido ${(committedCost / 100).toFixed(2)} € = ${(marginCents / 100).toFixed(2)} €`,
          url: `https://www.traduccionesjuradas.net/zona-traductor/pedido/${order.reference}`,
        });
      }
    }

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "quote.documents.updated",
        message: "Costes por documento actualizados para presupuesto final.",
        payload: {
          lines,
          totalCents,
          currency: "EUR",
          actorEmail,
          sendToClient: Boolean(body.sendToClient),
        },
      },
    });

    let emailWarning: string | null = null;

    if (body.sendToClient) {
      if (workflowState === "BORRADOR") {
        await transitionWorkflowState({
          reference: params.reference,
          to: "PENDIENTE_REVISION",
          actorEmail,
          reason: "Preparando envio de presupuesto final.",
        });
        workflowState = "PENDIENTE_REVISION";
      }

      if (workflowState === "PENDIENTE_REVISION") {
        await transitionWorkflowState({
          reference: params.reference,
          to: "PRESUPUESTO_ENVIADO",
          actorEmail,
          reason: "Presupuesto final enviado al cliente.",
        });
        workflowState = "PRESUPUESTO_ENVIADO";
      }

      if (workflowState === "PRESUPUESTO_ENVIADO") {
        await transitionWorkflowState({
          reference: params.reference,
          to: "PENDIENTE_PAGO",
          actorEmail,
          reason: "Presupuesto enviado, se habilita pago.",
        });
        workflowState = "PENDIENTE_PAGO";
      }

      if (!["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO"].includes(workflowState)) {
        return NextResponse.json(
          {
            ok: false,
            error: `No se puede enviar presupuesto en estado ${workflowState}.`,
          },
          { status: 400 }
        );
      }

      const { buildSignedOrderUrl } = await import("@/lib/order-token");
      const paymentUrl = buildSignedOrderUrl(order.reference, "pagar");

      try {
        const emailResult = await sendOrderCreatedEmail({
          toEmail: order.clientEmail,
          clientName: order.clientName || undefined,
          reference: order.reference,
          title: order.title,
          amountCents: totalCents,
          paymentUrl,
          lang: order.clientLocale === "fr" ? "fr" : "es",
        });
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "quote.sent_to_client",
            message: "Presupuesto final enviado al cliente con enlace de pago.",
            payload: {
              actorEmail,
              totalCents,
              lines,
              toEmail: order.clientEmail,
              subject: emailResult.subject,
              paymentUrl,
              sentAt: new Date().toISOString(),
              provider: "graph",
              providerMessageId: emailResult.messageId,
            },
          },
        });
        // SMS notification (fire & forget)
        const { getOrderPhone, sendNotification, formatPhoneSpain } = await import("@/lib/sms");
        const { smsPresupuestoListo } = await import("@/lib/sms-templates");
        const phone = await getOrderPhone(order.id).catch(() => null);
        if (phone) {
          sendNotification({
            to: formatPhoneSpain(phone),
            body: smsPresupuestoListo({
              ref: order.reference,
              precio: (totalCents / 100).toFixed(2),
              url: paymentUrl,
            }),
          }).catch((err) => console.error("[SMS]", err));
        }
      } catch (sendErr: any) {
        emailWarning = "Presupuesto guardado, pero fallo el email al cliente.";
        await prisma.orderEvent
          .create({
            data: {
              orderId: order.id,
              type: "quote.send_failed",
              message: "Fallo al enviar presupuesto final al cliente.",
              payload: {
                actorEmail,
                error: String(sendErr?.message || sendErr || "unknown"),
                totalCents,
                lines,
                toEmail: order.clientEmail,
                paymentUrl,
                failedAt: new Date().toISOString(),
              },
            },
          })
          .catch(() => undefined);
      }
    }

    return NextResponse.json({
      ok: true,
      totalCents,
      workflowState,
      sentToClient: Boolean(body.sendToClient),
      warning: emailWarning,
    });
  } catch (err: any) {
    console.error("[orders-quote] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo guardar el presupuesto." },
      { status: 500 }
    );
  }
}
