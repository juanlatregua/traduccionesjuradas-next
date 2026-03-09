import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  const collaborators = await prisma.collaborator.findMany({
    where: { active: true },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      languages: true,
      supplierType: true,
    },
  });
  return NextResponse.json({ ok: true, collaborators });
}

type CreateBody = {
  fullName: string;
  email: string;
  phone?: string;
  languages: string[];
  swornNumber?: string;
  nif?: string;
  address?: string;
  companyName?: string;
  supplierType?: "AUTONOMO" | "EMPRESA";
  notes?: string;
};

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as CreateBody;
    if (!body.fullName?.trim() || !body.email?.trim()) {
      return NextResponse.json(
        { ok: false, error: "Nombre y email son obligatorios." },
        { status: 400 }
      );
    }

    const collaborator = await prisma.collaborator.create({
      data: {
        fullName: body.fullName.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone?.trim() || null,
        languages: (body.languages || []).map((l) => l.trim().toLowerCase()),
        swornNumber: body.swornNumber?.trim() || null,
        nif: body.nif?.trim() || null,
        address: body.address?.trim() || null,
        companyName: body.companyName?.trim() || null,
        supplierType: body.supplierType || "AUTONOMO",
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, collaborator }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Ya existe un colaborador con ese email." },
        { status: 409 }
      );
    }
    console.error("[collaborators] create error", err);
    return NextResponse.json(
      { ok: false, error: "Error al crear colaborador." },
      { status: 500 }
    );
  }
}
