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

  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!quote) {
      return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
    }
    if (!["PAID", "IN_PROGRESS"].includes(quote.status)) {
      return NextResponse.json(
        { ok: false, error: `No se puede marcar entregado en estado ${quote.status}.` },
        { status: 400 }
      );
    }

    const now = new Date();
    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        status: "DELIVERED",
        deliveredAt: now,
      },
    });

    await prisma.messageLog.create({
      data: {
        quoteId: quote.id,
        channel: "EMAIL",
        type: "PAID_CONFIRMATION",
        recipient: access.email,
        subject: "Entrega marcada en backoffice",
        body: `El presupuesto ${quote.id} se ha marcado como entregado por ${access.email}.`,
        sentAt: now,
        status: "INTERNAL",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[quotes:mark-delivered] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo marcar como entregado." },
      { status: 500 }
    );
  }
}
