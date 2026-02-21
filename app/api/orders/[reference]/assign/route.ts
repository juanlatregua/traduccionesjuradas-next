import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { assignOrder } from "@/lib/orders";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type AssignBody = {
  assignedTo?: string | null;
  dueDate?: string | null;
};

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Acceso denegado." }, { status: 403 });
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
