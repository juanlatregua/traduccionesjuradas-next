import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOrderDetail, saveShippingData, saveBillingData } from "@/lib/orders";
import { getWorkflowState } from "@/lib/workflow";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

/* GET  /api/orders/:reference  — order detail for authenticated client */
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
    const workflowState = getWorkflowState(order);
    return NextResponse.json({ ok: true, order: { ...order, workflowState } });
  } catch (err) {
    console.error("[orders] error fetching order", err);
    return NextResponse.json({ ok: false, error: "Error al consultar pedido." }, { status: 500 });
  }
}

/* PATCH /api/orders/:reference  — update shipping or billing data */
type PatchBody = {
  shipping?: {
    name: string;
    phone: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country?: string;
  };
  billing?: {
    fiscalName: string;
    nif: string;
    address: string;
    city: string;
    postalCode: string;
    country?: string;
    email: string;
  };
};

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Sesion requerida." }, { status: 401 });
  }

  try {
    const order = await getOrderDetail(params.reference, session.user.email);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as PatchBody;

    if (body.shipping) {
      await saveShippingData(order.id, body.shipping);
    }

    if (body.billing) {
      await saveBillingData(order.id, {
        ...body.billing,
        requested: Boolean(order.billing?.requested),
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[orders] error updating order", err);
    return NextResponse.json({ ok: false, error: "Error al actualizar pedido." }, { status: 500 });
  }
}
