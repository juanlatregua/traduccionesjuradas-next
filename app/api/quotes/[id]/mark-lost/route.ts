import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { QUOTE_LOST_REASONS, type QuoteLostReasonCode } from "@/lib/quote-lost-reasons";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// Staff marca el presupuesto como NO ACEPTADO (orden Juan 22-ago-2026): mismo
// destino que la caducidad automática (EXPIRED + expiredAt = ahora, así entra en
// el carril de perdidos del digest y deja de recibir recordatorios) + el motivo
// que hasta hoy solo podía dar el cliente en /q/[token]. Solo presupuestos no
// formalizados: un pagado/convertido nunca se marca perdido.
const MARKABLE = ["DRAFT", "SENT", "OPENED", "ACCEPTED"];

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = String(body?.reason || "").toUpperCase() as QuoteLostReasonCode;
  if (!QUOTE_LOST_REASONS.includes(reason)) {
    return NextResponse.json({ ok: false, error: "Motivo no válido." }, { status: 400 });
  }
  const note = String(body?.note || "").trim().slice(0, 500) || null;

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      paidAt: true,
      orders: { where: { paymentStatus: "PAID" }, select: { id: true }, take: 1 },
    },
  });
  if (!quote) return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  if (!MARKABLE.includes(quote.status) || quote.paidAt || quote.orders.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Solo se marca no aceptado un presupuesto sin formalizar. Estado actual: ${quote.status}` },
      { status: 400 }
    );
  }

  const now = new Date();
  await prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: "EXPIRED",
      expiredAt: now,
      lostReason: reason,
      lostReasonNote: note,
      lostFeedbackAt: now,
    },
  });

  return NextResponse.json({ ok: true });
}
