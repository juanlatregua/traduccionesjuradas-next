import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateGeneralUploadFile } from "@/lib/file-security";
import { isBlobConfigured } from "@/lib/payment-config";
import { getOrderByTranslatorToken } from "@/lib/translator-delivery";
import { sendStaffAlertSMS } from "@/lib/sms";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { sendTranslatorDeliveredStaffEmail } from "@/lib/email";

export const runtime = "nodejs";

type Params = { params: { token: string } };

// Subida del traductor asignado (tokenizada, sin login). Aterriza en el pedido
// como PENDIENTE de verificación: NO notifica al cliente ni cambia el workflow.
// Avisa a Juan para que la verifique en el workspace y la envíe.
export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `entrega-upload:${params.token}:${ip}`,
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas subidas. Inténtalo más tarde." },
      { status: 429 }
    );
  }

  const order = await getOrderByTranslatorToken(params.token);
  if (!order) {
    return NextResponse.json({ ok: false, error: "Enlace no válido." }, { status: 404 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    }

    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    if (file.type && !allowedTypes.has(file.type)) {
      return NextResponse.json(
        { ok: false, error: "Solo se aceptan archivos PDF o Word." },
        { status: 400 }
      );
    }

    const validation = await validateGeneralUploadFile(file);
    if (!validation.ok) {
      return NextResponse.json({ ok: false, error: validation.error }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json(
        { ok: false, error: "Archivo demasiado grande (máx 20 MB)." },
        { status: 400 }
      );
    }
    if (!isBlobConfigured()) {
      return NextResponse.json(
        { ok: false, error: "Subida no disponible en este entorno." },
        { status: 503 }
      );
    }

    const pathname = `translator-deliveries/${order.reference}/${Date.now()}-${validation.safeName}`;
    const blob = await put(pathname, file, { access: "public", addRandomSuffix: true });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        translatedFileUrl: blob.url,
        finalFilename: file.name,
        finalMimeType: file.type || "application/octet-stream",
        translatorDeliveredAt: new Date(),
        events: {
          create: {
            type: "translator.delivered",
            message: `El traductor subió la traducción (${file.name}). Pendiente de verificar y enviar.`,
            payload: { fileUrl: blob.url, filename: file.name },
          },
        },
      },
    });

    // Aviso a Juan (SMS + email, fire-and-forget) para que verifique y envíe.
    sendStaffAlertSMS(
      `Traduccion recibida del traductor para ${order.reference}. Verifica y envia al cliente en el workspace.`,
      "translator-delivered"
    ).catch((e) => console.error("[entrega-upload] staff sms failed", e));
    sendEmailWithRetry(() =>
      sendTranslatorDeliveredStaffEmail({
        reference: order.reference,
        clientName: order.clientName,
        filename: file.name,
        fileUrl: blob.url,
      })
    ).catch((e) => console.error("[entrega-upload] staff email failed", e));

    return NextResponse.json({ ok: true, filename: file.name });
  } catch (err: any) {
    console.error("[entrega-upload] error", err);
    return NextResponse.json({ ok: false, error: "Error al subir el archivo." }, { status: 500 });
  }
}
