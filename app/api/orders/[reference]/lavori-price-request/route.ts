import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getDocumentsFromOrder } from "@/lib/collaborators";
import { sendPriceRequestAckToClient } from "@/lib/quote-email";
import {
  lavoriLangFromPair,
  lavoriManualRoute,
  fetchLavoriCartera,
  buildPriceRequestPayload,
  bridgeDescription,
  sendLavoriSolicitud,
  resolveLavoriCandidatos,
  lavoriMemberName,
} from "@/lib/lavori-bridge";
import { packDocsForSobre } from "@/lib/lavori-sobre";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

// Solicitud vía lavori desde la ficha del pedido (adenda 11-ago-2026 + 13-ago):
// - Sin body.paraTi → solicitud de PRECIO (encargo dirigido SIN precio, ref
//   "<ref>-precio"): el candidato ve los documentos y propone su cifra.
// - Con body.paraTi → encargo dirigido CON el precio YA PACTADO fuera (caso
//   Maria/26_DFAA55: acordado por WhatsApp): ref SIN sufijo, al candidato le
//   llega "para ti · X €" y su único paso es aceptar. La foto honesta cuando el
//   precio ya existe — sin ronda de propuesta.
// - body.candidatos (21-ago-2026): ids de la cartera de la lengua elegidos a
//   mano ("todos los de la lengua" o "uno en concreto", p. ej. inglés →
//   Vanessa). Ausente → carril por defecto.
// El aviso le llega desde hola@lavori.es; el motor nunca escribe al traductor.
export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      paraTi?: string | number;
      candidatos?: string[];
    } | null;
    const paraTiNum = Number.parseFloat(String(body?.paraTi ?? ""));
    const paraTi = Number.isFinite(paraTiNum) && paraTiNum > 0 ? paraTiNum.toFixed(2) : null;
    const order = await prisma.order.findUnique({
      where: { reference: params.reference },
      select: {
        id: true,
        reference: true,
        langPair: true,
        words: true,
        amountCents: true,
        deliveryType: true,
        clientName: true,
        clientEmail: true,
        clientPhone: true,
        clientLocale: true,
        events: {
          where: {
            type: {
              in: [
                "presupuesto.submitted",
                "order.source_document_uploaded",
                "lavori.solicitud_precio_enviada",
                "lavori.solicitud_enviada",
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

    // Idempotencia local (la ref es además clave de idempotencia en lavori). El
    // carril pactado y el de solicitud de precio comparten guardia: un pedido con
    // encargo ya enviado (en cualquiera de los dos) no se reenvía.
    const previo = order.events.find(
      (e) => e.type === "lavori.solicitud_precio_enviada" || e.type === "lavori.solicitud_enviada"
    );
    if (previo) {
      const encargoId = (previo.payload as { lavoriEncargoId?: string } | null)?.lavoriEncargoId;
      return NextResponse.json({ ok: true, repetido: true, encargoId: encargoId ?? null });
    }

    // Cartera viva de la lengua (respaldo estático si lavori no responde): el
    // carril fijo si existe; si no, toda la cartera con canal.
    const parsed = lavoriLangFromPair(order.langPair);
    const cartera = parsed ? await fetchLavoriCartera(parsed.lang) : null;
    const route = cartera ? lavoriManualRoute(order.langPair, cartera.miembros) : null;
    if (!route || (route.candidatos.length === 0 && !Array.isArray(body?.candidatos))) {
      return NextResponse.json(
        { ok: false, error: `El par "${order.langPair}" no tiene jurados en el tablón de lavori.` },
        { status: 400 }
      );
    }
    const eleccion = resolveLavoriCandidatos(route, body?.candidatos, cartera!.miembros);
    if (!eleccion.ok) {
      return NextResponse.json({ ok: false, error: eleccion.error }, { status: 400 });
    }
    const candidatos = eleccion.candidatos;

    const docs = getDocumentsFromOrder(order);
    if (docs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "El pedido no tiene documentos enlazados." },
        { status: 400 }
      );
    }

    const sobre = await packDocsForSobre(docs);
    if (!sobre.ok) {
      return NextResponse.json({ ok: false, error: sobre.error }, { status: 400 });
    }
    const documentos = sobre.documentos;

    // Entrega en papel: el candidato debe saber que el original físico viaja por
    // mensajería y que al entregar tendrá que indicar recogida (petición Juan
    // 13-ago-2026, caso rumano: jurada solo válida en papel).
    const especificaciones =
      order.deliveryType === "paper"
        ? "ENTREGA EN PAPEL: la traducción jurada solo vale en original físico. Sube al encargo la copia PDF y tu factura; el original se recoge por mensajería — al subir la entrega indica dirección de recogida y día/horario de disponibilidad."
        : undefined;

    const payload = paraTi
      ? {
          // Encargo dirigido CON precio pactado: ref SIN sufijo (carril pagado).
          ref: order.reference,
          par: route.par,
          descripcion: bridgeDescription({
            docCount: documentos.length,
            words: order.words,
            par: route.par,
          }),
          ...(order.words ? { palabras: order.words } : {}),
          paraTi,
          precioCliente: (order.amountCents / 1.21 / 100).toFixed(2),
          ...(especificaciones ? { especificaciones } : {}),
          candidatos,
          documentos,
        }
      : buildPriceRequestPayload({
          reference: order.reference,
          route: { ...route, candidatos },
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
        type: paraTi ? "lavori.solicitud_enviada" : "lavori.solicitud_precio_enviada",
        message:
          (paraTi
            ? `Encargo dirigido ${route.par} enviado a lavori con precio pactado (${paraTi} € para el traductor); su único paso es aceptar.`
            : `Solicitud de PRECIO ${route.par} enviada a lavori (el traductor ve los documentos y propone su precio).`) +
          ` Candidatos: ${candidatos.map((id) => lavoriMemberName(id, cartera!.miembros)).join(", ")}${eleccion.elegidos ? " (elegidos a mano)" : ""}.`,
        payload: {
          lavoriEncargoId: result.encargoId,
          repetido: result.repetido,
          par: route.par,
          ...(paraTi ? { paraTi } : {}),
          candidatos,
          elegidos: eleccion.elegidos,
          documentos: documentos.length,
          actorEmail: staff.email,
        },
      },
    });

    // Acuse al cliente (24-ago): solo en solicitud de PRECIO. En el carril paraTi
    // el precio ya está pactado fuera — "le indicaremos el precio en breve" sería
    // mentira. Solo si el encargo es NUEVO (un reintento repetido ya acusó).
    // Con await + catch interno: un fallo del acuse no tumba el POST.
    if (!paraTi && !result.repetido) {
      await sendPriceRequestAckToClient({
        name: order.clientName,
        email: order.clientEmail,
        phone: order.clientPhone,
        locale: order.clientLocale,
      });
    }

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
