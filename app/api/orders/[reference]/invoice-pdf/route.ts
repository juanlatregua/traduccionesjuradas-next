import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail } from "@/lib/orders";
import { generateInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
  }

  try {
    const order = await getOrderDetail(params.reference, session.user.email);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    if (!order.billing || !order.billing.requested) {
      return NextResponse.json(
        { ok: false, error: "No se han solicitado datos de facturacion para este pedido." },
        { status: 400 }
      );
    }

    const pdfBuffer = generateInvoicePdf({
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      langPair: order.langPair,
      words: order.words,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      billing: {
        fiscalName: order.billing.fiscalName,
        nif: order.billing.nif,
        address: order.billing.address,
        city: order.billing.city,
        postalCode: order.billing.postalCode,
        country: order.billing.country,
        email: order.billing.email,
      },
    });

    const filename = `factura-${order.reference}.pdf`;

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
