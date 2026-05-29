import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { getOrCreateClientInvoice } from "@/lib/client-invoice";
import { requireStaffAccess } from "@/lib/staff-auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function GET(req: Request, { params }: Params) {
  // El staff (zona) puede ver/descargar cualquier factura; el cliente solo la suya.
  const staff = await requireStaffAccess(req);
  let scopedEmail: string | undefined;
  if (!staff.ok) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
    }
    scopedEmail = session.user.email;
  }

  try {
    const order = await getOrderDetail(params.reference, scopedEmail);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    if (!order.billing || !order.billing.requested) {
      return NextResponse.json(
        { ok: false, error: "No se han solicitado datos de facturacion para este pedido." },
        { status: 400 }
      );
    }

    if (order.paymentStatus !== "PAID") {
      return NextResponse.json(
        { ok: false, error: "La factura solo esta disponible para pedidos pagados." },
        { status: 400 }
      );
    }

    // Emite (o recupera) la factura con numeración fiscal secuencial persistida.
    const billing = {
      fiscalName: order.billing.fiscalName,
      nif: order.billing.nif,
      address: order.billing.address,
      city: order.billing.city,
      postalCode: order.billing.postalCode,
      country: order.billing.country,
      email: order.billing.email,
    };
    const invoice = await getOrCreateClientInvoice({
      orderId: order.id,
      amountCents: order.amountCents,
      billing,
    });

    // Líneas del expediente, si las hay (precio sin IVA por documento).
    const items = await prisma.orderDocumentItem.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });
    const lines = items
      .filter((it) => it.quotedCents != null && it.quotedCents > 0)
      .map((it) => {
        const dir = it.sourceLang && it.targetLang ? `${it.sourceLang}-${it.targetLang}` : "";
        const meta = [it.words ? `${it.words} palabras` : "", dir].filter(Boolean).join(" · ");
        return {
          description: it.documentType || it.fileName,
          detail: meta || undefined,
          amountCents: Math.round((it.quotedCents as number) / 1.21),
        };
      });

    const pdfBuffer = generateInvoicePdf({
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      langPair: order.langPair,
      words: order.words,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      invoiceNumber: invoice.number,
      issuedAt: invoice.issuedAt,
      lines: lines.length > 0 ? lines : undefined,
      billing,
    });

    const filename = `${invoice.number}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    console.error("[invoice-pdf] error", err);
    return NextResponse.json({ ok: false, error: "Error al generar factura." }, { status: 500 });
  }
}
