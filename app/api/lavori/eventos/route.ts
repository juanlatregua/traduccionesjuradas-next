import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { notifyClientTranslationStarted } from "@/lib/orders";
import { applyAcceptedQuoteSideEffects } from "@/lib/collaborators";
import { LAVORI_MEMBER_COLLABORATOR_EMAIL, SOBRE_MAX_RAW_BYTES } from "@/lib/lavori-bridge";

export const runtime = "nodejs";

/* Fase 1.5 del puente — VUELTA lavori→motor (contrato propuesto 11-ago-2026).
   Un solo endpoint, auth simétrica a la ida (MOTOR_LAVORI_SECRET):
   - precio_propuesto  → OrderEvent + aviso a staff con el precio y el neto 75/25 sugerido
   - encargo_aceptado  → asignación automática del colaborador (cierra la vuelta manual v1)
   - factura_subida    → Expense pendiente de revisión en contabilidad
   - entrega_subida    → (Fase 2, contrato 12-ago) traducción al expediente; el envío
     al cliente es SIEMPRE el botón "revisar y enviar" de la ficha (opción B de Juan)
   Idempotencia por (evento, encargoId) dentro del pedido — para entrega_subida
   entra también datos.adjuntoId: una entrega de N ficheros son N eventos y una
   corrección posterior viaja como evento nuevo sin pisar los anteriores. */

const STAFF_ALERT_EMAIL = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";

const EVENTO_TIPOS = ["precio_propuesto", "encargo_aceptado", "factura_subida", "entrega_subida"] as const;
type EventoTipo = (typeof EVENTO_TIPOS)[number];

