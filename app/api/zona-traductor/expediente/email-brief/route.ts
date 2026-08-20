// Lectura IA del email de la bandeja para el builder de presupuestos:
// par, urgencia, entrega, documento provisional, notas y preguntas concretas.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { generateEmailBrief, type EmailBriefDoc } from "@/lib/ai/email-brief";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }
  const inboxId = String(body?.inboxId || "").trim();
  if (!inboxId) return NextResponse.json({ ok: false, error: "inboxId requerido." }, { status: 400 });
  const docs: EmailBriefDoc[] = Array.isArray(body?.docs)
    ? body.docs.slice(0, 40).map((d: any) => ({
        fileName: String(d?.fileName || "documento").slice(0, 200),
        documentTypeEs: d?.documentTypeEs ? String(d.documentTypeEs).slice(0, 120) : null,
        sourceLang: d?.sourceLang ? String(d.sourceLang).slice(0, 5) : null,
        targetLang: d?.targetLang ? String(d.targetLang).slice(0, 5) : null,
        words: Number.isFinite(Number(d?.words)) ? Number(d.words) : null,
        pages: Number.isFinite(Number(d?.pages)) ? Number(d.pages) : null,
      }))
    : [];
  try {
    const inbound = await prisma.inboundEmail.findUnique({
      where: { id: inboxId },
      select: { fromName: true, fromEmail: true, subject: true, bodyText: true, bodyPreview: true },
    });
    if (!inbound) return NextResponse.json({ ok: false, error: "Email no encontrado." }, { status: 404 });
    const brief = await generateEmailBrief({
      fromName: inbound.fromName,
      fromEmail: inbound.fromEmail,
      subject: inbound.subject,
      body: inbound.bodyText || inbound.bodyPreview,
      docs,
    });
    return NextResponse.json({ ok: true, brief });
  } catch (err: any) {
    console.error("[expediente:email-brief] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo leer el email." }, { status: 500 });
  }
}
