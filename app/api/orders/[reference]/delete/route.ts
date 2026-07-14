import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type Body = {
  confirmReference?: string;
};

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  const role = getStaffRole(staff.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json(
      { ok: false, error: "Solo ADMIN/PM puede eliminar pedidos definitivamente." },
      { status: 403 }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const confirmReference = String(body.confirmReference || "").trim();
    if (!confirmReference || confirmReference !== params.reference) {
      return NextResponse.json(
        { ok: false, error: "Confirmación inválida para eliminación." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true, reference: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    // Con onDelete SetNull, la ClientInvoice vinculada NO se borra en cascada:
    // los borradores y presupuestos se limpian (no son documentos fiscales);
    // una factura EMITIDA se conserva huérfana a propósito (inmutable).
    await prisma.clientInvoice.deleteMany({
      where: { orderId: order.id, OR: [{ status: "DRAFT" }, { docKind: "quote" }] },
    });
    await prisma.order.delete({
      where: { reference: params.reference },
    });

    console.warn("[orders-delete] order removed", {
      reference: params.reference,
      actorEmail: staff.email,
      role,
      at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[orders-delete] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo eliminar el pedido." },
      { status: 500 }
    );
  }
}

