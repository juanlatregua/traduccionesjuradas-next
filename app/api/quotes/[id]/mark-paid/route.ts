// app/api/quotes/[id]/mark-paid/route.ts
// Pago manual de un presupuesto (Bizum / transferencia). Registra el QuotePayment,
// marca el Quote PAID y dispara el mismo puente presupuesto→pedido que el webhook.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { decimalToNumber } from "@/lib/quotes";
import { runQuoteToOrderBridge } from "@/lib/quote-to-order";

export const runtime = "nodejs";

const PAYABLE = new Set(["DRAFT", "SENT", "OPENED", "ACCEPTED"]);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* body opcional */
  }
  const method = String(body?.method || "TRANSFER").toUpperCase() === "BIZUM" ? "BIZUM" : "TRANSFER";

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      quoteNumber: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      sourceLang: true,
      targetLang: true,
      expedienteRef: true,
      total: true,
      currency: true,
      lines: { select: { description: true, unitPrice: true } },
    },
  });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }
  if (!PAYABLE.has(quote.status)) {
    return NextResponse.json(
      { ok: false, error: `El presupuesto está en estado ${quote.status}; no se puede marcar como pagado.` },
      { status: 400 }
    );
  }

  const totalEur = decimalToNumber(quote.total);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.quotePayment.create({
        data: {
          quoteId: quote.id,
          provider: method,
          amount: totalEur,
          currency: quote.currency || "EUR",
        },
      });
      await tx.quote.update({
        where: { id: quote.id },
        data: { status: "PAID", paidAt: new Date() },
      });
      await tx.messageLog.create({
        data: {
          quoteId: quote.id,
          channel: "EMAIL",
          type: "PAID_CONFIRMATION",
          recipient: quote.customerEmail,
          subject: "Pago registrado manualmente",
          body: `Pago ${method} registrado por ${access.email}.`,
          sentAt: null,
          status: "DRAFT",
        },
      });
    });

    await runQuoteToOrderBridge({
      quote: {
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        customerEmail: quote.customerEmail,
        customerName: quote.customerName,
        customerPhone: quote.customerPhone,
        sourceLang: quote.sourceLang,
        targetLang: quote.targetLang,
        totalEur,
        currency: quote.currency,
        expedienteRef: quote.expedienteRef,
        lines: quote.lines.map((l) => ({ description: l.description, unitPrice: decimalToNumber(l.unitPrice) })),
      },
      provider: method,
      providerEventId: `manual:${method}:${quote.id}`,
      source: "staff_manual_quote_payment",
      payload: { actorEmail: access.email },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[quotes:mark-paid] error", err?.message || err);
    return NextResponse.json({ ok: false, error: "No se pudo registrar el pago." }, { status: 500 });
  }
}
