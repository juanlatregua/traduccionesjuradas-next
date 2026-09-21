// POST /api/orders/:reference/shipping — dirección de envío de un pedido en papel.
// Vale con el enlace firmado (?token del email/SMS) o con sesión del propio cliente.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyOrderToken } from "@/lib/order-token";
import { isStaffEmail } from "@/lib/staff-access";
import { saveShippingData } from "@/lib/orders";
import { validateShippingInput } from "@/lib/shipping-validation";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const rl = await checkRateLimit({
    key: `order-shipping:${params.reference}:${getClientIp(req)}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true, clientEmail: true, deliveryType: true, shippedAt: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const token = String(body.token || "");
    let authorized = !!token && verifyOrderToken(params.reference, token);
    if (!authorized) {
      const session = await getServerSession(authOptions);
      const email = session?.user?.email?.trim().toLowerCase() || "";
      authorized = !!email && (email === order.clientEmail.toLowerCase() || isStaffEmail(email));
    }
    if (!authorized) {
      return NextResponse.json({ ok: false, error: "Enlace no válido o caducado." }, { status: 401 });
    }

    if (order.deliveryType !== "paper") {
      return NextResponse.json({ ok: false, error: "Este pedido no lleva envío en papel." }, { status: 400 });
    }
    if (order.shippedAt) {
      return NextResponse.json({ ok: false, error: "El envío ya ha salido. Escríbenos si hay que cambiar algo." }, { status: 409 });
    }

    const v = validateShippingInput(body);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: "Revisa los datos de envío.", errors: v.errors }, { status: 422 });
    }

    await saveShippingData(order.id, v.data);
    await prisma.orderEvent
      .create({
        data: {
          orderId: order.id,
          type: "shipping.data_saved",
          message: `Dirección de envío completada: ${v.data.name}, ${v.data.address}, ${v.data.postalCode} ${v.data.city} (${v.data.province}), ${v.data.country}.`,
          payload: { ...v.data },
        },
      })
      .catch((e) => console.error("[orders/shipping] evento", e));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[orders/shipping] error", err);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la dirección." }, { status: 500 });
  }
}
