// app/api/expediente/submit/route.ts
// Intake PÚBLICO de expediente (4+ documentos). El cliente sube los archivos a
// Vercel Blob (client-side) y aquí registramos todos en un solo request como un
// grupo (sessionToken = exp:REF). NO se analiza con IA todavía: el análisis se
// difiere al staff cuando abre el expediente en /zona-traductor/presupuesto
// (coste de IA solo cuando Juan actúa). Avisa al cliente y al staff por email.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createExpedienteRef, createExpedienteToken } from "@/lib/expediente-token";
import { sendExpedienteReceiptEmail, sendExpedienteStaffEmail } from "@/lib/emails/expediente";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { sendStaffAlertSMS } from "@/lib/sms";

export const runtime = "nodejs";

const MAX_DOCS = 40;

function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // Pocos expedientes por IP/día: anti-abuso suave.
  const rl = await checkRateLimit({
    key: `expediente:submit:${ip}`,
    limit: 6,
    windowMs: 24 * 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Has enviado demasiados expedientes hoy. Inténtalo mañana o escríbenos por WhatsApp." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const clientName = String(body?.clientName || "").trim();
  const clientEmail = String(body?.clientEmail || "").trim().toLowerCase();
  const clientPhone = String(body?.clientPhone || "").trim() || null;
  const notes = String(body?.notes || "").trim().slice(0, 1000) || null;
  const gdprConsent = Boolean(body?.gdprConsent);
  const documents: any[] = Array.isArray(body?.documents) ? body.documents : [];

  if (!clientName) return NextResponse.json({ ok: false, error: "Indica tu nombre." }, { status: 400 });
  if (!validEmail(clientEmail)) return NextResponse.json({ ok: false, error: "Email no válido." }, { status: 400 });
  if (!gdprConsent) return NextResponse.json({ ok: false, error: "Debes aceptar el tratamiento de datos." }, { status: 400 });
  if (documents.length === 0) return NextResponse.json({ ok: false, error: "Sube al menos un documento." }, { status: 400 });
  if (documents.length > MAX_DOCS) {
    return NextResponse.json({ ok: false, error: `Máximo ${MAX_DOCS} documentos por expediente.` }, { status: 400 });
  }

  const clean = documents
    .map((d) => ({
      blobUrl: String(d?.blobUrl || ""),
      fileName: String(d?.fileName || "documento").slice(0, 255),
      fileSize: Number(d?.fileSize) || 0,
      mimeType: String(d?.mimeType || "application/octet-stream"),
    }))
    .filter((d) => d.blobUrl);

  if (clean.length === 0) {
    return NextResponse.json({ ok: false, error: "No se recibió ningún archivo válido." }, { status: 400 });
  }

  const ref = createExpedienteRef();
  const token = createExpedienteToken(ref);
  const sessionToken = `exp:${ref}`;

  try {
    await prisma.documentAnalysis.createMany({
      data: clean.map((d) => ({
        fileName: d.fileName,
        fileUrl: d.blobUrl,
        fileSize: d.fileSize,
        mimeType: d.mimeType,
        sessionToken,
        clientName,
        clientEmail,
        clientPhone,
        gdprConsent: true,
        gdprConsentAt: new Date(),
        status: "UPLOADED",
      })),
    });
  } catch (err: any) {
    console.error("[expediente/submit] createMany error:", err?.message);
    return NextResponse.json({ ok: false, error: "No se pudo registrar el expediente." }, { status: 500 });
  }

  // Emails fire-and-forget (no bloquean la respuesta) con retry: si agotan
  // reintentos persisten en FailedEmail y el digest diario los reporta.
  sendEmailWithRetry(() =>
    sendExpedienteReceiptEmail({ clientEmail, clientName, ref, token, documentCount: clean.length })
  ).catch((e) => console.error("[expediente/submit] receipt email error:", e?.message));
  sendEmailWithRetry(() =>
    sendExpedienteStaffEmail({ ref, clientName, clientEmail, clientPhone, documentCount: clean.length, notes })
  ).catch((e) => console.error("[expediente/submit] staff email error:", e?.message));
  // SMS al staff: nueva solicitud de presupuesto (antes solo había email).
  sendStaffAlertSMS(
    `Nueva solicitud (expediente ${ref}) de ${clientName} <${clientEmail}>, ${clean.length} doc(s). Preparar presupuesto.`,
    `expediente ${ref}`
  ).catch(() => {});

  return NextResponse.json({ ok: true, ref, token });
}
