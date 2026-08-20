// Email → expediente del builder: baja los adjuntos del mensaje (Graph), los
// registra como grupo exp:REF con los datos del remitente y devuelve la URL del
// builder (/zona-traductor/presupuesto?exp=REF) para montar el presupuesto.
// Sin adjuntos útiles: builder prerrellenado con el cliente, sin expediente.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildExpedienteFromInbound } from "@/lib/inbox";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: { id: string } };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }
  try {
    const inbound = await prisma.inboundEmail.findUnique({
      where: { id: params.id },
      select: { id: true, graphId: true, channel: true, fromEmail: true, fromName: true, fromPhone: true, mediaJson: true },
    });
    if (!inbound) {
      return NextResponse.json({ ok: false, error: "Email no encontrado." }, { status: 404 });
    }
    const result = await buildExpedienteFromInbound(inbound);
    const builder = new URL("/zona-traductor/presupuesto", "http://local");
    builder.searchParams.set("inbox", inbound.id);
    if (result.ref) {
      builder.searchParams.set("exp", result.ref);
    } else {
      if (inbound.fromName) builder.searchParams.set("customerName", inbound.fromName);
      builder.searchParams.set("customerEmail", inbound.fromEmail);
      if (inbound.fromPhone) builder.searchParams.set("customerPhone", inbound.fromPhone);
    }
    return NextResponse.json({
      ok: true,
      ...result,
      url: `${builder.pathname}${builder.search}`,
    });
  } catch (err: any) {
    console.error("[inbox:expediente] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudieron traer los adjuntos del email." },
      { status: 500 }
    );
  }
}
