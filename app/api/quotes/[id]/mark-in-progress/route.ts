import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = {
  params: {
    id: string;
  };
};

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }
  if (quote.status !== "PAID") {
    return NextResponse.json(
      { ok: false, error: `Solo se puede iniciar en estado PAID. Estado actual: ${quote.status}` },
      { status: 400 }
    );
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "IN_PROGRESS" },
  });

  return NextResponse.json({ ok: true });
}
