import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [totalOrders, pendingPayment, inProgress, revenueThisMonth, revenueLastMonth, revenueYTD] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { paymentStatus: "PENDING" } }),
      prisma.order.count({ where: { status: "IN_PROGRESS" } }),
      prisma.order.aggregate({
        where: { paymentStatus: "PAID", paidAt: { gte: startOfMonth } },
        _sum: { amountCents: true },
      }),
      prisma.order.aggregate({
        where: {
          paymentStatus: "PAID",
          paidAt: { gte: startOfLastMonth, lt: startOfMonth },
        },
        _sum: { amountCents: true },
      }),
      prisma.order.aggregate({
        where: { paymentStatus: "PAID", paidAt: { gte: startOfYear } },
        _sum: { amountCents: true },
      }),
    ]);

  return NextResponse.json({
    ok: true,
    totalOrders,
    pendingPayment,
    inProgress,
    revenueThisMonth: revenueThisMonth._sum.amountCents || 0,
    revenueLastMonth: revenueLastMonth._sum.amountCents || 0,
    revenueYTD: revenueYTD._sum.amountCents || 0,
  });
}
