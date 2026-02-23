import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFinanceSnapshot } from "@/lib/finance";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  notes?: string;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const actorEmail = staff.email;

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        amountCents: true,
        paymentStatus: true,
        createdAt: true,
        events: { orderBy: { createdAt: "desc" }, take: 40 },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const snapshot = getFinanceSnapshot(order);
    if (snapshot.hasFinanceCloseEvent) {
      return NextResponse.json({ ok: true, alreadyClosed: true });
    }
    if (!snapshot.isFinanciallyCloseable) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se puede cerrar financieramente: revisa conciliación, factura proveedor y margen.",
          warnings: snapshot.warnings,
        },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const closeEvent = await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "finance.closed",
        message: "Pedido cerrado financieramente.",
        payload: {
          notes: body.notes || null,
          actorEmail,
          reconciliationStatus: snapshot.reconciliationStatus,
          supplierInvoiceStatus: snapshot.supplierInvoiceStatus,
          marginCents: snapshot.marginCents,
          marginPct: snapshot.marginPct,
        },
      },
    });

    try {
      await transitionWorkflowState({
        reference: params.reference,
        to: "CERRADO",
        actorEmail,
        reason: "Cierre financiero validado.",
        payload: {
          source: "finance.close",
        },
      });
    } catch (workflowErr: any) {
      await prisma.orderEvent
        .delete({ where: { id: closeEvent.id } })
        .catch(() => undefined);
      return NextResponse.json(
        {
          ok: false,
          error:
            workflowErr?.message ||
            "No se pudo marcar el pedido como CERRADO en workflow.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[finance-close] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error cerrando financieramente." },
      { status: 500 }
    );
  }
}
