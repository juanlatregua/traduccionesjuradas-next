// lib/order-extend.ts — AMPLIAR un pedido ya cobrado (Juan, 3-sep-2026).
//
// El cliente añade un documento después de pagar. El pedido cobrado NO se toca
// (1 pedido = 1 factura, freno de margen por pedido): se prepara un presupuesto
// HERMANO con los documentos que llegaron después del pago y, cuando su pedido
// nazca, se agrupará solo con el padre en el mismo trámite (lib/order-case.ts).
//
// Aquí solo se prepara el LOTE de entrada (DocumentAnalysis con sessionToken
// exp:AMPL-<padre>-…) y se devuelve el enlace al constructor con el cliente, el
// par y la entrega ya puestos. El precio lo decide Juan en el constructor.

import { prisma } from "@/lib/prisma";
import { buildExtensionLote } from "@/lib/order-case-logic";

export async function prepareOrderExtension(input: { reference: string; actorEmail: string }) {
  const order = await prisma.order.findUnique({
    where: { reference: input.reference },
    select: {
      id: true,
      reference: true,
      clientEmail: true,
      clientName: true,
      clientPhone: true,
      langPair: true,
      deliveryType: true,
      paidAt: true,
      paymentStatus: true,
      events: { orderBy: { createdAt: "asc" }, select: { type: true, payload: true, createdAt: true } },
    },
  });
  if (!order) throw new Error("Pedido no encontrado.");

  // Documentos que llegaron DESPUÉS del pago (si no hay pago, todos los subidos
  // por evento): son los candidatos naturales de la ampliación. Si no hay
  // ninguno, el constructor se abre igual y Juan suelta los archivos.
  const since = order.paidAt ? new Date(order.paidAt).getTime() : 0;
  const recent = order.events
    .filter((e) => e.type === "order.source_document_uploaded" && new Date(e.createdAt).getTime() > since)
    .map((e) => {
      const p = (e.payload || {}) as Record<string, unknown>;
      return {
        name: String(p.fileName || "documento"),
        url: p.fileUrl ? String(p.fileUrl) : "",
        size: Number(p.fileSize) || 0,
        mimeType: p.fileType ? String(p.fileType) : "application/octet-stream",
      };
    })
    .filter((d) => d.url);

  const lote = buildExtensionLote(order.reference);
  if (recent.length > 0) {
    await prisma.documentAnalysis.createMany({
      data: recent.map((d) => ({
        fileName: d.name,
        fileUrl: d.url,
        fileSize: d.size,
        mimeType: d.mimeType,
        sessionToken: `exp:${lote}`,
        clientEmail: order.clientEmail,
        clientName: order.clientName || null,
        clientPhone: order.clientPhone || null,
        gdprConsent: true,
        gdprConsentAt: new Date(),
        status: "UPLOADED",
      })),
    });
  }

  await prisma.orderEvent.create({
    data: {
      orderId: order.id,
      type: "order.extension_prepared",
      message: `Ampliación preparada por ${input.actorEmail}: lote ${lote} con ${recent.length} documento(s) llegado(s) tras el pago.`,
      payload: { lote, docs: recent.map((d) => d.name), actorEmail: input.actorEmail },
    },
  });

  const q = new URLSearchParams({ exp: lote });
  if (order.clientEmail) q.set("customerEmail", order.clientEmail);
  if (order.clientName) q.set("customerName", order.clientName);
  if (order.clientPhone) q.set("customerPhone", order.clientPhone);
  const pair = String(order.langPair || "").replace("->", "-");
  if (/^[a-z]{2}-[a-z]{2}$/i.test(pair)) q.set("langPair", pair.toLowerCase());
  if (order.deliveryType === "paper") q.set("deliveryType", "PAPER_SHIP");
  q.set("lineDescription", `Ampliación del pedido ${order.reference}`);

  return { lote, docsCount: recent.length, builderUrl: `/zona-traductor/presupuesto?${q.toString()}` };
}
