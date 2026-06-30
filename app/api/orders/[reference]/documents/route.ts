import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateGeneralUploadFile } from "@/lib/file-security";
import { isBlobConfigured } from "@/lib/payment-config";
import { getWorkflowState } from "@/lib/workflow";
import { sendSourceDocsUploadedStaffEmail } from "@/lib/email";
import { sendStaffAlertSMS } from "@/lib/sms";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

const ALLOWED_WORKFLOW_STATES = new Set([
  "BORRADOR",
  "PENDIENTE_REVISION",
  "PRESUPUESTO_ENVIADO",
  "PENDIENTE_PAGO",
  "JUSTIFICANTE_SUBIDO",
  "PAGO_VALIDADO",
  "EN_TRADUCCION",
  "TRADUCIDO_ENTREGADO",
]);

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;

  const rl = await checkRateLimit({
    key: `source-doc:${params.reference}:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas subidas. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        clientEmail: true,
        paymentStatus: true,
        deliveryState: true,
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

    const workflowState = getWorkflowState(order);
    if (!ALLOWED_WORKFLOW_STATES.has(workflowState)) {
      return NextResponse.json(
        { ok: false, error: "Este pedido no admite subida de documentos en su estado actual." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const clientEmailRaw = String(formData.get("clientEmail") || "").trim().toLowerCase();

    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
    ]);
    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Tipo de archivo no permitido para documento fuente." },
        { status: 400 }
      );
    }

    const staffAccess = await requireStaffAccess(req);
    const isStaff = staffAccess.ok;
    const isAuthenticatedOwner = !!sessionEmail && sessionEmail === order.clientEmail.toLowerCase();
    const isGuestOwner = !sessionEmail && !isStaff && !!clientEmailRaw && clientEmailRaw === order.clientEmail.toLowerCase();
    if (!isStaff && !isAuthenticatedOwner && !isGuestOwner) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No autorizado para subir documentos en este pedido. Inicia sesion o indica el email del pedido.",
        },
        { status: 403 }
      );
    }

    const validation = await validateGeneralUploadFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }

    const maxSize = 12 * 1024 * 1024; // 12 MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { ok: false, error: "Archivo demasiado grande (max 12 MB)." },
        { status: 400 }
      );
    }

    if (!isBlobConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error: "La subida de documentos no esta disponible temporalmente en este entorno.",
        },
        { status: 503 }
      );
    }

    const detectedMime = (validation as any)?.detectedMime as string | undefined;
    const pathname = `orders/${params.reference}/documentos/${Date.now()}-${validation.safeName}`;
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: detectedMime || file.type || "application/octet-stream",
    });
    const uploadedAt = new Date().toISOString();
    const uploadedBy = (staffAccess.ok ? staffAccess.email : null) || sessionEmail || clientEmailRaw || null;

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.source_document_uploaded",
        message: "Documento fuente adjuntado para traduccion.",
        payload: {
          fileUrl: blob.url,
          fileName: validation.safeName,
          fileType: detectedMime || file.type || null,
          fileSize: file.size,
          uploadedAt,
          uploadedBy,
        },
      },
    });

    // Aviso al staff SOLO si lo subió el cliente (no cuando lo sube el propio
    // staff). Antes esta vía no notificaba nada → Juan no se enteraba de que el
    // cliente había mandado los documentos para el presupuesto. Best-effort.
    if (!isStaff) {
      sendSourceDocsUploadedStaffEmail({
        reference: order.reference,
        clientEmail: order.clientEmail,
        fileName: validation.safeName ?? file.name,
        fileUrl: blob.url,
      }).catch((e) => console.error("[orders-documents] staff email failed", e));
      sendStaffAlertSMS(
        `Cliente subió documento(s) al pedido ${order.reference} (${order.clientEmail}). Revisa y prepara el presupuesto.`,
        `docs ${order.reference}`
      ).catch(() => {});
    }

    return NextResponse.json({
      ok: true,
      document: {
        fileUrl: blob.url,
        fileName: validation.safeName,
        fileType: detectedMime || file.type || null,
        fileSize: file.size,
        uploadedAt,
      },
    });
  } catch (err: any) {
    console.error("[orders-documents] error", err);
    const msg = String(err?.message || "");
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se ha podido guardar el documento en este entorno. Configura BLOB_READ_WRITE_TOKEN en Vercel.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al subir documento." },
      { status: 500 }
    );
  }
}
