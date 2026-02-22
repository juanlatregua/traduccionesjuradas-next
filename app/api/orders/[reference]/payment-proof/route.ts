import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  sendPaymentProofReceivedClientEmail,
  sendPaymentProofUploadedStaffEmail,
} from "@/lib/email";
import { validatePaymentProofFile } from "@/lib/file-security";
import { getWorkflowState } from "@/lib/workflow";
import { transitionWorkflowState } from "@/lib/workflow-server";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;

  const rl = checkRateLimit({
    key: `payment-proof:${params.reference}:${ip}`,
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
      select: {
        id: true,
        reference: true,
        paymentStatus: true,
        clientEmail: true,
        title: true,
        amountCents: true,
        events: {
          orderBy: { createdAt: "desc" },
          take: 40,
          select: {
            type: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    if (order.paymentStatus === "PAID") {
      return NextResponse.json({ ok: false, error: "Este pedido ya esta pagado." }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientEmailRaw = String(formData.get("clientEmail") || "").trim().toLowerCase();

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

    const isStaff = !!sessionEmail && isStaffEmail(sessionEmail);
    const isAuthenticatedOwner = !!sessionEmail && sessionEmail === order.clientEmail.toLowerCase();
    const isGuestOwner = !sessionEmail && !!clientEmailRaw && clientEmailRaw === order.clientEmail.toLowerCase();
    if (!isStaff && !isAuthenticatedOwner && !isGuestOwner) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No autorizado para subir comprobante. Inicia sesion o indica el mismo email del pedido.",
        },
        { status: 403 }
      );
    }

    const workflowState = getWorkflowState(order);
    if (workflowState === "PRESUPUESTO_ENVIADO") {
      await transitionWorkflowState({
        reference: order.reference,
        to: "PENDIENTE_PAGO",
        actorEmail: sessionEmail || clientEmailRaw || "guest",
        reason: "Cliente sube comprobante tras presupuesto enviado.",
      }).catch((err) => {
        console.error("[payment-proof] workflow transition to PENDIENTE_PAGO failed", err);
      });
    } else if (!["PENDIENTE_PAGO", "JUSTIFICANTE_SUBIDO"].includes(workflowState)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Este pedido aun no esta en fase de pago. Espera a recibir el presupuesto final.",
        },
        { status: 400 }
      );
    }

    const validation = await validatePaymentProofFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: "Archivo demasiado grande (max 5 MB)." },
        { status: 400 }
      );
    }

    const pathname = `orders/${params.reference}/comprobantes/${Date.now()}-${validation.safeName}`;
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: true });
    const uploadedAt = new Date().toISOString();

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "payment.proof_uploaded",
        message: "Comprobante de pago adjuntado por el cliente. Pendiente de verificacion.",
        payload: {
          fileUrl: blob.url,
          fileName: validation.safeName,
          uploadedAt,
          uploadedBy: sessionEmail || clientEmailRaw || null,
        },
      },
    });

    await transitionWorkflowState({
      reference: order.reference,
      to: "JUSTIFICANTE_SUBIDO",
      actorEmail: sessionEmail || clientEmailRaw || "guest",
      reason: "Comprobante de pago subido por cliente.",
    }).catch((err) => {
      console.error("[payment-proof] workflow transition failed", err);
    });

    // Non-blocking notifications
    sendPaymentProofUploadedStaffEmail({
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      clientEmail: order.clientEmail,
      proofUrl: blob.url,
      fileName: file.name,
    }).catch((e) => console.error("[payment-proof] staff email failed", e));

    sendPaymentProofReceivedClientEmail({
      toEmail: order.clientEmail,
      reference: order.reference,
    }).catch((e) => console.error("[payment-proof] client email failed", e));

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[payment-proof] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al subir comprobante." },
      { status: 500 }
    );
  }
}
