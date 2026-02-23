import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendProjectManagerFinanceUpdateEmail } from "@/lib/email";
import { getFinanceSnapshot } from "@/lib/finance";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type InvoiceStatus = "PENDING_REQUEST" | "RECEIVED" | "VALIDATED" | "PAID";
type BillingMode = "PER_ORDER" | "MONTHLY_BATCH";
type SupplierType = "AUTONOMO" | "EMPRESA" | "UNKNOWN";

type Body = {
  status?: InvoiceStatus;
  billingMode?: BillingMode;
  supplierType?: SupplierType;
  supplierName?: string;
  supplierNif?: string;
  invoiceNumber?: string;
  baseCents?: number;
  taxCents?: number;
  irpfRetentionPct?: number;
  totalCents?: number;
  dueDate?: string;
  paidAt?: string;
  pdfUrl?: string;
  notes?: string;
};

function safeStatus(raw: unknown): InvoiceStatus {
  const s = String(raw || "").toUpperCase();
  if (s === "RECEIVED" || s === "VALIDATED" || s === "PAID") return s;
  return "PENDING_REQUEST";
}

function safeBillingMode(raw: unknown): BillingMode {
  const s = String(raw || "").toUpperCase();
  return s === "MONTHLY_BATCH" ? "MONTHLY_BATCH" : "PER_ORDER";
}

function safeSupplierType(raw: unknown): SupplierType {
  const s = String(raw || "").toUpperCase();
  if (s === "AUTONOMO" || s === "EMPRESA") return s;
  return "UNKNOWN";
}

function centsOrNull(raw: unknown) {
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function pctOrNull(raw: unknown) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(30, Math.max(0, Number(n.toFixed(2))));
}

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
        clientEmail: true,
        events: { orderBy: { createdAt: "desc" }, take: 30 },
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as Body;
    const status = safeStatus(body.status);
    const latestInvoiceEvent = order.events.find((e) => e.type === "finance.supplier_invoice.updated");
    const prevPayload = (latestInvoiceEvent?.payload as any) || {};
    const prevStatus = String(prevPayload?.status || "").toUpperCase();

    if (status === "PAID" && prevStatus !== "VALIDATED" && prevStatus !== "PAID") {
      return NextResponse.json(
        { ok: false, error: "No se puede marcar como pagada sin estado VALIDATED previo." },
        { status: 400 }
      );
    }

    const billingMode = safeBillingMode(body.billingMode || prevPayload?.billingMode);
    const supplierType = safeSupplierType(body.supplierType || prevPayload?.supplierType);
    if (status !== "PENDING_REQUEST" && supplierType === "UNKNOWN") {
      return NextResponse.json(
        { ok: false, error: "Indica tipo de proveedor (AUTONOMO o EMPRESA)." },
        { status: 400 }
      );
    }

    const baseCents = centsOrNull(body.baseCents);
    const taxCents = centsOrNull(body.taxCents);
    const totalCents = centsOrNull(body.totalCents);
    const irpfRetentionPct =
      supplierType === "EMPRESA"
        ? 0
        : supplierType === "AUTONOMO"
          ? pctOrNull(body.irpfRetentionPct ?? prevPayload?.irpfRetentionPct) ?? 15
          : null;
    const irpfRetentionCents =
      baseCents !== null && irpfRetentionPct !== null
        ? Math.round((baseCents * irpfRetentionPct) / 100)
        : null;
    const calculatedTotalCents =
      baseCents !== null
        ? baseCents + (taxCents || 0) - (irpfRetentionCents || 0)
        : null;
    const totalDiffCents =
      totalCents !== null && calculatedTotalCents !== null
        ? totalCents - calculatedTotalCents
        : null;

    const payload = {
      status,
      billingMode,
      supplierType,
      supplierName: body.supplierName || null,
      supplierNif: body.supplierNif || null,
      invoiceNumber: body.invoiceNumber || null,
      baseCents,
      taxCents,
      irpfRetentionPct,
      irpfRetentionCents,
      totalCents,
      calculatedTotalCents,
      totalDiffCents,
      dueDate: body.dueDate || null,
      paidAt: body.paidAt || null,
      pdfUrl: body.pdfUrl || null,
      notes: body.notes || null,
      actorEmail,
    };

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "finance.supplier_invoice.updated",
        message: `Factura proveedor actualizada a estado ${status} (${billingMode === "MONTHLY_BATCH" ? "lote mensual" : "por pedido"}).`,
        payload,
      },
    });

    if (status === "PAID" && prevStatus !== "PAID") {
      try {
        await sendProjectManagerFinanceUpdateEmail({
          reference: order.reference,
          clientEmail: order.clientEmail,
          supplierName: payload.supplierName,
          supplierType: payload.supplierType,
          billingMode: payload.billingMode,
          invoiceNumber: payload.invoiceNumber,
          totalCents: payload.totalCents,
        });
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: "finance.pm_notified",
            message: "Project Manager notificado tras pago a proveedor.",
            payload: {
              actorEmail,
              notifiedTo: process.env.PM_NOTIFICATION_TO || process.env.PRESUPUESTO_TO || null,
            },
          },
        });
      } catch (notifyErr: any) {
        console.error("[finance-supplier-invoice] pm notify failed", notifyErr);
        await prisma.orderEvent
          .create({
            data: {
              orderId: order.id,
              type: "finance.pm_notification_failed",
              message: "Fallo al notificar al Project Manager tras pago a proveedor.",
              payload: {
                actorEmail,
                error: String(notifyErr?.message || notifyErr || "unknown"),
              },
            },
          })
          .catch(() => undefined);
      }

      const latestOrder = await prisma.order.findUnique({
        where: { reference: params.reference },
        select: {
          id: true,
          amountCents: true,
          paymentStatus: true,
          createdAt: true,
          events: { orderBy: { createdAt: "desc" }, take: 50 },
        },
      });
      if (latestOrder) {
        const snapshot = getFinanceSnapshot(latestOrder);
        if (snapshot.isFinanciallyCloseable && !snapshot.hasFinanceCloseEvent) {
          const closeEvent = await prisma.orderEvent.create({
            data: {
              orderId: latestOrder.id,
              type: "finance.closed",
              message: "Pedido cerrado financieramente de forma automatica tras pago a proveedor.",
              payload: {
                actorEmail,
                auto: true,
                trigger: "supplier_invoice_paid",
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
              reason: "Cierre financiero automatico tras pago a proveedor.",
              payload: {
                source: "supplier_invoice_paid",
              },
            });
          } catch (err) {
            await prisma.orderEvent.delete({ where: { id: closeEvent.id } }).catch(() => undefined);
            console.error("[finance-supplier-invoice] workflow close transition failed", err);
          }
        }
      }
    }

    return NextResponse.json({
      ok: true,
      supplierInvoiceStatus: status,
      billingMode,
      supplierType,
      irpfRetentionPct,
      totalDiffCents,
    });
  } catch (err: any) {
    console.error("[finance-supplier-invoice] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error actualizando factura proveedor." },
      { status: 500 }
    );
  }
}