function hasAuth(req: Request): boolean {
  const secret = process.env.MOTOR_LAVORI_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

function eurosToCents(value: unknown): number | null {
  const n = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export async function POST(req: Request) {
  if (!hasAuth(req)) {
    return NextResponse.json({ ok: false, error: "no autorizado" }, { status: 401 });
  }

  let body: {
    evento?: string;
    motorRef?: string;
    encargoId?: string;
    ts?: string;
    datos?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const evento = String(body.evento || "") as EventoTipo;
  const motorRef = String(body.motorRef || "").trim();
  const encargoId = String(body.encargoId || "").trim();
  if (!EVENTO_TIPOS.includes(evento)) {
    return NextResponse.json({ ok: false, error: "evento desconocido" }, { status: 400 });
  }
  if (!motorRef) return NextResponse.json({ ok: false, error: "motorRef obligatoria" }, { status: 400 });
  if (!encargoId) return NextResponse.json({ ok: false, error: "encargoId obligatorio" }, { status: 400 });
  const datos = body.datos ?? {};

  // Las solicitudes de precio viajan con ref "<referencia>-precio".
  const reference = motorRef.replace(/-precio$/, "");
  const order = await prisma.order.findUnique({
    where: { reference },
    select: { id: true, reference: true, langPair: true, paymentStatus: true, amountCents: true },
  });
  if (!order) {
    // Solicitud de precio de un LEAD (WhatsApp, sin pedido): ancla propia.
    const lead = await prisma.lavoriPriceRequest.findUnique({ where: { ref: reference } });
    if (lead) return handleLeadEvento({ lead, evento, encargoId, motorRef, datos });
    return NextResponse.json({ ok: false, error: `pedido "${reference}" no encontrado` }, { status: 404 });
  }

  const eventType = `lavori.${evento}`;
  const adjuntoId = evento === "entrega_subida" ? String(datos.adjuntoId || "").trim() : null;
  if (evento === "entrega_subida" && !adjuntoId) {
    return NextResponse.json({ ok: false, error: "datos.adjuntoId obligatorio" }, { status: 400 });
  }
  const previo = await prisma.orderEvent.findFirst({
    where: {
      orderId: order.id,
      type: eventType,
      AND: [
        { payload: { path: ["encargoId"], equals: encargoId } },
        ...(adjuntoId ? [{ payload: { path: ["adjuntoId"], equals: adjuntoId } }] : []),
      ],
    },
    select: { id: true },
  });
  if (previo) {
    return NextResponse.json({ ok: true, repetido: true });
  }

  const ficha = `https://www.traduccionesjuradas.net/zona-traductor/pedido/${order.reference}`;
  const staffMail = (subject: string, lines: string[]) =>
    sendMail({
      to: STAFF_ALERT_EMAIL,
      subject,
      text: lines.join("\n"),
      html: lines.map((l) => `<p>${l}</p>`).join(""),
    }).catch((err) => console.error("[lavori-eventos] staff mail failed", err));

  try {
    if (evento === "precio_propuesto") {
      const precioCents = eurosToCents(datos.precio);
      if (precioCents === null) {
        return NextResponse.json({ ok: false, error: "datos.precio inválido" }, { status: 400 });
      }
      // Sugerencia modelo 75/25: si el traductor cobra el 75% del neto, el neto
      // de cliente que lo respeta es precio/0.75 (solo orientativo para staff).
      const netoSugerido = (precioCents / 0.75 / 100).toFixed(2);
      const precio = (precioCents / 100).toFixed(2);
      const miembro = String(datos.miembroNombre || datos.miembroId || "el traductor");
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          message: `lavori: ${miembro} propone ${precio} € (${datos.plazoDias ? `plazo ${datos.plazoDias} días` : "sin plazo"}). Neto cliente 75/25 sugerido: ${netoSugerido} €.`,
          payload: { encargoId, motorRef, ...datos, precioCents, netoSugeridoEur: netoSugerido },
        },
      });
      // Auto-aceptación "dinero dentro" (13-ago-2026, caso 26_DFAA55): si el
      // pedido YA está pagado y la cifra del traductor cabe en el modelo 75/25
      // sobre lo cobrado, se acepta sola hacia lavori. Si pide más, decide staff.
      const paraTiModeloCents = Math.round((order.amountCents / 1.21) * 0.75);
      const yaAceptado = await prisma.orderEvent.findFirst({
        where: {
          orderId: order.id,
          type: { in: ["lavori.precio_aceptado_enviado", "lavori.precio_aceptado_conflicto"] },
        },
        select: { id: true },
      });
      const autoAceptar =
        order.paymentStatus === "PAID" && !yaAceptado && precioCents <= paraTiModeloCents;

      await staffMail(`💶 Precio de ${miembro} para ${order.reference}: ${precio} €`, [
        `${miembro} ha propuesto ${precio} € por el encargo de lavori (${encargoId}).`,
        datos.plazoDias ? `Plazo propuesto: ${datos.plazoDias} días.` : "Sin plazo indicado.",
        `Neto de cliente sugerido por el modelo 75/25: ${netoSugerido} € (+ IVA y envío).`,
        datos.notas ? `Notas: ${String(datos.notas)}` : "",
        autoAceptar
          ? `El pedido ya está pagado y la cifra cabe en el modelo (tope ${(paraTiModeloCents / 100).toFixed(2)} €): se acepta AUTOMÁTICAMENTE hacia lavori.`
          : order.paymentStatus === "PAID" && !yaAceptado
            ? `⚠ El pedido ya está pagado pero la cifra SUPERA el modelo 75/25 (tope ${(paraTiModeloCents / 100).toFixed(2)} €): NO se auto-acepta — decide tú (coordínalo por lavori o ajusta el precio con el traductor).`
            : "",
        `Ficha: ${ficha}`,
      ].filter(Boolean));

      if (autoAceptar) {
        const { deliverPrecioAceptado } = await import("@/lib/workflow-server");
        await deliverPrecioAceptado({
          orderId: order.id,
          reference: order.reference,
          ref: motorRef, // la motor_ref EXACTA con la que llegó la propuesta
          precioCents,
          auto: true,
        });
      }
    }

    if (evento === "encargo_aceptado") {
      const miembroId = String(datos.miembroId || "");
      const email = LAVORI_MEMBER_COLLABORATOR_EMAIL[miembroId];
      const collaborator = email
        ? await prisma.collaborator.findUnique({ where: { email } })
        : null;
      const miembro = String(datos.miembroNombre || miembroId || "el traductor");

      if (collaborator) {
        // Cifra que la casa debe al jurado: la aceptada (Fase 2, precio_aceptado_enviado)
        // o la del dirigido (solicitud_enviada.paraTi). Con ella la aceptación deja
        // coste, devengo en su cuenta y snapshot de margen por el chokepoint de
        // siempre (25-ago-2026, caso 26_34F612: antes la asignación automática
        // quedaba sin precio, sin isWinning y sin devengo).
        const recent = await prisma.orderEvent.findMany({
          where: { orderId: order.id, type: { in: ["lavori.precio_aceptado_enviado", "lavori.solicitud_enviada", "collaborator.quote.accepted"] } },
          orderBy: { createdAt: "desc" },
          select: { type: true, payload: true },
        });
        const aceptadoEv = recent.find((e) => e.type === "lavori.precio_aceptado_enviado")?.payload as { precioCents?: unknown } | undefined;
        const enviadaEv = recent.find((e) => e.type === "lavori.solicitud_enviada")?.payload as { paraTi?: unknown } | undefined;
        const paraTiCents =
          Number.isFinite(Number(aceptadoEv?.precioCents)) && Number(aceptadoEv?.precioCents) > 0
            ? Math.round(Number(aceptadoEv?.precioCents))
            : Number.isFinite(Number(enviadaEv?.paraTi)) && Number(enviadaEv?.paraTi) > 0
              ? Math.round(Number(enviadaEv?.paraTi) * 100)
              : null;
        const yaContabilizado = recent.some((e) => e.type === "collaborator.quote.accepted");
        const assignment = await prisma.collaboratorAssignment.upsert({
          where: { orderId_collaboratorId: { orderId: order.id, collaboratorId: collaborator.id } },
          create: {
            orderId: order.id,
            collaboratorId: collaborator.id,
            status: "ACCEPTED",
            acceptedAt: new Date(),
            isWinning: true,
            ...(paraTiCents ? { quotedPriceCents: paraTiCents, quotedAt: new Date() } : {}),
          },
          update: {
            status: "ACCEPTED",
            acceptedAt: new Date(),
            rejectedAt: null,
            rejectionReason: null,
            isWinning: true,
            ...(paraTiCents ? { quotedPriceCents: paraTiCents } : {}),
          },
        });
        await prisma.order.update({ where: { id: order.id }, data: { assignedTo: collaborator.fullName } });
        if (paraTiCents && !yaContabilizado) {
          const full = await prisma.order.findUniqueOrThrow({
            where: { id: order.id },
            select: { id: true, amountCents: true, paymentStatus: true, marginPct: true },
          });
          await applyAcceptedQuoteSideEffects(prisma, {
            order: full,
            assignmentId: assignment.id,
            supplierCostCents: paraTiCents,
            collaborator: { fullName: collaborator.fullName, companyName: collaborator.companyName, supplierType: collaborator.supplierType },
            actorEmail: "lavori-bridge",
            isWinning: true,
          }).catch((err) => console.error("[lavori-eventos] side effects failed", err));
        }
        notifyClientTranslationStarted({
          reference: order.reference,
          translatorName: collaborator.fullName,
          swornNumber: collaborator.swornNumber,
          actorEmail: "lavori-bridge",
        }).catch((err) => console.error("[lavori-eventos] client notify failed", err));
      }

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          message: collaborator
            ? `lavori: ${miembro} aceptó el encargo — asignado automáticamente como colaborador.`
            : `lavori: ${miembro} aceptó el encargo, pero no está mapeado como colaborador — asignar a mano.`,
          payload: { encargoId, motorRef, ...datos, autoAssigned: Boolean(collaborator) },
        },
      });
      await staffMail(
        collaborator
          ? `✅ ${miembro} aceptó ${order.reference} — asignado`
          : `⚠ ${miembro} aceptó ${order.reference} — SIN asignar (mapear colaborador)`,
        [
          `${miembro} ha aceptado el encargo de lavori (${encargoId}) del pedido ${order.reference}.`,
          collaborator
            ? `Asignación automática hecha (${collaborator.fullName}); el cliente ha sido avisado de que la traducción está en marcha.`
            : `No hay Collaborator mapeado para el miembro ${miembroId}: asígnalo a mano en la ficha y añade el mapeo en lib/lavori-bridge.ts.`,
          `Ficha: ${ficha}`,
        ]
      );
    }

    if (evento === "factura_subida") {
      const totalCents = eurosToCents(datos.importe);
      const miembroId = String(datos.miembroId || "");
      const email = LAVORI_MEMBER_COLLABORATOR_EMAIL[miembroId];
      const collaborator = email
        ? await prisma.collaborator.findUnique({ where: { email } })
        : null;
      const supplier = collaborator?.fullName || String(datos.miembroNombre || miembroId || "Colaborador lavori");

      // Los blobs de lavori son privados (sin URL firmada para máquinas): la
      // factura viaja en base64 y se persiste en NUESTRO Blob, como en la ida.
      let attachmentUrl = datos.url ? String(datos.url) : null;
      let attachmentKey: string | null = null;
      const nombre = datos.nombre ? String(datos.nombre) : `factura-${encargoId}.pdf`;
      if (typeof datos.base64 === "string" && datos.base64.length > 0) {
        const buf = Buffer.from(datos.base64, "base64");
        if (buf.length === 0 || buf.length > SOBRE_MAX_RAW_BYTES) {
          return NextResponse.json({ ok: false, error: `datos.base64 vacío o >${Math.round(SOBRE_MAX_RAW_BYTES / 1e6)}MB` }, { status: 400 });
        }
        const blob = await put(`orders/${order.reference}/facturas-lavori/${Date.now()}-${nombre}`, buf, {
          access: "public",
          contentType: datos.contentType ? String(datos.contentType) : "application/pdf",
        });
        attachmentUrl = blob.url;
        attachmentKey = blob.pathname;
      }
      const expense = await prisma.expense.create({
        data: {
          date: new Date(),
          brand: "traduccionesjuradas",
          supplier,
          supplierInvoiceNumber: datos.numeroFactura ? String(datos.numeroFactura) : null,
          concept: `Factura del sobre lavori — encargo ${encargoId} (pedido ${order.reference})`,
          category: "colaborador",
          baseCents: totalCents ?? 0,
          vatRate: 0,
          vatCents: 0,
          totalCents: totalCents ?? 0,
          payableCents: totalCents ?? 0,
          needsReview: true,
          attachmentUrl,
          attachmentKey,
          attachmentName: nombre,
          notes: `Creado por el webhook lavori (Fase 1.5). Revisar régimen fiscal (IVA/ISP/IRPF) antes de dar por bueno.`,
        },
      });
      const { base64: _base64, ...datosSinBase64 } = datos;
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          message: `lavori: factura del sobre recibida (${supplier}${totalCents ? `, ${(totalCents / 100).toFixed(2)} €` : ""}) — gasto en contabilidad pendiente de revisión.`,
          payload: { encargoId, motorRef, ...datosSinBase64, attachmentUrl, expenseId: expense.id },
        },
      });
      await staffMail(`🧾 Factura de ${supplier} (${order.reference}) — revisar en contabilidad`, [
        `Ha llegado por lavori la factura del encargo ${encargoId} (pedido ${order.reference}).`,
        totalCents ? `Importe: ${(totalCents / 100).toFixed(2)} €.` : "Sin importe legible: revísala.",
        `Gasto creado en contabilidad como PENDIENTE y needsReview (régimen fiscal por confirmar).`,
        `Ficha: ${ficha}`,
      ]);
    }

    if (evento === "entrega_subida") {
      // Fase 2, opción B (decisión Juan 12-ago): la traducción aterriza en el
      // expediente y NADA sale solo hacia el cliente — el envío es el botón
      // "revisar y enviar al cliente" de la ficha. Tope 3 MB en crudo por POST
      // (Vercel corta con 413 a ~4,5 MB de cuerpo; mismo número que la ida y que lavori).
      if (typeof datos.base64 !== "string" || datos.base64.length === 0) {
        return NextResponse.json({ ok: false, error: "datos.base64 obligatorio" }, { status: 400 });
      }
      const buf = Buffer.from(datos.base64, "base64");
      if (buf.length === 0 || buf.length > SOBRE_MAX_RAW_BYTES) {
        return NextResponse.json({ ok: false, error: `datos.base64 vacío o >${Math.round(SOBRE_MAX_RAW_BYTES / 1e6)}MB` }, { status: 400 });
      }
      const nombre = datos.nombre ? String(datos.nombre) : `entrega-${encargoId}.pdf`;
      const contentType = datos.contentType ? String(datos.contentType) : "application/pdf";
      const blob = await put(`orders/${order.reference}/entregas-lavori/${Date.now()}-${nombre}`, buf, {
        access: "public",
        contentType,
      });
      const miembro = String(datos.miembroNombre || datos.miembroId || "el traductor");
      // Adenda papel (13-ago-2026): datos.recogida = texto libre con dirección y
      // día/horario de disponibilidad para que la mensajería recoja el original.
      const recogida = datos.recogida ? String(datos.recogida).slice(0, 500) : null;
      const { base64: _base64, ...datosSinBase64 } = datos;
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          message: `lavori: entrega de ${miembro} recibida (${nombre})${recogida ? " — con datos de recogida para la mensajería" : ""} — pendiente de REVISAR en la ficha.`,
          payload: {
            encargoId,
            motorRef,
            ...datosSinBase64,
            adjuntoId,
            nombre,
            contentType,
            recogida,
            attachmentUrl: blob.url,
            attachmentKey: blob.pathname,
            bytes: buf.length,
          },
        },
      });
      await staffMail(`📦 Entrega de ${miembro} (${order.reference}) — revisar en la ficha`, [
        `${miembro} ha subido la traducción del encargo ${encargoId} (pedido ${order.reference}): ${nombre}.`,
        `NO se ha enviado nada al cliente. Revísala en la ficha (envío por email o carril papel según el pedido).`,
        recogida ? `Recogida por mensajería: ${recogida}` : "",
        `Archivo: ${blob.url}`,
        `Ficha: ${ficha}`,
      ].filter(Boolean));
    }

    return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
  } catch (err) {
    console.error("[lavori-eventos] error", err);
    return NextResponse.json({ ok: false, error: "error interno procesando el evento" }, { status: 500 });
  }
}

