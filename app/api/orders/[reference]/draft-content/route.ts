import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function PATCH(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.draftContentJson !== "string") {
      return NextResponse.json(
        { ok: false, error: "draftContentJson requerido como string." },
        { status: 400 }
      );
    }

    // Validate it's valid JSON
    try {
      JSON.parse(body.draftContentJson);
    } catch {
      return NextResponse.json(
        { ok: false, error: "draftContentJson no es JSON válido." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    await prisma.order.update({
      where: { reference: params.reference },
      data: { draftContentJson: body.draftContentJson },
    });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "draft.edited",
        message: "Borrador editado por traductor.",
        payload: { actorEmail: staff.email },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[draft-content] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al guardar borrador." },
      { status: 500 }
    );
  }
}
