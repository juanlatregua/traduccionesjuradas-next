// app/api/invoices/[id]/route.ts
// STAFF: leer / editar (solo borrador) / borrar una factura.
//  - Borrador: lo puede borrar cualquier staff (no gastó número fiscal).
//  - Emitida: solo ADMIN/PM (limpieza/pruebas; en producción se anula con rectificativa).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { updateDraftInvoice, deleteInvoice, type InvoiceLine } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

type Body = {
  docKind?: string | null;
  brand?: string | null;
  orderReference?: string | null;
  clientName?: string | null;
  holderNames?: string | null;
  fiscalName?: string;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  email?: string | null;
  concept?: string | null;
  poNumber?: string | null;
  langPair?: string | null;
  vatRate?: number;
  lines?: InvoiceLine[];
};

export async function GET(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: params.id },
    include: { order: { select: { reference: true } } },
  });
  if (!invoice) return NextResponse.json({ ok: false, error: "Factura no encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true, invoice });
}

export async function PATCH(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* opcional */
  }

  // Re-vincular pedido si se pasa una referencia (opcional).
  let orderId: string | null | undefined = undefined;
  if (body.orderReference !== undefined) {
    const ref = String(body.orderReference || "").trim();
    if (!ref) {
      orderId = null;
    } else {
      const order = await prisma.order.findUnique({
        where: { reference: ref },
        select: { id: true, clientInvoice: { select: { id: true, number: true } } },
      });
      if (!order) return NextResponse.json({ ok: false, error: "El pedido indicado no existe." }, { status: 400 });
      if (order.clientInvoice && order.clientInvoice.id !== params.id) {
        return NextResponse.json(
          { ok: false, error: `Ese pedido ya tiene una factura (${order.clientInvoice.number || "borrador"}).` },
          { status: 400 }
        );
      }
      orderId = order.id;
    }
  }

  try {
    const invoice = await updateDraftInvoice(params.id, {
      docKind: body.docKind,
      brand: body.brand,
      orderId,
      clientName: body.clientName,
      holderNames: body.holderNames,
      fiscalName: String(body.fiscalName || ""),
      nif: body.nif,
      address: body.address,
      city: body.city,
      postalCode: body.postalCode,
      country: body.country,
      email: body.email,
      concept: body.concept,
      poNumber: body.poNumber,
      langPair: body.langPair,
      vatRate: body.vatRate ?? 0.21,
      lines: body.lines || [],
    });
    return NextResponse.json({ ok: true, invoice });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo actualizar." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const invoice = await prisma.clientInvoice.findUnique({
    where: { id: params.id },
    select: { id: true, status: true, number: true },
  });
  if (!invoice) return NextResponse.json({ ok: false, error: "Factura no encontrada." }, { status: 404 });

  // Rol COLLABORATOR (traductor externo) nunca borra facturas, ni siquiera
  // borradores; antes solo se gateaba el borrado de ISSUED. (audit seguridad 25-jun)
  const role = getStaffRole(access.email);
  if (role === "COLLABORATOR" || role === null) {
    return NextResponse.json({ ok: false, error: "No autorizado para borrar facturas." }, { status: 403 });
  }
  if (invoice.status === "ISSUED" && role !== "ADMIN" && role !== "PM") {
    return NextResponse.json(
      { ok: false, error: "Solo ADMIN/PM puede borrar una factura emitida." },
      { status: 403 }
    );
  }

  try {
    await deleteInvoice(params.id);
    console.warn("[invoice-delete] removed", {
      id: params.id,
      number: invoice.number,
      status: invoice.status,
      actorEmail: access.email,
      at: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo borrar." }, { status: 400 });
  }
}
