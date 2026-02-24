import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  sendPaymentConfirmedEmail,
  sendPaymentProofUploadedStaffEmail,
} from "@/lib/email";
import { updateOrderPayment } from "@/lib/orders";
import { validatePaymentProofFile } from "@/lib/file-security";
import { getWorkflowState } from "@/lib/workflow";
import { assignDefaultFrenchEtaIfNeeded, transitionWorkflowState } from "@/lib/workflow-server";
import { isBlobConfigured } from "@/lib/payment-config";
import { hasUploadedSourceDocument, MISSING_SOURCE_DOCUMENT_ERROR } from "@/lib/payment-gating";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;

  const rl = await checkRateLimit({
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
          take: 200,
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
    const methodRaw = String(formData.get("method") || "").trim().toUpperCase();
    const paymentMethod: PaymentMethod =
      methodRaw === "TRANSFER" ? "TRANSFER" : methodRaw === "PAYPAL" ? "PAYPAL" : "BIZUM";

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
    if (!hasUploadedSourceDocument(order)) {
      return NextResponse.json({ ok: false, error: MISSING_SOURCE_DOCUMENT_ERROR }, { status: 400 });
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

    if (!isBlobConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La subida automatica de justificantes no esta disponible temporalmente en este entorno.",
        },
        { status: 503 }
      );
    }

    const pathname = `orders/${params.reference}/comprobantes/${Date.now()}-${validation.safeName}`;
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: true });
    const uploadedAt = new Date().toISOString();

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "payment.proof_uploaded",
        message: "Comprobante de pago adjuntado por el cliente. Pago marcado automaticamente.",
        payload: {
          fileKey: blob.pathname,
          fileUrl: blob.url,
          fileName: validation.safeName,
          uploadedAt,
          uploadedBy: sessionEmail || clientEmailRaw || null,
          method: paymentMethod,
        },
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentProofFileKey: blob.pathname,
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

    const paymentUpdate = await updateOrderPayment(
      order.reference,
      paymentMethod,
      `proof_upload:${params.reference}:${Date.now()}`
    );

    if (paymentUpdate.changed) {
      await transitionWorkflowState({
        reference: order.reference,
        to: "PAGO_VALIDADO",
        actorEmail: sessionEmail || clientEmailRaw || "guest",
        reason: "Pago validado automaticamente tras subir comprobante.",
      }).catch((err) => {
        console.error("[payment-proof] workflow transition to PAGO_VALIDADO failed", err);
      });

      await assignDefaultFrenchEtaIfNeeded({
        reference: order.reference,
        actorEmail: sessionEmail || clientEmailRaw || "guest",
      }).catch((err) => {
        console.error("[payment-proof] default FR ETA assignment failed", err);
      });
    }

    // Non-blocking notifications
    sendPaymentProofUploadedStaffEmail({
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      clientEmail: order.clientEmail,
      proofUrl: blob.url,
      fileName: file.name,
    }).catch((e) => console.error("[payment-proof] staff email failed", e));

    if (paymentUpdate.changed) {
      sendPaymentConfirmedEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        title: order.title,
        amountCents: order.amountCents,
        method: paymentMethod,
      }).catch((e) => console.error("[payment-proof] client payment confirmation email failed", e));
    }

    return NextResponse.json({ ok: true, paymentStatus: "PAID" });
  } catch (err: any) {
    console.error("[payment-proof] error", err);
    const msg = String(err?.message || "");
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se ha podido guardar el justificante en este entorno. Configura BLOB_READ_WRITE_TOKEN en Vercel.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al subir comprobante." },
      { status: 500 }
    );
  }
}
