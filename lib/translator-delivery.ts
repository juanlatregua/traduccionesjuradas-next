// lib/translator-delivery.ts — Canal de subida del traductor asignado.
//
// El traductor (asignado por assignedTo, no necesariamente colaborador con
// CollaboratorAssignment) sube su traducción terminada con un enlace tokenizado
// /entrega/[token]. Aterriza en Order.translatedFileUrl como PENDIENTE (no
// notifica al cliente); Juan la verifica en el workspace y la envía.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Devuelve el token de subida del traductor, creándolo si no existe. null si el
// pedido no existe.
export async function ensureTranslatorUploadToken(reference: string): Promise<string | null> {
  const order = await prisma.order.findUnique({
    where: { reference },
    select: { id: true, translatorUploadToken: true },
  });
  if (!order) return null;
  if (order.translatorUploadToken) return order.translatorUploadToken;
  const token = crypto.randomUUID();
  await prisma.order.update({
    where: { id: order.id },
    data: { translatorUploadToken: token },
  });
  return token;
}

export async function getOrderByTranslatorToken(token: string) {
  const clean = String(token || "").trim();
  if (!clean) return null;
  return prisma.order.findUnique({ where: { translatorUploadToken: clean } });
}
