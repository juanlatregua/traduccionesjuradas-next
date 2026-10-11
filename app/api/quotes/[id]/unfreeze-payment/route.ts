import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// «Desbloquear igualmente» (lib/precio-tras-envio): el staff asume la pérdida y el
// cliente vuelve a poder pagar. Queda rastro de quién y por qué. El coste real NO
// se escribe en las líneas: al pagar, el freno de lavori (ALTA 1(b)) compara la cifra
// con el coste estimado de las líneas y pide decisión — PERO solo si ese coste es > 0;
// con coste estimado 0 el freno no actúa y la cifra se aceptaría sola al pagar, así que
// entonces se exige confirmarlo explícitamente (confirmSinCoste). paymentFreezeKey se
// conserva para que el mismo evento de lavori repetido no vuelva a congelar.
export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = String(body?.reason || "").trim().slice(0, 500);
  if (reason.length < 10) {
    return NextResponse.json({ ok: false, error: "Escribe por qué (al menos 10 caracteres): queda en el registro." }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: { id: true, quoteNumber: true, paymentFrozenAt: true, paymentFrozenReason: true, lines: { select: { supplierUnitCost: true } } },
  });
  if (!quote) return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  if (!quote.paymentFrozenAt) return NextResponse.json({ ok: true, alreadyUnfrozen: true });
  const costeEstimadoCero = quote.lines.every((l) => Number(l.supplierUnitCost || 0) <= 0);
  if (costeEstimadoCero && body?.confirmSinCoste !== true) {
    return NextResponse.json(
      {
        ok: false,
        needsConfirm: true,
        error: "Este presupuesto no tiene coste estimado en las líneas: al pagar, la cifra del jurado se aceptará SOLA en lavori, sin freno. Confírmalo expresamente.",
      },
      { status: 409 }
    );
  }

  await prisma.$transaction([
    prisma.messageLog.create({
      data: {
        quoteId: quote.id,
        channel: "EMAIL",
        type: "MARGIN_OVERRIDE",
        recipient: access.email || "staff",
        subject: `[precio-tras-envio] pago DESBLOQUEADO ${quote.quoteNumber} por ${access.email}`,
        body: `Desbloqueado por ${access.email} asumiendo la pérdida.${costeEstimadoCero ? " SIN coste estimado: confirmado que la cifra del jurado se aceptará sola al pagar." : ""} Motivo: ${reason}\nCongelación: ${quote.paymentFrozenReason || "-"}`,
        sentAt: new Date(),
        status: "SENT",
      },
    }),
    prisma.quote.update({ where: { id: quote.id }, data: { paymentFrozenAt: null } }),
  ]);

  return NextResponse.json({ ok: true });
}
