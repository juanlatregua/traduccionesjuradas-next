// app/api/documents/lookup/route.ts — Consulta de pedido por email + referencia

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ip = getClientIp(req);

  const rl = await checkRateLimit({
    key: `lookup:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas consultas. Inténtalo en unos minutos." },
      { status: 429 }
    );
  }

  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  const reference = searchParams.get("reference")?.trim().toUpperCase();

  if (!email || !reference) {
    return NextResponse.json(
      { ok: false, error: "Email y referencia son obligatorios." },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: {
      reference,
      clientEmail: { equals: email, mode: "insensitive" },
    },
    select: {
      reference: true,
      title: true,
      amountCents: true,
      paymentStatus: true,
      deliveryState: true,
      dueDate: true,
      createdAt: true,
      translatedFileUrl: true,
      langPair: true,
    },
  });

  if (!order) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No hemos encontrado un pedido con esa combinación de email y referencia. Comprueba los datos o contacta con nosotros.",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    order: {
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      paymentStatus: order.paymentStatus,
      deliveryState: order.deliveryState,
      dueDate: order.dueDate?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      translatedFileUrl: order.translatedFileUrl,
      langPair: order.langPair,
    },
  });
}
