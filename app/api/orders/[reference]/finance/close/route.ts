import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { prisma } from "@/lib/prisma";
import { getFinanceSnapshot } from "@/lib/finance";
import { transitionWorkflowState } from "@/lib/workflow-server";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  notes?: string;
};

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Acceso denegado." }, { status: 403 });
  }

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
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "finance.closed",
        message: "Pedido cerrado financieramente.",
        payload: {
          notes: body.notes || null,
          actorEmail: session.user.email,
          reconciliationStatus: snapshot.reconciliationStatus,
          supplierInvoiceStatus: snapshot.supplierInvoiceStatus,
          marginCents: snapshot.marginCents,
          marginPct: snapshot.marginPct,
        },
      },
    });

    await transitionWorkflowState({
      reference: params.reference,
      to: "CERRADO",
      actorEmail: session.user.email,
      reason: "Cierre financiero validado.",
      payload: {
        source: "finance.close",
      },
    }).catch((err) => {
      console.error("[finance-close] workflow transition failed", err);
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[finance-close] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error cerrando financieramente." },
      { status: 500 }
    );
  }
}