/* Eventos sobre una solicitud de precio de LEAD (sin pedido). El único esperado
   es precio_propuesto → se persiste en LavoriPriceRequest y se avisa a staff con
   el enlace al builder para montar el presupuesto. Cualquier otro evento sobre
   un lead no tiene pedido que asignar → aviso a staff para gestionarlo a mano. */
async function handleLeadEvento(opts: {
  lead: {
    id: string;
    ref: string;
    par: string;
    expedienteRef: string | null;
    customerHint: string | null;
    status: string;
    encargoId: string | null;
    priceCents: number | null;
  };
  evento: EventoTipo;
  encargoId: string;
  motorRef: string;
  datos: Record<string, unknown>;
}): Promise<NextResponse> {
  const { lead, evento, encargoId, motorRef, datos } = opts;
  const builderUrl = lead.expedienteRef
    ? `https://www.traduccionesjuradas.net/zona-traductor/presupuesto?exp=${encodeURIComponent(lead.expedienteRef)}`
    : "https://www.traduccionesjuradas.net/zona-traductor/presupuesto";
  const quien = lead.customerHint ? ` — lead: ${lead.customerHint}` : "";
  const staffMail = (subject: string, lines: string[]) =>
    sendMail({
      to: STAFF_ALERT_EMAIL,
      subject,
      text: lines.join("\n"),
      html: lines.map((l) => `<p>${l}</p>`).join(""),
    }).catch((err) => console.error("[lavori-eventos] staff mail failed", err));

  try {
    if (evento === "precio_propuesto") {
      const precioCents = eurosToCents(datos.precio);
      if (precioCents === null) {
        return NextResponse.json({ ok: false, error: "datos.precio inválido" }, { status: 400 });
      }
      if (lead.status === "PRICED" && lead.encargoId === encargoId && lead.priceCents === precioCents) {
        return NextResponse.json({ ok: true, repetido: true });
      }
      const plazoDias = Number.isFinite(Number(datos.plazoDias)) ? Math.round(Number(datos.plazoDias)) : null;
      const miembro = String(datos.miembroNombre || datos.miembroId || "el traductor");
      const netoSugerido = (precioCents / 0.75 / 100).toFixed(2);
      const precio = (precioCents / 100).toFixed(2);
      await prisma.lavoriPriceRequest.update({
        where: { id: lead.id },
        data: {
          status: "PRICED",
          priceCents: precioCents,
          plazoDias,
          notas: datos.notas ? String(datos.notas).slice(0, 500) : null,
          miembroId: datos.miembroId ? String(datos.miembroId) : null,
          miembroNombre: datos.miembroNombre ? String(datos.miembroNombre) : null,
          encargoId,
        },
      });
      await staffMail(`💶 Precio de ${miembro} para la solicitud ${lead.par}${quien}: ${precio} €`, [
        `${miembro} ha propuesto ${precio} € por la solicitud de precio ${lead.ref} (${lead.par})${quien}.`,
        plazoDias ? `Plazo propuesto: ${plazoDias} días.` : "Sin plazo indicado.",
        `Neto de cliente sugerido por el modelo 75/25: ${netoSugerido} € (+ IVA y envío).`,
        datos.notas ? `Notas: ${String(datos.notas)}` : "",
        `Montar el presupuesto: ${builderUrl}`,
      ].filter(Boolean));
      return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
    }

    const miembro = String(datos.miembroNombre || datos.miembroId || "el traductor");
    await staffMail(`⚠ lavori: ${evento} sobre la solicitud de lead ${lead.ref}${quien} — gestionar a mano`, [
      `Ha llegado un evento "${evento}" de ${miembro} sobre la solicitud de precio ${lead.ref} (${lead.par}, encargo ${encargoId}), que no tiene pedido asociado.`,
      `Si el lead se convirtió en pedido, vincúlalo desde la ficha; si no, gestiona la respuesta por lavori.`,
      `Builder: ${builderUrl}`,
    ]);
    return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
  } catch (err) {
    console.error("[lavori-eventos] lead error", err, motorRef);
    return NextResponse.json({ ok: false, error: "error interno procesando el evento" }, { status: 500 });
  }
}
