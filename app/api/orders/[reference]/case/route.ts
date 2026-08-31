// app/api/orders/[reference]/case/route.ts
// STAFF: agrupa pedidos del MISMO cliente en un trámite (Order.caseRef) o los
// desagrupa. Único escritor de caseRef en todo el repo. No toca cobro, factura ni
// estado de workflow: agrupar es una etiqueta, no una transición.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { createCaseRef } from "@/lib/order-case";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { reference: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  let body: { references?: string[]; ungroup?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }

  const order = await prisma.order.findUnique({
    where: { reference: params.reference },
    select: { id: true, reference: true, clientEmail: true, caseRef: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  if (body.ungroup) {
    await prisma.order.update({ where: { id: order.id }, data: { caseRef: null } });
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "case.left",
        message: `Sacado del trámite ${order.caseRef ?? "-"}.`,
        payload: { caseRef: order.caseRef, actorEmail: access.email },
      },
    });
    return NextResponse.json({ ok: true, caseRef: null });
  }

  const wanted = Array.from(new Set((body.references || []).map((r) => String(r || "").trim()).filter(Boolean)));
  if (wanted.length === 0) {
    return NextResponse.json({ ok: false, error: "Elige al menos un pedido para agrupar." }, { status: 400 });
  }

  const others = await prisma.order.findMany({
    where: { reference: { in: wanted } },
    select: { id: true, reference: true, clientEmail: true, caseRef: true },
  });
  const missing = wanted.filter((r) => !others.some((o) => o.reference === r));
  if (missing.length > 0) {
    return NextResponse.json({ ok: false, error: `No existe: ${missing.join(", ")}.` }, { status: 404 });
  }

  // Un trámite es de UN cliente. Agrupar pedidos de clientes distintos filtraría
  // los documentos de uno en la carpeta del otro y en su email de envío.
  // Comparación insensible a mayúsculas: hay datos antiguos con otra
  // capitalización y el resto del sistema empareja así (lib/client-portal.ts).
  const sameClient = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const foreign = others.filter((o) => !sameClient(o.clientEmail, order.clientEmail));
  if (foreign.length > 0) {
    return NextResponse.json(
      { ok: false, error: `Son de otro cliente: ${foreign.map((o) => o.reference).join(", ")}.` },
      { status: 400 }
    );
  }

  const members = [order, ...others.filter((o) => o.id !== order.id)];
  const existing = Array.from(new Set(members.map((m) => m.caseRef).filter(Boolean))) as string[];
  if (existing.length > 1) {
    return NextResponse.json(
      { ok: false, error: `Esos pedidos ya están en trámites distintos (${existing.join(", ")}). Desagrupa uno primero.` },
      { status: 409 }
    );
  }
  const caseRef = existing[0] || createCaseRef();

  const toUpdate = members.filter((m) => m.caseRef !== caseRef);
  await prisma.$transaction([
    prisma.order.updateMany({ where: { id: { in: toUpdate.map((m) => m.id) } }, data: { caseRef } }),
    prisma.orderEvent.createMany({
      data: toUpdate.map((m) => ({
        orderId: m.id,
        type: "case.joined",
        message: `Agrupado en el trámite ${caseRef} con ${members.filter((x) => x.id !== m.id).map((x) => x.reference).join(", ")}.`,
        payload: { caseRef, members: members.map((x) => x.reference), actorEmail: access.email },
      })),
    }),
  ]);

  return NextResponse.json({ ok: true, caseRef, members: members.map((m) => m.reference) });
}
