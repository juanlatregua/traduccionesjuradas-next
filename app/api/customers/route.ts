// app/api/customers/route.ts
// STAFF: agenda de clientes (modelo Customer) para elegir al crear un presupuesto.
// Incluye los clientes creados por upsert desde presupuestos + las fichas B2B
// con pack fiscal (p.ej. Auream).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const customers = await prisma.customer.findMany({
    orderBy: [{ companyName: "asc" }, { name: "asc" }],
    take: 1000,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      companyName: true,
      fiscalName: true,
      nif: true,
      isBusiness: true,
    },
  });

  return NextResponse.json({ ok: true, customers });
}

type CreateBody = {
  name?: string;
  email?: string;
  phone?: string | null;
  companyName?: string | null;
  fiscalName?: string | null;
  nif?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  notes?: string | null;
  isBusiness?: boolean;
  autoConfirmPayment?: boolean;
};

// STAFF: alta manual de un cliente en la agenda (sin pasar por un presupuesto).
export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: CreateBody = {};
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    /* opcional */
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  if (!name) return NextResponse.json({ ok: false, error: "Falta el nombre del cliente." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 });
  }

  const exists = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
  if (exists) {
    return NextResponse.json({ ok: false, error: "Ya existe un cliente con ese email." }, { status: 409 });
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone: body.phone?.trim() || null,
        companyName: body.companyName?.trim() || null,
        fiscalName: body.fiscalName?.trim() || null,
        nif: body.nif?.trim() || null,
        address: body.address?.trim() || null,
        city: body.city?.trim() || null,
        postalCode: body.postalCode?.trim() || null,
        country: body.country?.trim() || "España",
        notes: body.notes?.trim() || null,
        isBusiness: !!body.isBusiness,
        autoConfirmPayment: !!body.autoConfirmPayment,
      },
      select: { id: true, email: true },
    });
    return NextResponse.json({ ok: true, customer });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Ya existe un cliente con ese email." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear el cliente." }, { status: 400 });
  }
}
