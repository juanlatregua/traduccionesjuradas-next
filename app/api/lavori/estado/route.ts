// app/api/lavori/estado/route.ts — lavori pregunta, antes de que Juan confirme un
// encargo del motor, si el cliente ha pagado y si el pedido ya tiene traductor
// (contrato 3-oct-2026, ficha lavori «confirmar sin pago», A2). Solo lectura.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LAVORI_MEMBER_COLLABORATOR_EMAIL, orderRefFromMotorRef } from "@/lib/lavori-bridge";
import { hasMotorAuth } from "@/lib/lavori-motor-auth";
import { isHeldByJuan, orderIdForLead } from "@/lib/lavori-dup-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Estado = {
  ref: string;
  viva: boolean;
  pagado: boolean;
  pago: "confirmado" | "declarado" | "no";
  pagadoEn: string | null;
  asignado: { via: "lavori" | "fuera"; nombre: string } | null;
  loLlevaJuan: boolean;
};

const PRUEBAS: Record<string, Omit<Estado, "ref">> = {
  "LEAD-PRUEBA-PAGADO": { viva: true, pagado: true, pago: "confirmado", pagadoEn: "2026-10-03T10:00:00.000Z", asignado: null, loLlevaJuan: false },
  "LEAD-PRUEBA-NOPAGO": { viva: true, pagado: false, pago: "no", pagadoEn: null, asignado: null, loLlevaJuan: false },
  "LEAD-PRUEBA-FUERA": { viva: true, pagado: true, pago: "confirmado", pagadoEn: "2026-10-03T10:00:00.000Z", asignado: { via: "fuera", nombre: "Prueba" }, loLlevaJuan: false },
};

const VIVAS = ["SENT", "PRICED", "ACCEPTED", "ESCALATED", "RETIRING"];

export async function GET(req: Request) {
  if (!hasMotorAuth(req)) return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const motorRef = String(new URL(req.url).searchParams.get("ref") || "").trim();
  if (!motorRef) return NextResponse.json({ ok: false, error: "ref obligatoria" }, { status: 400 });
  const reference = orderRefFromMotorRef(motorRef);

  const prueba = PRUEBAS[reference];
  if (prueba) return NextResponse.json({ ref: motorRef, ...prueba });

  const lead = await prisma.lavoriPriceRequest.findUnique({
    where: { ref: reference },
    select: { id: true, status: true, quoteId: true, miembroId: true, heldByJuanAt: true },
  });
  const orderSelect = {
    id: true,
    paymentStatus: true,
    paidAt: true,
    assignedTo: true,
    events: {
      where: { type: { in: ["payment.transfer_declared", "payment.proof_uploaded", "lavori.encargo_aceptado"] } },
      orderBy: { createdAt: "desc" as const },
      select: { type: true, payload: true },
    },
    collaboratorAssignments: {
      where: { status: { in: ["ACCEPTED" as const, "DELIVERED" as const] } },
      orderBy: { acceptedAt: "desc" as const },
      take: 1,
      select: { collaborator: { select: { fullName: true, email: true } } },
    },
  };
  const leadOrderId = lead ? await orderIdForLead(lead) : null;
  const order = leadOrderId
    ? await prisma.order.findUnique({ where: { id: leadOrderId }, select: orderSelect })
    : lead
      ? null
      : await prisma.order.findUnique({ where: { reference }, select: orderSelect });
  if (!lead && !order) return NextResponse.json({ ok: false, error: "ref_desconocida" }, { status: 404 });

  // Una solicitud cerrada (retirada o descartada) no responde por el pago de su
  // presupuesto: el presupuesto puede haberse quedado con otra (26_C3617B).
  const viva = lead ? VIVAS.includes(lead.status) : true;
  const quote = viva && lead?.quoteId
    ? await prisma.quote.findUnique({ where: { id: lead.quoteId }, select: { paidAt: true } })
    : null;

  let pago: Estado["pago"] = "no";
  let pagadoEn: Date | null = null;
  if (viva && order?.paymentStatus === "PAID") {
    pago = "confirmado";
    pagadoEn = order.paidAt;
  } else if (viva && quote?.paidAt) {
    pago = "confirmado";
    pagadoEn = quote.paidAt;
  } else if (viva && order?.events.some((e) => e.type !== "lavori.encargo_aceptado")) {
    pago = "declarado";
  }

  let asignado: Estado["asignado"] = null;
  if (viva && order) {
    const colab = order.collaboratorAssignments[0]?.collaborator ?? null;
    const nombre = colab?.fullName || order.assignedTo;
    if (nombre) {
      const aceptado = order.events.find((e) => e.type === "lavori.encargo_aceptado")?.payload as { miembroId?: unknown } | null;
      const miembroId = lead?.miembroId || (aceptado?.miembroId ? String(aceptado.miembroId) : null);
      const emailMiembro = miembroId ? LAVORI_MEMBER_COLLABORATOR_EMAIL[miembroId] : undefined;
      const viaLavori = Boolean(colab && emailMiembro && emailMiembro.toLowerCase() === colab.email.toLowerCase());
      asignado = { via: viaLavori ? "lavori" : "fuera", nombre };
    }
  }

  const estado: Estado = {
    ref: motorRef,
    viva,
    pagado: pago === "confirmado",
    pago,
    pagadoEn: pagadoEn ? pagadoEn.toISOString() : null,
    asignado,
    loLlevaJuan: await isHeldByJuan(motorRef, order?.id),
  };
  return NextResponse.json(estado);
}
