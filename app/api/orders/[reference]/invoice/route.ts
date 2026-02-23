import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail, saveBillingData } from "@/lib/orders";
import { sendInvoiceRequestEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type InvoiceBody = {
  fiscalName: string;
  nif: string;
  address: string;
  city: string;
  postalCode: string;
  country?: string;
  email: string;
};

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
  }

  try {
    const order = await getOrderDetail(params.reference, session.user.email);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as InvoiceBody;

    if (!body.fiscalName || !body.nif || !body.address || !body.city || !body.postalCode || !body.email) {
      return NextResponse.json(
        { ok: false, error: "Todos los campos fiscales son obligatorios." },
        { status: 400 }
      );
    }

    // Save billing data
    await saveBillingData(order.id, {
      fiscalName: body.fiscalName,
      nif: body.nif,
      address: body.address,
      city: body.city,
      postalCode: body.postalCode,
      country: body.country || "España",
      email: body.email,
      requested: true,
    });

    // Mark as notified
    await prisma.billingData.update({
      where: { orderId: order.id },
      data: { notifiedAt: new Date() },
    });

    // Create event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "invoice.requested",
        message: `Factura solicitada por ${session.user.email}. Datos fiscales: ${body.fiscalName} (${body.nif}).`,
      },
    });

    // Send email to translator
    const skipDev = process.env.SENDGRID_SKIP_DEV === "true" && process.env.NODE_ENV === "development";
    if (!skipDev) {
      await sendInvoiceRequestEmail({
        reference: order.reference,
        title: order.title,
        amountCents: order.amountCents,
        clientEmail: session.user.email,
        billing: {
          fiscalName: body.fiscalName,
          nif: body.nif,
          address: body.address,
          city: body.city,
          postalCode: body.postalCode,
          country: body.country || "España",
          email: body.email,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[invoice] error", err);
    return NextResponse.json({ ok: false, error: "Error al solicitar factura." }, { status: 500 });
  }
}
