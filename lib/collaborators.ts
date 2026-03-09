import { prisma } from "@/lib/prisma";

export async function getActiveCollaborators() {
  return prisma.collaborator.findMany({
    where: { active: true },
    orderBy: { fullName: "asc" },
  });
}

export async function getCollaboratorsByLanguage(lang: string) {
  return prisma.collaborator.findMany({
    where: {
      active: true,
      languages: { has: lang.toLowerCase() },
    },
    orderBy: { fullName: "asc" },
  });
}

export async function getAssignmentByToken(token: string) {
  return prisma.collaboratorAssignment.findUnique({
    where: { accessToken: token },
    include: {
      order: {
        select: {
          id: true,
          reference: true,
          title: true,
          langPair: true,
          clientEmail: true,
          clientName: true,
          amountCents: true,
          events: {
            where: {
              type: {
                in: [
                  "presupuesto.submitted",
                  "order.source_document_uploaded",
                ],
              },
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
      collaborator: {
        select: {
          id: true,
          fullName: true,
          email: true,
          supplierType: true,
          companyName: true,
        },
      },
    },
  });
}

export async function createAssignment(
  orderId: string,
  collaboratorId: string,
  adminNotes?: string
) {
  return prisma.collaboratorAssignment.create({
    data: {
      orderId,
      collaboratorId,
      adminNotes: adminNotes || null,
    },
    include: {
      collaborator: true,
      order: {
        select: {
          reference: true,
          title: true,
          langPair: true,
        },
      },
    },
  });
}

export async function submitCollaboratorQuote(
  token: string,
  priceCents: number,
  deadline: Date,
  notes?: string
) {
  return prisma.collaboratorAssignment.update({
    where: { accessToken: token, status: "REQUESTED" },
    data: {
      status: "QUOTED",
      quotedPriceCents: priceCents,
      quotedDeadline: deadline,
      quotedAt: new Date(),
      collaboratorNotes: notes || null,
    },
    include: {
      collaborator: { select: { fullName: true, email: true } },
      order: { select: { reference: true, title: true } },
    },
  });
}

export async function acceptCollaboratorQuote(assignmentId: string) {
  return prisma.collaboratorAssignment.update({
    where: { id: assignmentId, status: "QUOTED" },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
    },
    include: {
      collaborator: {
        select: {
          fullName: true,
          email: true,
          supplierType: true,
          companyName: true,
        },
      },
      order: {
        select: {
          id: true,
          reference: true,
          title: true,
          amountCents: true,
        },
      },
    },
  });
}

export async function rejectCollaboratorQuote(
  assignmentId: string,
  reason?: string
) {
  return prisma.collaboratorAssignment.update({
    where: { id: assignmentId, status: "QUOTED" },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason || null,
    },
    include: {
      collaborator: { select: { fullName: true, email: true } },
      order: { select: { id: true, reference: true } },
    },
  });
}

export async function submitCollaboratorDelivery(
  token: string,
  fileUrl: string,
  fileKey: string,
  filename: string,
  mimeType: string
) {
  return prisma.collaboratorAssignment.update({
    where: { accessToken: token, status: "ACCEPTED" },
    data: {
      status: "DELIVERED",
      deliveredFileUrl: fileUrl,
      deliveredFileKey: fileKey,
      deliveredFilename: filename,
      deliveredMimeType: mimeType,
      deliveredAt: new Date(),
    },
    include: {
      collaborator: { select: { fullName: true, email: true } },
      order: { select: { reference: true, title: true } },
    },
  });
}

export function getDocumentsFromOrder(order: {
  events: Array<{ type: string; payload: unknown }>;
}) {
  const docs: Array<{ name: string; url: string; type: string }> = [];
  const seen = new Set<string>();

  for (const event of order.events) {
    if (event.type === "order.source_document_uploaded") {
      const payload = event.payload as Record<string, unknown>;
      const url = String(payload?.fileUrl || "");
      if (url && !seen.has(url)) {
        seen.add(url);
        docs.push({
          name: String(payload?.fileName || "Documento"),
          url,
          type: String(payload?.fileType || "application/octet-stream"),
        });
      }
    }
    if (event.type === "presupuesto.submitted") {
      const payload = event.payload as Record<string, unknown>;
      const files = Array.isArray(payload?.files) ? payload.files : [];
      for (const file of files) {
        const f = file as Record<string, unknown>;
        const url = String(f?.url || "");
        if (url && !seen.has(url)) {
          seen.add(url);
          docs.push({
            name: String(f?.name || "Documento"),
            url,
            type: String(f?.type || "application/octet-stream"),
          });
        }
      }
    }
  }

  return docs;
}
