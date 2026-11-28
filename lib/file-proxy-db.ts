// Consultas del proxy /api/files: ¿esta URL de blob está atada en BD a este
// pedido / presupuesto? Comparación exacta de la URL guardada (en JSON, strpos).

import { prisma } from "@/lib/prisma";
import { verifyOrderToken } from "@/lib/order-token";
import { requireStaffAccess } from "@/lib/staff-auth";
import { COMPLETION_EVENT } from "@/lib/q-journey";
import type { FileOrderScope, FileProxyDeps } from "@/lib/file-proxy-auth";

const SOURCE_EVENTS = ["presupuesto.submitted", "order.source_document_uploaded"];

async function exists(rows: Promise<unknown[]>): Promise<boolean> {
  return (await rows).length > 0;
}

// Documentos origen: lo que ven el cliente y el colaborador.
function sourceHasBlob(orderId: string, url: string) {
  return exists(prisma.$queryRaw<unknown[]>`
    SELECT 1 FROM "Order" o WHERE o.id = ${orderId} AND (
      EXISTS (SELECT 1 FROM "OrderDocumentItem" i WHERE i."orderId" = o.id AND i."fileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "DocumentAnalysis" d WHERE (d."orderId" = o.id OR d."orderReference" = o.reference) AND d."fileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "OrderEvent" e WHERE e."orderId" = o.id AND e.type = ANY(${SOURCE_EVENTS}) AND strpos(COALESCE(e.payload::text, ''), ${url}) > 0)
    ) LIMIT 1`);
}

// Entregas y justificantes que el cliente recibe (no borrador IA ni entrega sin verificar del colaborador).
function clientHasBlob(orderId: string, url: string) {
  return exists(prisma.$queryRaw<unknown[]>`
    SELECT 1 FROM "Order" o WHERE o.id = ${orderId} AND (
      ${url} IN (o."translatedFileUrl", o."quotePreviewFileUrl", o."finalDeliveryFileUrl", o."shippingProofUrl")
      OR strpos(COALESCE(o."deliveryFilesJson"::text, ''), ${url}) > 0
      OR strpos(COALESCE(o."paymentProofJson"::text, ''), ${url}) > 0
      OR EXISTS (SELECT 1 FROM "OrderDocumentItem" i WHERE i."orderId" = o.id AND i."deliveredFileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "ClientInvoice" c WHERE c."orderId" = o.id AND c."paymentProofUrl" = ${url})
    ) LIMIT 1`);
}

async function orderHasBlob(orderId: string, url: string, scope: FileOrderScope): Promise<boolean> {
  if (await sourceHasBlob(orderId, url)) return true;
  return scope === "client" ? clientHasBlob(orderId, url) : false;
}

async function quoteHasBlob(quoteId: string, url: string): Promise<boolean> {
  const own = await exists(prisma.$queryRaw<unknown[]>`
    SELECT 1 FROM "Quote" q WHERE q.id = ${quoteId} AND (
      q."pdfUrl" = ${url}
      OR EXISTS (SELECT 1 FROM "QuoteLine" l WHERE l."quoteId" = q.id AND l."sourceFileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "StripeEventLog" s WHERE s."quoteId" = q.id AND s."eventType" = ${COMPLETION_EVENT} AND strpos(COALESCE(s.payload::text, ''), ${url}) > 0)
    ) LIMIT 1`);
  if (own) return true;
  const orders = await prisma.order.findMany({ where: { quoteId }, select: { id: true }, take: 20 });
  for (const o of orders) if (await orderHasBlob(o.id, url, "client")) return true;
  return false;
}

// Staff: cualquier blob que la BD conozca (nunca una ruta inventada).
function blobIsKnown(url: string) {
  return exists(prisma.$queryRaw<unknown[]>`
    SELECT 1 WHERE
      EXISTS (SELECT 1 FROM "Order" o WHERE ${url} IN (o."translatedFileUrl", o."quotePreviewFileUrl", o."finalDeliveryFileUrl", o."shippingProofUrl", o."draftFileUrl")
        OR strpos(COALESCE(o."deliveryFilesJson"::text, ''), ${url}) > 0 OR strpos(COALESCE(o."paymentProofJson"::text, ''), ${url}) > 0)
      OR EXISTS (SELECT 1 FROM "OrderDocumentItem" i WHERE ${url} IN (i."fileUrl", i."deliveredFileUrl"))
      OR EXISTS (SELECT 1 FROM "DocumentAnalysis" d WHERE d."fileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "OrderDocument" od WHERE od."fileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "CollaboratorAssignment" a WHERE a."deliveredFileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "ClientInvoice" c WHERE c."paymentProofUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "Expense" x WHERE x."attachmentUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "Quote" q WHERE q."pdfUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "QuoteLine" l WHERE l."sourceFileUrl" = ${url})
      OR EXISTS (SELECT 1 FROM "OrderEvent" e WHERE strpos(COALESCE(e.payload::text, ''), ${url}) > 0)
      OR EXISTS (SELECT 1 FROM "StripeEventLog" s WHERE strpos(COALESCE(s.payload::text, ''), ${url}) > 0)
      OR EXISTS (SELECT 1 FROM "InboundEmail" m WHERE strpos(COALESCE(m."mediaJson"::text, ''), ${url}) > 0)
    LIMIT 1`);
}

export function fileProxyDeps(req: Request): FileProxyDeps {
  return {
    isStaff: async () => (await requireStaffAccess(req)).ok,
    verifyOrderToken,
    findOrderId: async (reference) =>
      (await prisma.order.findUnique({ where: { reference }, select: { id: true } }))?.id ?? null,
    findAssignment: (token) =>
      prisma.collaboratorAssignment.findUnique({
        where: { accessToken: token },
        select: { orderId: true, status: true, updatedAt: true, deliveredFileUrl: true },
      }),
    findQuote: (publicToken) =>
      prisma.quote.findUnique({ where: { publicToken }, select: { id: true, tokenExpiresAt: true, deletedAt: true } }),
    orderHasBlob,
    quoteHasBlob,
    blobIsKnown,
  };
}
