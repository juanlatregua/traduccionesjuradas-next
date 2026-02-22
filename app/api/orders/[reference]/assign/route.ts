import { NextResponse } from "next/server";
import { assignOrder } from "@/lib/orders";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type AssignBody = {
  assignedTo?: string | null;
  dueDate?: string | null;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as AssignBody;
    const assignedTo = body.assignedTo?.trim() || null;
    const dueDate = body.dueDate ? new Date(body.dueDate) : null;

    if (dueDate && isNaN(dueDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: "Fecha límite no válida." },
        { status: 400 }
      );
    }

    await assignOrder(params.reference, assignedTo, dueDate);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[orders-assign] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al asignar pedido." },
      { status: 500 }
    );
  }
}
