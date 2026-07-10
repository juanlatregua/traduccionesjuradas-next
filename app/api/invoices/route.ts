// app/api/invoices/route.ts
// STAFF: crear un borrador de factura (libre o vinculado a un pedido) y prefill
// de datos fiscales desde un pedido existente.
//  - GET ?reference=REF → datos para prerellenar el formulario desde un pedido.
//  - POST → crea un borrador (status DRAFT, sin número hasta emitir).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { createDraftInvoice, type InvoiceLine } from "@/lib/client-invoice";

export const runtime = "nodejs";

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

async function resolveOrderLink(reference: string) {
  const order = await prisma.order.findUnique({
    where: { reference },
    select: { id: true, reference: true, clientInvoice: { select: { id: true, number: true } } },
  });
  return order;
}

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const reference = new URL(req.url).searchParams.get("reference")?.trim();
  if (!reference) return NextResponse.json({ ok: false, error: "Falta la referencia." }, { status: 400 });

  const order = await prisma.order.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      title: true,
      langPair: true,
      amountCents: true,
      clientName: true,
      clientEmail: true,
      billing: true,
      clientInvoice: { select: { id: true, number: true } },
    },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const b = order.billing;
  // El importe del pedido es total CON IVA → la línea sugerida va en base (sin IVA, 21%).
  const baseCents = Math.round(order.amountCents / 1.21);
  return NextResponse.json({
    ok: true,
    alreadyInvoiced: order.clientInvoice || null,
    prefill: {
      orderReference: order.reference,
      clientName: order.clientName || "",
      fiscalName: b?.fiscalName || order.clientName || "",
      nif: b?.nif || "",
      address: b?.address || "",
      city: b?.city || "",
      postalCode: b?.postalCode || "",
      country: b?.country || "España",
      email: b?.email || order.clientEmail || "",
      concept: order.title || "",
      langPair: order.langPair || "",
      vatRate: 0.21,
      lines: [{ description: order.title || "Traducción jurada", amountCents: baseCents }],
    },
  });
}

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* opcional */
  }

  if (!String(body.fiscalName || "").trim()) {
    return NextResponse.json({ ok: false, error: "Falta el nombre fiscal del cliente." }, { status: 400 });
  }

  let orderId: string | null = null;
  if (body.orderReference && String(body.orderReference).trim()) {
    const order = await resolveOrderLink(String(body.orderReference).trim());
    if (!order) {
      return NextResponse.json({ ok: false, error: "El pedido indicado no existe." }, { status: 400 });
    }
    if (order.clientInvoice) {
      return NextResponse.json(
        { ok: false, error: `Ese pedido ya tiene una factura (${order.clientInvoice.number || "borrador"}).` },
        { status: 400 }
      );
    }
    orderId = order.id;
  }

  try {
    const invoice = await createDraftInvoice({
      docKind: body.docKind,
      brand: body.brand,
      orderId,
      clientName: body.clientName,
      holderNames: body.holderNames,
      fiscalName: String(body.fiscalName),
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
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear el borrador." }, { status: 400 });
  }
}
