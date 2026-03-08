import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

export async function GET(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status") || "";
  const paymentStatus = url.searchParams.get("paymentStatus") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  const where: any = {};

  if (search) {
    where.OR = [
      { reference: { contains: search, mode: "insensitive" } },
      { clientEmail: { contains: search, mode: "insensitive" } },
      { clientName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (paymentStatus) {
    where.paymentStatus = paymentStatus;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        reference: true,
        clientEmail: true,
        clientName: true,
        title: true,
        langPair: true,
        amountCents: true,
        currency: true,
        status: true,
        paymentStatus: true,
        deliveryState: true,
        assignedTo: true,
        createdAt: true,
        paidAt: true,
        events: {
          where: { type: "workflow.state_changed" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { payload: true, createdAt: true },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({
    ok: true,
    orders,
    total,
    page,
    pages: Math.ceil(total / PAGE_SIZE),
  });
}
