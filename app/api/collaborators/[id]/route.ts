import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { id: string } };

type PatchBody = {
  fullName?: string;
  email?: string;
  phone?: string | null;
  languages?: string[];
  swornNumber?: string | null;
  nif?: string | null;
  address?: string | null;
  companyName?: string | null;
  supplierType?: "AUTONOMO" | "EMPRESA";
  active?: boolean;
  notes?: string | null;
};

export async function PATCH(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as PatchBody;

    if (body.fullName !== undefined && !body.fullName.trim()) {
      return NextResponse.json({ ok: false, error: "El nombre no puede estar vacío." }, { status: 400 });
    }
    if (body.email !== undefined && !body.email.trim()) {
      return NextResponse.json({ ok: false, error: "El email no puede estar vacío." }, { status: 400 });
    }

    const data: Record<string, unknown> = {};

    if (body.fullName !== undefined) data.fullName = body.fullName.trim();
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.languages !== undefined) data.languages = body.languages.map((l) => l.trim().toLowerCase());
    if (body.swornNumber !== undefined) data.swornNumber = body.swornNumber?.trim() || null;
    if (body.nif !== undefined) data.nif = body.nif?.trim() || null;
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    if (body.companyName !== undefined) data.companyName = body.companyName?.trim() || null;
    if (body.supplierType !== undefined) data.supplierType = body.supplierType;
    if (body.active !== undefined) data.active = body.active;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

    const collaborator = await prisma.collaborator.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json({ ok: true, collaborator });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Colaborador no encontrado." }, { status: 404 });
    }
    console.error("[collaborators] update error", err);
    return NextResponse.json({ ok: false, error: "Error al actualizar colaborador." }, { status: 500 });
  }
}
