// lib/delivery-review.ts — Revisión de los archivos del traductor antes de adjuntarlos.
import { prisma } from "@/lib/prisma";
import { splitReviewedFiles } from "@/lib/delivery-files";

export async function splitReviewableFiles<T extends { url: string }>(orderId: string, files: T[]) {
  const [events, assignments] = await Promise.all([
    prisma.orderEvent.findMany({
      where: { orderId, type: { in: ["lavori.entrega_subida", "translator.delivered", "delivery.file_reviewed"] } },
      select: { type: true, payload: true, createdAt: true },
    }),
    prisma.collaboratorAssignment.findMany({
      where: { orderId, deliveredFileUrl: { not: null } },
      select: { deliveredFileUrl: true },
    }),
  ]);
  return splitReviewedFiles(files, events, assignments.map((a) => a.deliveredFileUrl));
}
