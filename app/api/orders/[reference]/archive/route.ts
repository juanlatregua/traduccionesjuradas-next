import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  archived?: boolean;
  reason?: string;
};

function getArchivedState(events: Array<{ type: string }>) {
  const latest = events.find(
    (event) => event.type === "order.archived" || event.type === "order.unarchived"
  );
  if (!latest) return false;
  return latest.type === "order.archived";
}

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const targetArchived = Boolean(body.archived);

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { type: true },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const currentArchived = getArchivedState(order.events);
    if (currentArchived === targetArchived) {
      return NextResponse.json({ ok: true, archived: currentArchived, unchanged: true });
    }

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: targetArchived ? "order.archived" : "order.unarchived",
        message: targetArchived ? "Pedido archivado manualmente." : "Pedido restaurado manualmente.",
        payload: {
          actorEmail: staff.email,
          reason: body.reason || null,
        },
      },
    });

    return NextResponse.json({ ok: true, archived: targetArchived });
  } catch (err: any) {
    console.error("[orders-archive] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo actualizar archivo." },
      { status: 500 }
    );
  }
}

