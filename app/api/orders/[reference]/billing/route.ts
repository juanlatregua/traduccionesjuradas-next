// app/api/orders/[reference]/billing/route.ts
//
// Alta/edición de los datos fiscales (BillingData) de un pedido desde la
// contabilidad: permite rellenar NIF + nombre fiscal (+ dirección) para poder
// emitir una factura COMPLETA. Upsert 1:1 por orderId.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const role = getStaffRole(staff.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json({ ok: false, error: "Solo ADMIN/PM puede editar datos fiscales." }, { status: 403 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true, clientEmail: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const b = await req.json().catch(() => ({}));
    const fiscalName = String(b?.fiscalName || "").trim();
    const nif = String(b?.nif || "").trim();
    if (!fiscalName || !nif) {
      return NextResponse.json(
        { ok: false, error: "El nombre fiscal y el NIF son obligatorios." },
        { status: 400 }
      );
    }

    // address/city/postalCode son requeridos por el modelo; si no se rellenan se
    // guardan como "-" (suficiente para una completa básica; el cliente puede
    // ampliarlos). El email NO se sobrescribe en update (se conserva el existente).
    const editable = {
      fiscalName,
      nif,
      address: String(b?.address || "").trim() || "-",
      city: String(b?.city || "").trim() || "-",
      postalCode: String(b?.postalCode || "").trim() || "-",
      country: String(b?.country || "").trim() || "España",
    };

    await prisma.billingData.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, ...editable, email: order.clientEmail || "-" },
      update: editable,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[order billing] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al guardar los datos fiscales." },
      { status: 500 }
    );
  }
}
