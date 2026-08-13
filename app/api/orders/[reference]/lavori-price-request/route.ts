import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getDocumentsFromOrder } from "@/lib/collaborators";
import {
  lavoriRouteFromPair,
  buildPriceRequestPayload,
  fetchDocAsBase64,
  sendLavoriSolicitud,
} from "@/lib/lavori-bridge";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

// Solicitud de PRECIO vía lavori (adenda 11-ago-2026 del contrato Fase 1): manda
// los documentos del pedido al candidato del par como encargo dirigido SIN precio;
// el aviso le llega desde hola@lavori.es y su respuesta vuelve por el chat de
// lavori (Fase 1.5: vuelta estructurada). El motor nunca escribe al traductor.
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
        langPair: true,
        words: true,
        deliveryType: true,
        events: {
          where: {
            type: {
              in: [
                "presupuesto.submitted",
                "order.source_document_uploaded",
                "lavori.solicitud_precio_enviada",
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: { type: true, payload: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    // Idempotencia local (el ref -precio es además clave de idempotencia en lavori).
    const previo = order.events.find((e) => e.type === "lavori.solicitud_precio_enviada");
    if (previo) {
      const encargoId = (previo.payload as { lavoriEncargoId?: string } | null)?.lavoriEncargoId;
      return NextResponse.json({ ok: true, repetido: true, encargoId: encargoId ?? null });
    }

    const route = lavoriRouteFromPair(order.langPair);
    if (!route) {
      return NextResponse.json(
        { ok: false, error: `El par "${order.langPair}" no tiene candidatos en lavori.` },
        { status: 400 }
      );
    }

    const docs = getDocumentsFromOrder(order);
    if (docs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "El pedido no tiene documentos enlazados." },
        { status: 400 }
      );
    }

    const documentos = [];
    for (const doc of docs) {
      const empaquetado = await fetchDocAsBase64(doc);
      if (empaquetado) documentos.push(empaquetado);
    }
    if (documentos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se pudo descargar ningún documento del pedido." },
        { status: 400 }
      );
    }

    // Entrega en papel: el candidato debe saber que el original físico viaja por
    // mensajería y que al entregar tendrá que indicar recogida (petición Juan
    // 13-ago-2026, caso rumano: jurada solo válida en papel).
    const especificaciones =
      order.deliveryType === "paper"
        ? "ENTREGA EN PAPEL: la traducción jurada solo vale en original físico. Sube al encargo la copia PDF y tu factura; el original se recoge por mensajería — al subir la entrega indica dirección de recogida y día/horario de disponibilidad."
        : undefined;

    const payload = buildPriceRequestPayload({
      reference: order.reference,
      route,
      words: order.words,
      especificaciones,
      documentos,
    });
    const result = await sendLavoriSolicitud(payload);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 502 });
    }

    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "lavori.solicitud_precio_enviada",
        message: `Solicitud de PRECIO ${route.par} enviada a lavori (el traductor ve los documentos y propone su precio).`,
        payload: {
          lavoriEncargoId: result.encargoId,
          repetido: result.repetido,
          par: route.par,
          candidatos: route.candidatos,
          documentos: documentos.length,
          actorEmail: staff.email,
        },
      },
    });

    return NextResponse.json(
      { ok: true, encargoId: result.encargoId, repetido: result.repetido },
      { status: 201 }
    );
  } catch (err) {
    console.error("[lavori-price-request] error", err);
    return NextResponse.json(
      { ok: false, error: "Error al enviar la solicitud de precio." },
      { status: 500 }
    );
  }
}
