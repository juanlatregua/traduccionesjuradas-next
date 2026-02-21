import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `payment-proof:${ip}`,
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
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: { id: true, paymentStatus: true },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ ok: false, error: "Este pedido ya esta pagado." }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    const allowedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ]);
    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Solo se permiten imagenes (JPG, PNG, WebP) o PDF." },
        { status: 400 }
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: "Archivo demasiado grande (max 5 MB)." },
        { status: 400 }
      );
    }

    const pathname = `orders/${params.reference}/comprobantes/${Date.now()}-${file.name}`;
    const blob = await put(pathname, file, { access: "public" });

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "payment.proof_uploaded",
        message: "Comprobante de pago adjuntado por el cliente.",
        payload: { fileUrl: blob.url, fileName: file.name },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[payment-proof] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al subir comprobante." },
      { status: 500 }
    );
  }
}
