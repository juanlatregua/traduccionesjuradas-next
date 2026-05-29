// app/api/orders/[reference]/invoice/issue/route.ts
// STAFF: emite o edita la factura de un pedido con número AA_NNN (auto o manual)
// y datos fiscales (del pedido o introducidos a mano). Visualizable/editable
// desde la zona-traductor.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { issueOrUpdateInvoice, suggestNextInvoiceNumber } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

async function loadOrder(reference: string) {
  return prisma.order.findUnique({
    where: { reference },
    select: {
      id: true,
      amountCents: true,
      clientEmail: true,
      clientName: true,
      billing: true,
      clientInvoice: true,
    },
  });
}

// GET: estado actual (factura emitida si la hay) + número sugerido para prefill.
export async function GET(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const order = await loadOrder(params.reference);
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const suggested = await suggestNextInvoiceNumber();
  return NextResponse.json({
    ok: true,
    invoice: order.clientInvoice,
    suggested,
    billing: order.billing,
    amountCents: order.amountCents,
  });
}

// POST: emitir/editar. body: { number?, fiscalName?, nif?, address?, city?, postalCode?, country?, email? }
export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }

  const order = await loadOrder(params.reference);
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const b = order.billing;
  const billing = {
    fiscalName: String(body.fiscalName || b?.fiscalName || order.clientName || "").trim(),
    nif: String(body.nif || b?.nif || "").trim(),
    address: String(body.address || b?.address || "").trim(),
    city: String(body.city || b?.city || "").trim(),
    postalCode: String(body.postalCode || b?.postalCode || "").trim(),
    country: String(body.country || b?.country || "España").trim(),
    email: String(body.email || b?.email || order.clientEmail || "").trim(),
  };
  if (!billing.fiscalName) {
    return NextResponse.json({ ok: false, error: "Falta el nombre fiscal del cliente." }, { status: 400 });
  }

  try {
    const invoice = await issueOrUpdateInvoice({
      orderId: order.id,
      amountCents: order.amountCents,
      billing,
      number: body.number,
    });
    // Persistir los datos fiscales en BillingData si se introdujeron a mano y no existían.
    if (!b) {
      await prisma.billingData
        .create({ data: { orderId: order.id, requested: true, ...billing } })
        .catch(() => {});
    }
    return NextResponse.json({ ok: true, invoice });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo emitir la factura." }, { status: 400 });
  }
}
