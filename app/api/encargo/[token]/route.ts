import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAssignmentByToken, getDocumentsFromOrder } from "@/lib/collaborators";
import { submitCollaboratorQuote, submitCollaboratorDelivery } from "@/lib/collaborators";
import { sendQuoteNotificationToAdmin, sendDeliveryNotificationToAdmin } from "@/lib/collaborator-emails";

export const runtime = "nodejs";

type Params = { params: { token: string } };

export async function GET(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `encargo:${params.token}:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas peticiones." }, { status: 429 });
  }

  const assignment = await getAssignmentByToken(params.token);
  if (!assignment) {
    return NextResponse.json({ ok: false, error: "Encargo no encontrado." }, { status: 404 });
  }

  // Expire tokens for completed/rejected assignments older than 30 days
  const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
  if (
    ["DELIVERED", "REJECTED"].includes(assignment.status) &&
    assignment.updatedAt < new Date(Date.now() - EXPIRY_MS)
  ) {
    return NextResponse.json({ ok: false, error: "Este enlace ha expirado." }, { status: 410 });
  }

  const documents = getDocumentsFromOrder(assignment.order);

  return NextResponse.json({
    ok: true,
    assignment: {
      id: assignment.id,
      status: assignment.status,
      adminNotes: assignment.adminNotes,
      quotedPriceCents: assignment.quotedPriceCents,
      quotedDeadline: assignment.quotedDeadline,
      collaboratorNotes: assignment.collaboratorNotes,
      rejectionReason: assignment.rejectionReason,
      revisionReason: assignment.revisionReason,
      deliveredFilename: assignment.deliveredFilename,
      deliveredAt: assignment.deliveredAt,
    },
    order: {
      reference: assignment.order.reference,
      title: assignment.order.title,
      langPair: assignment.order.langPair,
    },
    collaborator: {
      fullName: assignment.collaborator.fullName,
    },
    documents,
  });
}

type PostBody = {
  action: "quote" | "delivery";
  priceCents?: number;
  deadline?: string;
  notes?: string;
  fileUrl?: string;
  fileKey?: string;
  filename?: string;
  mimeType?: string;
};

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `encargo-post:${params.token}:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Demasiadas peticiones." }, { status: 429 });
  }

  const assignment = await getAssignmentByToken(params.token);
  if (!assignment) {
    return NextResponse.json({ ok: false, error: "Encargo no encontrado." }, { status: 404 });
  }

  const body = (await req.json()) as PostBody;

  if (body.action === "quote") {
    if (assignment.status !== "REQUESTED" && assignment.status !== "QUOTE_REVISION_REQUESTED") {
      return NextResponse.json({ ok: false, error: "Este encargo ya no acepta presupuestos." }, { status: 400 });
    }
    if (!body.priceCents || body.priceCents <= 0) {
      return NextResponse.json({ ok: false, error: "El precio es obligatorio." }, { status: 400 });
    }
    if (!body.deadline) {
      return NextResponse.json({ ok: false, error: "El plazo es obligatorio." }, { status: 400 });
    }
    const deadline = new Date(body.deadline);
    if (isNaN(deadline.getTime())) {
      return NextResponse.json({ ok: false, error: "Fecha de plazo no válida." }, { status: 400 });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deadline < today) {
      return NextResponse.json({ ok: false, error: "La fecha límite no puede ser en el pasado." }, { status: 400 });
    }

    const updated = await submitCollaboratorQuote(
      params.token,
      body.priceCents,
      deadline,
      body.notes
    );

    // Audit event
    await prisma.orderEvent.create({
      data: {
        orderId: assignment.order.id,
        type: "collaborator.quote.submitted",
        message: `${updated.collaborator.fullName} envió presupuesto: ${(body.priceCents / 100).toFixed(2)}€.`,
        payload: {
          assignmentId: updated.id,
          priceCents: body.priceCents,
          deadline: deadline.toISOString(),
        },
      },
    });

    // Notify admin
    sendQuoteNotificationToAdmin({
      collaboratorName: updated.collaborator.fullName,
      orderReference: updated.order.reference,
      orderTitle: updated.order.title,
      priceCents: body.priceCents,
      deadline: deadline.toLocaleDateString("es-ES"),
      collaboratorNotes: body.notes,
      assignmentId: updated.id,
    }).catch((err) => {
      console.error("[encargo] admin quote notification failed", err);
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "delivery") {
    if (assignment.status !== "ACCEPTED") {
      return NextResponse.json({ ok: false, error: "Este encargo no acepta entregas en este momento." }, { status: 400 });
    }
    if (!body.fileUrl || !body.fileKey || !body.filename || !body.mimeType) {
      return NextResponse.json({ ok: false, error: "Faltan datos del archivo." }, { status: 400 });
    }

    const updated = await submitCollaboratorDelivery(
      params.token,
      body.fileUrl,
      body.fileKey,
      body.filename,
      body.mimeType
    );

    // Audit event
    await prisma.orderEvent.create({
      data: {
        orderId: assignment.order.id,
        type: "collaborator.delivery.submitted",
        message: `${updated.collaborator.fullName} entregó la traducción: ${body.filename}.`,
        payload: {
          assignmentId: updated.id,
          fileUrl: body.fileUrl,
          filename: body.filename,
        },
      },
    });

    // Notify admin
    sendDeliveryNotificationToAdmin({
      collaboratorName: updated.collaborator.fullName,
      collaboratorEmail: updated.collaborator.email,
      orderReference: updated.order.reference,
      filename: body.filename,
      fileUrl: body.fileUrl,
    }).catch((err) => {
      console.error("[encargo] admin delivery notification failed", err);
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "Acción no reconocida." }, { status: 400 });
}
