// app/api/customers/[id]/route.ts
// STAFF: edición de la ficha del cliente. Antes NO existía: un NIF mal tecleado
// antes de facturar obligaba a tocar la base de datos a mano. El email es la
// clave natural (unique) y la usan los upserts de presupuesto y el portal del
// cliente → cambiarlo se permite, pero se valida colisión explícitamente.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { id: string } };

type PatchBody = {
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
  // Carril de crédito (Juan, 2-sep-2026): el permiso vive en el CLIENTE.
  creditEnabled?: boolean;
  creditDays?: number | null;
  intermediaryEmail?: string | null;
};

const trimOrNull = (v: unknown) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
};

export async function PATCH(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const current = await prisma.customer.findUnique({
    where: { id: params.id },
    select: { id: true, email: true },
  });
  if (!current) return NextResponse.json({ ok: false, error: "Cliente no encontrado." }, { status: 404 });

  let body: PatchBody = {};
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    /* opcional */
  }

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Falta el nombre del cliente." }, { status: 400 });
    data.name = name;
  }

  if (body.email !== undefined) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "Email inválido." }, { status: 400 });
    }
    if (email !== current.email) {
      const clash = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
      if (clash) return NextResponse.json({ ok: false, error: "Ya existe otro cliente con ese email." }, { status: 409 });
      data.email = email;
    }
  }

  for (const key of ["phone", "companyName", "fiscalName", "nif", "address", "city", "postalCode", "notes"] as const) {
    if (body[key] !== undefined) data[key] = trimOrNull(body[key]);
  }
  if (body.country !== undefined) data.country = trimOrNull(body.country) || "España";
  if (body.isBusiness !== undefined) data.isBusiness = !!body.isBusiness;
  if (body.autoConfirmPayment !== undefined) data.autoConfirmPayment = !!body.autoConfirmPayment;
  if (body.creditEnabled !== undefined) data.creditEnabled = !!body.creditEnabled;
  if (body.creditDays !== undefined) {
    const days = Math.round(Number(body.creditDays));
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      return NextResponse.json({ ok: false, error: "Los días de crédito tienen que estar entre 1 y 90." }, { status: 400 });
    }
    data.creditDays = days;
  }

  // Intermediario por email, mismas reglas que el alta: debe existir y no puede
  // ser uno mismo. "" (vacío) desvincula.
  if (body.intermediaryEmail !== undefined) {
    const intermediaryEmail = String(body.intermediaryEmail || "").trim().toLowerCase();
    if (!intermediaryEmail) {
      data.intermediaryId = null;
    } else {
      const targetEmail = (data.email as string) || current.email;
      if (intermediaryEmail === targetEmail) {
        return NextResponse.json(
          { ok: false, error: "Un cliente no puede ser su propio intermediario." },
          { status: 400 }
        );
      }
      const inter = await prisma.customer.findFirst({
        where: { email: { equals: intermediaryEmail, mode: "insensitive" } },
        select: { id: true },
      });
      if (!inter) {
        return NextResponse.json(
          { ok: false, error: "No existe un cliente con el email del intermediario indicado." },
          { status: 400 }
        );
      }
      if (inter.id === current.id) {
        return NextResponse.json(
          { ok: false, error: "Un cliente no puede ser su propio intermediario." },
          { status: 400 }
        );
      }
      data.intermediaryId = inter.id;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true, customer: { id: current.id, email: current.email } });
  }

  try {
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data,
      select: { id: true, email: true, name: true },
    });
    return NextResponse.json({ ok: true, customer });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json({ ok: false, error: "Ya existe otro cliente con ese email." }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo actualizar el cliente." }, { status: 400 });
  }
}
