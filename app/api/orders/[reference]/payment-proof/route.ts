import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import type { PaymentMethod } from "@prisma/client";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendPaymentProofUploadedStaffEmail } from "@/lib/email";
import { validatePaymentProofFile } from "@/lib/file-security";
import { getWorkflowState } from "@/lib/workflow";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { isBlobConfigured } from "@/lib/payment-config";
import { hasUploadedSourceDocument, MISSING_SOURCE_DOCUMENT_ERROR } from "@/lib/payment-gating";
import { confirmManualPaymentWithSideEffects } from "@/lib/payments-confirm";
import { issueOrUpdateInvoice } from "@/lib/client-invoice";

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
        clientLocale: true,
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

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const proofHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const proofProviderEventId = `proof:${paymentMethod}:${proofHash}`;

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
        message: "Comprobante de pago adjuntado por el cliente.",
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

    // Cliente de CONFIANZA (B2B recurrente, p.ej. Auream): subir el justificante
    // auto-confirma el pago y emite la factura. Para el resto se mantiene el
    // anti-fraude (queda en JUSTIFICANTE_SUBIDO y lo confirma el staff tras el banco).
    const trustedCustomer = await prisma.customer.findFirst({
      where: {
        email: { equals: order.clientEmail, mode: "insensitive" },
        autoConfirmPayment: true,
      },
      select: {
        name: true,
        email: true,
        companyName: true,
        fiscalName: true,
        nif: true,
        address: true,
        city: true,
        postalCode: true,
        country: true,
      },
    });

    if (trustedCustomer) {
      const method = paymentMethod === "BIZUM" ? "BIZUM" : "TRANSFER";
      const actor = sessionEmail || clientEmailRaw || order.clientEmail;
      let confirmed = false;
      try {
        const confirm = await confirmManualPaymentWithSideEffects(order.reference, method, actor);
        confirmed = confirm.changed;
      } catch (e) {
        // Si la auto-confirmacion falla NO mentimos al cliente: degradamos al
        // flujo manual de abajo (queda JUSTIFICANTE_SUBIDO y lo confirma el staff).
        console.error("[payment-proof] auto-confirm (trusted) failed — degradando a confirmacion manual", e);
      }
      if (confirmed) {
        // Pago YA confirmado. La factura es best-effort: si falla, el pago sigue
        // valido y el staff la emite a mano (issueOrUpdateInvoice es idempotente).
        const nif = trustedCustomer.nif || "";
        await issueOrUpdateInvoice({
          orderId: order.id,
          amountCents: order.amountCents,
          billing: {
            fiscalName:
              trustedCustomer.fiscalName ||
              trustedCustomer.companyName ||
              trustedCustomer.name ||
              order.clientEmail,
            nif,
            address: trustedCustomer.address || "",
            city: trustedCustomer.city || "",
            postalCode: trustedCustomer.postalCode || "",
            country: trustedCustomer.country || "España",
            email: trustedCustomer.email || order.clientEmail,
          },
          origin: "client_portal_trusted",
          // Simplificada solo si no hay NIF y ≤400€ (RD 1619/2012); con NIF, normal.
          simplified: !nif && order.amountCents <= 40000,
        }).catch((e) =>
          console.error("[payment-proof] auto-invoice failed (pago confirmado; emitir a mano)", e)
        );
        return NextResponse.json({ ok: true, paymentStatus: "PAID", autoConfirmed: true });
      }
      // confirmed === false → cae al flujo normal (JUSTIFICANTE_SUBIDO) de abajo.
    }

    await transitionWorkflowState({
      reference: order.reference,
      to: "JUSTIFICANTE_SUBIDO",
      actorEmail: sessionEmail || clientEmailRaw || "guest",
      reason: "Comprobante de pago subido por cliente.",
    }).catch((err) => {
      console.error("[payment-proof] workflow transition failed", err);
    });

    // El comprobante NO marca el pedido PAID automáticamente (audit seguridad
    // 25-jun): subir una imagen no es prueba verificada de pago, y antes
    // cualquiera con la referencia + el email podía dar por pagado un pedido con
    // un justificante falso → traducción gratis. El pedido queda en
    // JUSTIFICANTE_SUBIDO y es el STAFF quien confirma el pago (tras revisar el
    // banco) vía /api/orders/[reference]/confirm-payment, que marca PAID y avisa
    // al cliente. `paymentMethod` queda registrado en el evento de arriba.
    void paymentMethod;
    void proofProviderEventId;

    // Aviso al staff para que verifique el comprobante y confirme el pago.
    sendPaymentProofUploadedStaffEmail({
      reference: order.reference,
      title: order.title,
      amountCents: order.amountCents,
      clientEmail: order.clientEmail,
      proofUrl: blob.url,
      fileName: file.name,
    }).catch((e) => console.error("[payment-proof] staff email failed", e));

    return NextResponse.json({
      ok: true,
      paymentStatus: order.paymentStatus,
      pendingVerification: true,
    });
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
