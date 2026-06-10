import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getCollaboratorsByLanguage, getDocumentsFromOrder } from "@/lib/collaborators";
import { sendFriendlyQuoteRequest } from "@/lib/collaborator-emails";
import { getSourceLang, isQuoteExcludedLang, isFrenchSourceLang } from "@/lib/quotes";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

// Estados reutilizables: si el colaborador ya tiene una asignación cerrada en
// negativo, la reciclamos en vez de violar el @@unique([orderId,collaboratorId]).
const REUSABLE_STATUSES = ["REJECTED", "QUOTE_REVISION_REQUESTED"];

export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        title: true,
        langPair: true,
        events: {
          where: { type: { in: ["presupuesto.submitted", "order.source_document_uploaded"] } },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const lang = getSourceLang(order.langPair);
    if (!lang) {
      return NextResponse.json(
        { ok: false, error: "No se pudo determinar el idioma origen del pedido." },
        { status: 400 }
      );
    }
    if (isQuoteExcludedLang(lang)) {
      return NextResponse.json(
        { ok: false, error: `El idioma "${lang}" no admite cotización competitiva.` },
        { status: 400 }
      );
    }

    const documents = getDocumentsFromOrder(order);

    // --- FR: asignación directa a Juan Silva, auto-aceptada (no concurso) ---
    if (isFrenchSourceLang(lang)) {
      const frCollaborators = await getCollaboratorsByLanguage("fr");
      const frCollaborator = frCollaborators[0];
      if (!frCollaborator) {
        return NextResponse.json(
          { ok: false, error: "No hay colaborador activo de francés configurado." },
          { status: 400 }
        );
      }

      const assignment = await prisma.collaboratorAssignment.upsert({
        where: {
          orderId_collaboratorId: { orderId: order.id, collaboratorId: frCollaborator.id },
        },
        create: {
          orderId: order.id,
          collaboratorId: frCollaborator.id,
          status: "ACCEPTED",
          acceptedAt: new Date(),
        },
        update: {
          status: "ACCEPTED",
          acceptedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
        },
        include: { collaborator: { select: { fullName: true, email: true } } },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "collaborator.quote_request_batch",
          message: `FR directo: ${assignment.collaborator.fullName} asignado y aceptado (sin concurso).`,
          payload: {
            lang,
            direct: true,
            notified: [
              {
                collaboratorId: frCollaborator.id,
                name: assignment.collaborator.fullName,
                email: assignment.collaborator.email,
                status: "ACCEPTED",
              },
            ],
            actorEmail: staff.email,
          },
        },
      });

      return NextResponse.json({ ok: true, direct: true, assignments: [assignment] }, { status: 201 });
    }

    // --- Resto: broadcast a TODOS los colaboradores activos del idioma ---
    const collaborators = await getCollaboratorsByLanguage(lang);
    if (collaborators.length === 0) {
      return NextResponse.json(
        { ok: false, error: `No hay colaboradores activos para el idioma "${lang}".` },
        { status: 400 }
      );
    }

    const existing = await prisma.collaboratorAssignment.findMany({
      where: { orderId: order.id },
      select: { id: true, collaboratorId: true, status: true },
    });
    const existingByCollaborator = new Map(existing.map((a) => [a.collaboratorId, a]));

    const notified: Array<{ assignmentId: string; collaboratorId: string; name: string; email: string; reused: boolean }> = [];

    for (const collaborator of collaborators) {
      const prev = existingByCollaborator.get(collaborator.id);

      // Ya tiene una asignación viva (REQUESTED/QUOTED/ACCEPTED/DELIVERED) → no re-broadcast.
      if (prev && !REUSABLE_STATUSES.includes(prev.status)) {
        continue;
      }

      let assignment;
      if (prev) {
        // Reciclar fila cerrada en negativo: resetear a REQUESTED.
        assignment = await prisma.collaboratorAssignment.update({
          where: { id: prev.id },
          data: {
            status: "REQUESTED",
            quotedPriceCents: null,
            quotedDeadline: null,
            quotedAt: null,
            collaboratorNotes: null,
            acceptedAt: null,
            rejectedAt: null,
            rejectionReason: null,
            revisionReason: null,
          },
        });
      } else {
        assignment = await prisma.collaboratorAssignment.create({
          data: { orderId: order.id, collaboratorId: collaborator.id, status: "REQUESTED" },
        });
      }

      sendFriendlyQuoteRequest({
        collaboratorName: collaborator.fullName,
        collaboratorEmail: collaborator.email,
        orderReference: order.reference,
        orderTitle: order.title,
        langPair: order.langPair,
        accessToken: assignment.accessToken,
        documents,
      }).catch((err) => {
        console.error("[quote-request-batch] email send failed", collaborator.email, err);
      });

      notified.push({
        assignmentId: assignment.id,
        collaboratorId: collaborator.id,
        name: collaborator.fullName,
        email: collaborator.email,
        reused: Boolean(prev),
      });
    }

    if (notified.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Todos los colaboradores del idioma ya tienen un encargo activo en este pedido." },
        { status: 409 }
      );
    }

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "collaborator.quote_request_batch",
        message: `Cotización solicitada a ${notified.length} colaborador(es) de ${lang}: ${notified.map((n) => n.name).join(", ")}.`,
        payload: {
          lang,
          direct: false,
          notified,
          actorEmail: staff.email,
        },
      },
    });

    return NextResponse.json({ ok: true, direct: false, notified }, { status: 201 });
  } catch (err: any) {
    if (err?.code === "P2025") {
      return NextResponse.json({ ok: false, error: "Recurso no encontrado." }, { status: 404 });
    }
    console.error("[quote-request-batch] error", err);
    return NextResponse.json({ ok: false, error: "Error al solicitar cotizaciones." }, { status: 500 });
  }
}
