import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assignOrder, getOrderDetail } from "@/lib/orders";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getWorkflowState } from "@/lib/workflow";
import { findTranslatorProfile } from "@/lib/translators";
import { sendTranslationStartedAssignedEmail } from "@/lib/email";
import { OWN_TRANSLATOR_EMAIL, needsSupplierCost, parseEurToCents, sameTranslatorExact } from "@/lib/cierre-math";
import { sameTranslatorName } from "@/lib/lavori-bridge";
import { netFromGross } from "@/lib/quotes";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type AssignBody = {
  assignedTo?: string | null;
  clear?: boolean;
  dueDate?: string | null;
  // Coste del traductor en € SIN IVA: obligatorio si no es el francés propio y el pedido no tiene coste.
  supplierCostEur?: number | string | null;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const orderBefore = await getOrderDetail(params.reference);
    if (!orderBefore) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as AssignBody;
    const requestedAssignedTo = body.assignedTo?.trim() || null;
    if (!requestedAssignedTo && !body.clear) {
      return NextResponse.json({ ok: false, error: "Escribe el nombre del traductor." }, { status: 400 });
    }
    const translatorProfile = findTranslatorProfile(requestedAssignedTo);
    const assignedTo = requestedAssignedTo
      ? translatorProfile?.fullName || requestedAssignedTo
      : null;
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (dueDate && isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Fecha límite no válida." },
        { status: 400 }
      );
    }

    const rawCost = body.supplierCostEur;
    const supplierCostCents = parseEurToCents(rawCost);
    if (rawCost != null && String(rawCost).trim() && supplierCostCents == null) {
      return NextResponse.json({ ok: false, error: "Coste del traductor no válido (euros sin IVA, p. ej. 45,50)." }, { status: 400 });
    }
    const previousTranslator = orderBefore.assignedTo?.trim() || null;
    const translatorChanged = Boolean(assignedTo && previousTranslator && !sameTranslatorExact(previousTranslator, assignedTo));
    let winningPriceCents: number | null = null;
    if (assignedTo && supplierCostCents == null) {
      const [winning, own] = await Promise.all([
        prisma.collaboratorAssignment.findMany({
          where: { orderId: orderBefore.id, quotedPriceCents: { not: null }, OR: [{ isWinning: true }, { status: { in: ["ACCEPTED", "DELIVERED"] } }] },
          select: { quotedPriceCents: true, collaborator: { select: { fullName: true } } },
        }),
        prisma.collaborator.findUnique({ where: { email: OWN_TRANSLATOR_EMAIL }, select: { fullName: true } }).catch(() => null),
      ]);
      winningPriceCents = winning.find((a) => sameTranslatorName(a.collaborator.fullName, assignedTo))?.quotedPriceCents ?? null;
      if (
        needsSupplierCost({
          translator: assignedTo,
          langPair: orderBefore.langPair,
          supplierCostCents: orderBefore.supplierCostCents,
          winningPriceCents,
          previousTranslator,
          ownNames: own ? [own.fullName] : [],
        })
      ) {
        return NextResponse.json(
          { ok: false, needsCost: true, error: `Indica el coste de ${assignedTo} (€ sin IVA): sin él el pedido queda sin margen conocido.` },
          { status: 400 }
        );
      }
    }

    // Coste nuevo si lo hay; al cambiar de traductor, el precio ganador del nuevo o, sin él
    // (FR propio), se quita el del anterior.
    const costToWrite = !assignedTo
      ? undefined
      : supplierCostCents != null
        ? supplierCostCents
        : translatorChanged
          ? winningPriceCents
          : undefined;
    await assignOrder(params.reference, assignedTo, dueDate, costToWrite);

    const costChanged = supplierCostCents != null && supplierCostCents !== orderBefore.supplierCostCents;
    if (assignedTo && supplierCostCents != null && (costChanged || translatorChanged) && orderBefore.paymentStatus === "PAID") {
      const revenueNetCents = netFromGross(orderBefore.amountCents || 0);
      const marginCents = revenueNetCents - supplierCostCents;
      if (marginCents <= 0) {
        const { alertStaffMargin } = await import("@/lib/ai/outage-alert");
        await alertStaffMargin({ orderId: orderBefore.id, supplier: assignedTo, supplierCostCents, revenueNetCents, marginCents });
      }
    }

    const workflowBefore = getWorkflowState(orderBefore);
    if (assignedTo && orderBefore.paymentStatus === "PAID" && workflowBefore === "PAGO_VALIDADO") {
      await transitionWorkflowState({
        reference: params.reference,
        to: "EN_TRADUCCION",
        actorEmail,
        reason: "Asignacion de traductor y arranque operativo.",
      }).catch((err) => {
        console.error("[orders-assign] workflow transition failed", err);
      });
    }

    const shouldNotifyClient =
      !!assignedTo &&
      orderBefore.paymentStatus === "PAID" &&
      (orderBefore.assignedTo || "") !== assignedTo;

    if (shouldNotifyClient) {
      const assignLang = orderBefore.clientLocale === "fr" ? "fr" : "es";
      await sendTranslationStartedAssignedEmail({
        toEmail: orderBefore.clientEmail,
        reference: orderBefore.reference,
        translatorName: assignedTo!,
        translatorSwornNumber: translatorProfile?.swornNumber || null,
        etaDateLabel: dueDate ? dueDate.toLocaleDateString(assignLang === "fr" ? "fr-FR" : "es-ES") : null,
        lang: assignLang,
      }).catch((err) => {
        console.error("[orders-assign] client assign email failed", err);
      });

      await prisma.orderEvent.create({
        data: {
          orderId: orderBefore.id,
          type: "client.translation_started_notified",
          message: `Cliente notificado: traduccion en proceso asignada a ${assignedTo}.`,
          payload: {
            actorEmail,
            assignedTo,
            swornNumber: translatorProfile?.swornNumber || null,
            dueDate: dueDate ? dueDate.toISOString() : null,
          },
        },
      }).catch((err) => {
        console.error("[orders-assign] notification event failed", err);
      });
      // El SMS "en proceso" lo dispara transitionWorkflowState al cruzar a
      // EN_TRADUCCION (ver arriba) — centralizado para cubrir tambien Kanban.
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[orders-assign] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al asignar pedido." },
      { status: 500 }
    );
  }
}
