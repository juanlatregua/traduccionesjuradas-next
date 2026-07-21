import { prisma } from "@/lib/prisma";
import { getSourceDocumentsFromEvents } from "@/lib/order-source-documents";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  customerPriceFromSupplierCost,
  netFromGross,
  DEFAULT_COLLABORATOR_MARGIN_PCT,
} from "@/lib/quotes";

type PrismaTxClient = PrismaClient | Prisma.TransactionClient;

export async function getActiveCollaborators() {
  return prisma.collaborator.findMany({
    where: { active: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getCollaboratorsByLanguage(lang: string) {
  return prisma.collaborator.findMany({
    where: {
      active: true,
      languages: { has: lang.toLowerCase() },
    },
    orderBy: { fullName: "asc" },
  });
}

export async function getAssignmentByToken(token: string) {
  return prisma.collaboratorAssignment.findUnique({
    where: { accessToken: token },
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          title: true,
          langPair: true,
          clientEmail: true,
          clientName: true,
          amountCents: true,
          events: {
            where: {
              type: {
                in: [
                  "presupuesto.submitted",
                  "order.source_document_uploaded",
                ],
              },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
      collaborator: {
        select: {
          id: true,
          fullName: true,
          email: true,
          supplierType: true,
          companyName: true,
        },
      },
    },
  });
}

export async function createAssignment(
  orderId: string,
  collaboratorId: string,
  adminNotes?: string
) {
  return prisma.collaboratorAssignment.create({
    data: {
      orderId,
      collaboratorId,
      adminNotes: adminNotes || null,
    },
    include: {
      collaborator: true,
      order: {
        select: {
          reference: true,
          title: true,
          langPair: true,
        },
      },
    },
  });
}

export async function submitCollaboratorQuote(
  token: string,
  priceCents: number,
  deadline: Date,
  notes?: string
) {
  return prisma.collaboratorAssignment.update({
    where: { accessToken: token, status: { in: ["REQUESTED", "QUOTE_REVISION_REQUESTED"] } },
    data: {
      status: "QUOTED",
      quotedPriceCents: priceCents,
      quotedDeadline: deadline,
      quotedAt: new Date(),
      collaboratorNotes: notes || null,
    },
    include: {
      collaborator: { select: { fullName: true, email: true } },
      order: { select: { reference: true, title: true } },
    },
  });
}

export async function requestQuoteRevision(assignmentId: string, reason?: string) {
  return prisma.collaboratorAssignment.update({
    where: { id: assignmentId, status: "QUOTED" },
    data: {
      status: "QUOTE_REVISION_REQUESTED",
      revisionReason: reason || null,
    },
    include: {
      collaborator: { select: { fullName: true, email: true } },
      order: { select: { id: true, reference: true, title: true } },
    },
  });
}

export async function acceptCollaboratorQuote(assignmentId: string) {
  return prisma.collaboratorAssignment.update({
    where: { id: assignmentId, status: "QUOTED" },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      isWinning: true,
    },
    include: {
      collaborator: {
        select: {
          fullName: true,
          email: true,
          supplierType: true,
          companyName: true,
        },
      },
      order: {
        select: {
          id: true,
          reference: true,
          title: true,
          amountCents: true,
          paymentStatus: true,
          marginPct: true,
          dueDate: true,
          langPair: true,
        },
      },
    },
  });
}

export async function rejectCollaboratorQuote(
  assignmentId: string,
  reason?: string
) {
  return prisma.collaboratorAssignment.update({
    where: { id: assignmentId, status: "QUOTED" },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason || null,
    },
    include: {
      collaborator: { select: { fullName: true, email: true } },
      order: { select: { id: true, reference: true } },
    },
  });
}

export async function submitCollaboratorDelivery(
  token: string,
  fileUrl: string,
  fileKey: string,
  filename: string,
  mimeType: string
) {
  return prisma.collaboratorAssignment.update({
    where: { accessToken: token, status: "ACCEPTED" },
    data: {
      status: "DELIVERED",
      deliveredFileUrl: fileUrl,
      deliveredFileKey: fileKey,
      deliveredFilename: filename,
      deliveredMimeType: mimeType,
      deliveredAt: new Date(),
    },
    include: {
      collaborator: { select: { fullName: true, email: true } },
      order: { select: { reference: true, title: true } },
    },
  });
}

// Side-effects financieros tras aceptar un presupuesto de colaborador.
// Factorizado para que el `accept` directo y la selección competitiva
// (select-bid) generen EXACTAMENTE los mismos OrderEvent y el mismo cálculo
// de precio sin duplicarlo. El colaborador cotiza SIN IVA (supplierCostCents);
// el precio al cliente se deriva con margen + IVA (Fase 1).
export async function applyAcceptedQuoteSideEffects(
  db: PrismaTxClient,
  params: {
    order: {
      id: string;
      amountCents: number;
      paymentStatus: string | null;
      marginPct: number | null;
    };
    assignmentId: string;
    supplierCostCents: number;
    quotedDeadline?: Date | string | null;
    collaborator: {
      fullName: string;
      companyName: string | null;
      supplierType: string;
    };
    actorEmail: string | null;
    isWinning?: boolean;
  }
) {
  const { order, assignmentId, supplierCostCents, quotedDeadline, collaborator, actorEmail } = params;
  const marginPct = order.marginPct ?? DEFAULT_COLLABORATOR_MARGIN_PCT;
  const alreadyCharged = order.paymentStatus === "PAID";

  // Flujo competitivo (aún sin cobrar): el precio al cliente se deriva del coste.
  // Pedido ya pagado (flujo antiguo): se respeta el importe cobrado, solo se registra el coste.
  const customerPriceCents = alreadyCharged
    ? order.amountCents
    : customerPriceFromSupplierCost(supplierCostCents, marginPct);

  // Acceptance audit event
  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "collaborator.quote.accepted",
      message: `Presupuesto de ${collaborator.fullName} aceptado: ${(supplierCostCents / 100).toFixed(2)}€.`,
      payload: {
        assignmentId,
        priceCents: supplierCostCents,
        actorEmail,
        isWinning: params.isWinning ?? false,
      },
    },
  });

  // Precio al cliente, coste y plazo (Fase 1)
  await db.order.update({
    where: { id: order.id },
    data: {
      supplierCostCents,
      marginPct,
      ...(alreadyCharged ? {} : { amountCents: customerPriceCents }),
      ...(quotedDeadline ? { dueDate: new Date(quotedDeadline) } : {}),
    },
  });

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "order.pricing.calculated",
      message: `Precio cliente ${(customerPriceCents / 100).toFixed(2)}€ = coste ${(supplierCostCents / 100).toFixed(2)}€ × (1+${marginPct}%) + IVA${alreadyCharged ? " · pedido ya pagado, importe no modificado" : ""}.`,
      payload: {
        supplierCostCents,
        marginPct,
        customerPriceCents,
        alreadyCharged,
        dueDate: quotedDeadline ? new Date(quotedDeadline).toISOString() : null,
        actorEmail,
      },
    },
  });

  // Finance integration: create supplier invoice event (coste sin IVA)
  const supplierName = collaborator.companyName || collaborator.fullName;
  const isAutonomo = collaborator.supplierType === "AUTONOMO";

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "finance.supplier_invoice.updated",
      message: `Factura proveedor auto-generada: ${supplierName} - ${(supplierCostCents / 100).toFixed(2)}€.`,
      payload: {
        supplierName,
        supplierType: collaborator.supplierType,
        totalCents: supplierCostCents,
        status: "PENDING_REQUEST",
        irpfRetentionPct: isAutonomo ? 15 : 0,
      },
    },
  });

  // DEVENGO del traductor (cuenta corriente por colaborador): el coste entra
  // como apunte interno pendiente de factura (isAccrual) — fuera de libro/303/
  // gestoría hasta que se registre la factura real del colaborador (mensual o
  // puntual) desde Contabilidad → Proveedores. Idempotente por enc:<assignmentId>.
  const expenseMarker = `enc:${assignmentId}`;
  const existingExpense = await db.expense.findFirst({ where: { supplierInvoiceNumber: expenseMarker }, select: { id: true } });
  if (!existingExpense && supplierCostCents > 0) {
    const assignmentCtx = await db.collaboratorAssignment.findUnique({
      where: { id: assignmentId },
      select: { collaboratorId: true, order: { select: { reference: true } } },
    });
    // Sin colaborador resoluble no hay cuenta donde liquidar el devengo: se crea
    // como gasto normal (comportamiento anterior) para no perder el coste del libro.
    const accrual = !!assignmentCtx?.collaboratorId;
    await db.expense.create({
      data: {
        date: new Date(),
        brand: "traduccionesjuradas",
        supplier: supplierName,
        supplierInvoiceNumber: expenseMarker,
        concept: `Traducción colaborador · ${supplierName}`,
        category: "colaborador",
        baseCents: supplierCostCents,
        vatRate: 0,
        vatCents: 0,
        ivaDeducible: true,
        irpfRetentionPct: 0,
        irpfCents: 0,
        totalCents: supplierCostCents,
        payableCents: supplierCostCents,
        paymentStatus: "PENDING",
        isAccrual: accrual,
        collaboratorId: assignmentCtx?.collaboratorId ?? null,
        orderReference: assignmentCtx?.order.reference ?? null,
        notes: accrual
          ? "Devengo auto-generado al adjudicar. Se liquida al registrar la factura del colaborador."
          : "Auto-generado al adjudicar (sin ficha de colaborador). Revisa IVA/IRPF con la factura real.",
      },
    });
  }

  // Snapshot de margen — comparar SIEMPRE neto de IVA (ingreso sin IVA vs coste sin IVA).
  // El IVA es repercutido (no es margen).
  const revenueNetCents = netFromGross(customerPriceCents);
  const marginCents = revenueNetCents - supplierCostCents;
  if (marginCents < 0) {
    console.warn(
      `[MARGEN NEGATIVO] Assignment ${assignmentId}: coste ${supplierCostCents}¢ > ingreso neto ${revenueNetCents}¢`
    );
  }

  await db.orderEvent.create({
    data: {
      orderId: order.id,
      type: "finance.margin.snapshot",
      message: `Snapshot de margen: ingreso neto ${(revenueNetCents / 100).toFixed(2)}€ − coste ${(supplierCostCents / 100).toFixed(2)}€ = ${(marginCents / 100).toFixed(2)}€.`,
      payload: {
        supplierCostCents,
        revenueCents: revenueNetCents,
        grossRevenueCents: customerPriceCents,
        marginCents,
        marginBasis: "net_of_vat",
      },
    },
  });
}

export function getDocumentsFromOrder(order: {
  events: Array<{ type: string; payload: unknown }>;
}) {
  return getSourceDocumentsFromEvents(order.events)
    .filter((d) => d.url)
    .map((d) => ({
      name: d.name,
      url: String(d.url),
      type: d.type || "application/octet-stream",
    }));
}

