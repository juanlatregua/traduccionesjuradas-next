import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { LAVORI_MEMBER_COLLABORATOR_EMAIL, SOBRE_MAX_RAW_BYTES, isCasaPair } from "@/lib/lavori-bridge";
import { assignLavoriAcceptance } from "@/lib/lavori-assign";
import { autoQuoteFromDirectPrice } from "@/lib/lavori-directo";
import { acceptanceMatchesPrice, acceptsNewPrice, isDirectLeadRequest } from "@/lib/lavori-directo-math";
import { sendStaffAlertSMS } from "@/lib/sms";

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

const EVENTO_TIPOS = ["precio_propuesto", "encargo_aceptado", "factura_subida", "entrega_subida", "pago_marcado"] as const;
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
  const orderSelect = { id: true, reference: true, langPair: true, paymentStatus: true, amountCents: true } as const;
  let order = await prisma.order.findUnique({ where: { reference }, select: orderSelect });
  if (!order) {
    // Solicitud de precio de un LEAD (WhatsApp, sin pedido): ancla propia.
    const lead = await prisma.lavoriPriceRequest.findUnique({ where: { ref: reference } });
    // Ref de LEAD cuyo presupuesto ya se convirtió en pedido (caso Ofir 26_308488,
    // 26-ago): el encargo de lavori nació con la ref del lead, pero la entrega y la
    // aceptación tienen que caer en el pedido real, no en un email "gestionar a mano".
    if (lead?.quoteId) {
      order = await prisma.order.findFirst({ where: { quoteId: lead.quoteId }, orderBy: { createdAt: "desc" }, select: orderSelect });
    }
    if (!order) {
      if (lead) return handleLeadEvento({ lead, evento, encargoId, motorRef, datos });
      return NextResponse.json({ ok: false, error: `pedido "${reference}" no encontrado` }, { status: 404 });
    }
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
      // Francés = Juan (17-sep-2026): la cifra queda anotada, nunca se acepta sola.
      const esCasa = isCasaPair(order.langPair);
      const autoAceptar =
        !esCasa && order.paymentStatus === "PAID" && !yaAceptado && precioCents <= paraTiModeloCents;

      // Tarifario aprendido: el coste del jurado por tipo de documento entra en el bucle.
      await import("@/lib/learned-rates")
        .then((m) =>
          m.learnFromOrderPrice({
            orderId: order.id,
            reference: order.reference,
            priceCents: precioCents,
            plazoDias: Number.isFinite(Number(datos.plazoDias)) ? Math.round(Number(datos.plazoDias)) : null,
            miembroId: datos.miembroId ? String(datos.miembroId) : null,
            miembroNombre: datos.miembroNombre ? String(datos.miembroNombre) : null,
          })
        )
        .catch((err) => console.error("[lavori-eventos] tarifario no aprendio:", err));

      await staffMail(`💶 Precio de ${miembro} para ${order.reference}: ${precio} €`, [
        `${miembro} ha propuesto ${precio} € por el encargo de lavori (${encargoId}).`,
        datos.plazoDias ? `Plazo propuesto: ${datos.plazoDias} días.` : "Sin plazo indicado.",
        `Neto de cliente sugerido por el modelo 75/25: ${netoSugerido} € (+ IVA y envío).`,
        datos.notas ? `Notas: ${String(datos.notas)}` : "",
        esCasa
          ? `Francés: el pedido lo traduce Juan en tj.net — la cifra NO se acepta ni se asigna. Retira el encargo en lavori.`
          : autoAceptar
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

    if (evento === "encargo_aceptado" && isCasaPair(order.langPair)) {
      const miembro = String(datos.miembroNombre || datos.miembroId || "el traductor");
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          message: `lavori: ${miembro} aceptó el encargo, pero el francés lo traduce Juan — NO se asigna.`,
          payload: { encargoId, motorRef, ...datos, noAsignado: "casa" },
        },
      });
      await staffMail(`⚠ ${miembro} aceptó ${order.reference} en lavori — francés, NO asignado`, [
        `${miembro} ha aceptado en lavori el encargo ${encargoId} del pedido ${order.reference}.`,
        `El francés que entra por tj.net lo traduces tú: no se ha asignado ni se ha avisado al cliente. Retira el encargo en lavori y avisa a ${miembro}.`,
        `Ficha: ${ficha}`,
      ]);
    }

    if (evento === "encargo_aceptado" && !isCasaPair(order.langPair)) {
      const miembroId = String(datos.miembroId || "");
      // Cifra que la casa debe al jurado: la aceptada (Fase 2, precio_aceptado_enviado)
      // o la del dirigido (solicitud_enviada.paraTi). Con ella la aceptación deja
      // coste, devengo en su cuenta y snapshot de margen por el chokepoint de
      // siempre (25-ago-2026, caso 26_34F612: antes la asignación automática
      // quedaba sin precio, sin isWinning y sin devengo).
      const recent = await prisma.orderEvent.findMany({
        where: { orderId: order.id, type: { in: ["lavori.precio_aceptado_enviado", "lavori.solicitud_enviada"] } },
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
      const { collaborator, miembro } = await assignLavoriAcceptance({
        order: { id: order.id, reference: order.reference },
        miembroId,
        miembroNombre: datos.miembroNombre ? String(datos.miembroNombre) : null,
        paraTiCents,
        encargoId,
        motorRef,
        payload: datos as Record<string, unknown>,
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

    if (evento === "pago_marcado") {
      const pagadoEn = datos.pagadoEn && !Number.isNaN(Date.parse(String(datos.pagadoEn))) ? new Date(String(datos.pagadoEn)) : new Date();
      const r = await marcarFacturaPagadaDesdeLavori({ encargoId, pagadoEn, orderReference: order.reference });
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          message: r.marcadas.length
            ? `lavori: encargo marcado PAGADO el ${pagadoEn.toISOString().slice(0, 10)} — ${r.marcadas.length} factura(s) de colaborador pagada(s) en contabilidad.`
            : r.encontradas
              ? `lavori: encargo marcado PAGADO; su factura ya estaba pagada en contabilidad.`
              : `lavori: encargo marcado PAGADO pero NO hay factura del colaborador en contabilidad — pedirla o registrarla.`,
          payload: { encargoId, motorRef, pagadoEn: pagadoEn.toISOString(), expenseIds: r.marcadas.map((f) => f.id) },
        },
      });
      if (r.encontradas === 0) {
        await staffMail(`⚠ Pago marcado en lavori sin factura en contabilidad (${order.reference})`, [
          `Has marcado PAGADO en lavori el encargo ${encargoId} del pedido ${order.reference}, pero en contabilidad no hay factura del colaborador para ese encargo.`,
          `Pídesela o regístrala para que el pago no quede fuera del libro.`,
          `Ficha: ${ficha}`,
        ]);
      }
    }

    return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
  } catch (err) {
    console.error("[lavori-eventos] error", err);
    return NextResponse.json({ ok: false, error: "error interno procesando el evento" }, { status: 500 });
  }
}

/* pago_marcado (adenda 14-sep-2026, orden de Juan: «las facturas están en lavori,
   crea un vínculo entre los dos»): Juan marca PAGADO un encargo de la casa en lavori
   → la factura de ese encargo queda pagada en NUESTRO libro con la fecha de lavori.
   La factura se busca por el encargo (evento factura_subida/recuperada o concepto) y,
   si hay pedido, por pedido+colaborador. No pisa un pago ya sellado. */
async function marcarFacturaPagadaDesdeLavori(opts: { encargoId: string; pagadoEn: Date; orderReference: string | null }) {
  const { encargoId, pagadoEn, orderReference } = opts;
  const evs = await prisma.orderEvent.findMany({
    where: { type: { in: ["lavori.factura_subida", "lavori.factura_recuperada"] }, payload: { path: ["encargoId"], equals: encargoId } },
    select: { payload: true },
  });
  const ids = new Set(evs.map((e) => String((e.payload as { expenseId?: unknown } | null)?.expenseId || "")).filter(Boolean));
  const porConcepto = await prisma.expense.findMany({
    where: { category: "colaborador", isAccrual: false, concept: { contains: `encargo ${encargoId}` } },
    select: { id: true },
  });
  porConcepto.forEach((e) => ids.add(e.id));
  let facturas = ids.size
    ? await prisma.expense.findMany({ where: { id: { in: [...ids] }, isAccrual: false }, select: { id: true, paymentStatus: true, supplier: true, payableCents: true } })
    : [];
  if (facturas.length === 0 && orderReference) {
    facturas = await prisma.expense.findMany({
      where: { orderReference, category: "colaborador", isAccrual: false },
      select: { id: true, paymentStatus: true, supplier: true, payableCents: true },
    });
  }
  const pendientes = facturas.filter((f) => f.paymentStatus !== "PAID");
  for (const f of pendientes) {
    await prisma.expense.update({ where: { id: f.id }, data: { paymentStatus: "PAID", paidAt: pagadoEn } });
  }
  return { encontradas: facturas.length, marcadas: pendientes };
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
    quoteId: string | null;
    priceCents: number | null;
    createdBy: string | null;
    candidatos: string[];
    notas: string | null;
    miembroId: string | null;
  };
  evento: EventoTipo;
  encargoId: string;
  motorRef: string;
  datos: Record<string, unknown>;
}): Promise<NextResponse> {
  const { lead, evento, encargoId, motorRef, datos } = opts;
  // El enlace SIEMPRE lleva la solicitud (?lead=): antes iba por ?exp= o al builder
  // vacío y el presupuesto nacía sin atar → al pagar se abría OTRO encargo
  // (Daniela/26_C3675D, Vanessa/Mario Moreno, 8-9 sep 2026). Y si la solicitud ya
  // tiene presupuesto, se enlaza ESE presupuesto: montar otro los duplicaba.
  const quoteAtado = lead.quoteId
    ? await prisma.quote.findUnique({ where: { id: lead.quoteId }, select: { id: true, quoteNumber: true, status: true } })
    : null;
  const builderUrl = quoteAtado
    ? `https://www.traduccionesjuradas.net/zona-traductor/presupuestos/${quoteAtado.id}`
    : `https://www.traduccionesjuradas.net/zona-traductor/presupuesto?lead=${encodeURIComponent(lead.ref)}` +
      (lead.expedienteRef && !lead.expedienteRef.startsWith("puerta:") ? `&exp=${encodeURIComponent(lead.expedienteRef)}` : "");
  const montarLine = quoteAtado
    ? `Ya tiene presupuesto ${quoteAtado.quoteNumber} (${quoteAtado.status}) — pon ahí el coste si falta y envíalo; NO montes otro: ${builderUrl}`
    : `Montar el presupuesto (queda atado a esta solicitud): ${builderUrl}`;
  const quien = lead.customerHint ? ` — lead: ${lead.customerHint}` : "";
  const staffMail = (subject: string, lines: string[]) =>
    sendMail({
      to: STAFF_ALERT_EMAIL,
      subject,
      text: lines.join("\n"),
      html: lines.map((l) => `<p>${l}</p>`).join(""),
    }).catch((err) => console.error("[lavori-eventos] staff mail failed", err));

  try {
    // ALTA 2(b) (Juan, 15-sep-2026): la solicitud vieja queda TERMINAL al
    // escalar — un precio_propuesto o un encargo_aceptado tardíos del jurado
    // directo original NO le tocan status ni cifras: la que manda es la
    // reabierta. Solo un aviso, nunca un movimiento silencioso.
    if (lead.status === "ESCALATED" && (evento === "precio_propuesto" || evento === "encargo_aceptado")) {
      const miembroTardio = String(datos.miembroNombre || datos.miembroId || "el traductor");
      const refNueva = lead.notas?.startsWith("reabierta:") ? lead.notas.slice("reabierta:".length) : null;
      // El enlace va a la solicitud NUEVA (la que sigue viva), nunca a ?lead=<vieja>.
      const enlaceNueva = refNueva
        ? `https://www.traduccionesjuradas.net/zona-traductor/presupuesto?lead=${encodeURIComponent(refNueva)}`
        : "(sin ref nueva en notas — revisa a mano)";
      // La cifra tardía queda SOLO en el texto del aviso: no se toca status ni
      // priceCents de la solicitud vieja.
      const detalleCifra =
        evento === "precio_propuesto"
          ? (() => {
              const precioCents = eurosToCents(datos.precio);
              const plazoDias = Number.isFinite(Number(datos.plazoDias)) ? Math.round(Number(datos.plazoDias)) : null;
              return precioCents != null ? ` Propuso ${(precioCents / 100).toFixed(2)} €${plazoDias ? ` (plazo ${plazoDias} días)` : ""}.` : "";
            })()
          : " Aceptó el encargo.";
      const texto = `Respuesta tardía de ${miembroTardio} sobre ${lead.ref}, ya reabierta como ${refNueva || "(sin ref)"}.${detalleCifra} Decide tú: ${enlaceNueva}`;
      await Promise.all([
        staffMail(`⚠ Respuesta tardía de ${miembroTardio} — ${lead.ref} ya reabierta`, [texto]),
        sendStaffAlertSMS(texto, `directo_tardio ${lead.ref}`).catch(() => {}),
      ]);
      return NextResponse.json({ ok: true, repetido: false, tardio: true }, { status: 201 });
    }

    // Solicitud DESCARTADA por staff (botón "Descartar" en /zona-traductor/
    // presupuestos): terminal, igual que ESCALATED — un precio_propuesto o
    // encargo_aceptado que llegue después NO la reabre ni le toca status ni
    // cifras; solo un aviso para que Juan decida (y retire el encargo en
    // lavori a mano si sigue vivo allí).
    if (lead.status === "DISCARDED" && (evento === "precio_propuesto" || evento === "encargo_aceptado")) {
      const miembroTardio = String(datos.miembroNombre || datos.miembroId || "el traductor");
      const detalleCifra =
        evento === "precio_propuesto"
          ? (() => {
              const precioCents = eurosToCents(datos.precio);
              const plazoDias = Number.isFinite(Number(datos.plazoDias)) ? Math.round(Number(datos.plazoDias)) : null;
              return precioCents != null ? ` Propuso ${(precioCents / 100).toFixed(2)} €${plazoDias ? ` (plazo ${plazoDias} días)` : ""}.` : "";
            })()
          : " Aceptó el encargo.";
      const texto = `Respuesta de ${miembroTardio} sobre ${lead.ref}, que está DESCARTADA.${detalleCifra} No se ha tocado la solicitud — si el encargo sigue vivo en lavori, retíralo a mano: ${builderUrl}`;
      await Promise.all([
        staffMail(`⚠ Respuesta sobre solicitud descartada — ${lead.ref}`, [texto]),
        sendStaffAlertSMS(texto, `descartada_tardio ${lead.ref}`).catch(() => {}),
      ]);
      return NextResponse.json({ ok: true, repetido: false, descartada: true }, { status: 201 });
    }

    if (evento === "precio_propuesto") {
      const precioCents = eurosToCents(datos.precio);
      if (precioCents === null) {
        return NextResponse.json({ ok: false, error: "datos.precio inválido" }, { status: 400 });
      }
      const miembroIdEntrante = datos.miembroId ? String(datos.miembroId) : null;
      if (
        lead.status === "PRICED" &&
        lead.encargoId === encargoId &&
        lead.priceCents === precioCents &&
        (lead.miembroId ?? null) === miembroIdEntrante
      ) {
        return NextResponse.json({ ok: true, repetido: true });
      }
      const plazoDias = Number.isFinite(Number(datos.plazoDias)) ? Math.round(Number(datos.plazoDias)) : null;
      const miembro = String(datos.miembroNombre || datos.miembroId || "el traductor");
      const netoSugerido = (precioCents / 0.75 / 100).toFixed(2);
      const precio = (precioCents / 100).toFixed(2);

      // ALTA 1(c): la cifra cambia DESPUÉS de que el presupuesto ya salió al
      // cliente. Se detecta ANTES de sobrescribir lead.priceCents.
      // Solo alarma si el presupuesto YA SALIÓ: una cifra corregida sobre un
      // borrador se vuelve a rellenar sin ruido (Juan, 18-sep-2026).
      const quoteAtadoEstado = lead.quoteId
        ? (await prisma.quote.findUnique({ where: { id: lead.quoteId }, select: { status: true } }))?.status ?? null
        : null;
      const cifraCambiadaTrasEnvio =
        Boolean(lead.quoteId) && quoteAtadoEstado !== "DRAFT" && lead.priceCents != null && lead.priceCents !== precioCents;
      let quoteNumeroCambiado: string | null = null;
      if (cifraCambiadaTrasEnvio && lead.quoteId) {
        const q = await prisma.quote.findUnique({ where: { id: lead.quoteId }, select: { quoteNumber: true } });
        quoteNumeroCambiado = q?.quoteNumber || lead.quoteId;
      }

      // Carril directo: gana el PRIMER precio (orden Juan 21-sep-2026). Con cifra
      // ya puesta, un precio de otro jurado no pisa ni la cifra ni el miembro (el
      // borrador atado ya lleva su coste). Condición atómica en el UPDATE.
      const segundosAnotados = (lead.notas || "").split("\n").filter((l) => l.startsWith("2.º precio NO aplicado"));
      const notasNuevas = [datos.notas ? String(datos.notas).slice(0, 500) : null, ...segundosAnotados].filter(Boolean).join("\n") || null;
      const directo = isDirectLeadRequest(lead.createdBy);
      const aplicado = !acceptsNewPrice(lead, miembroIdEntrante)
        ? { count: 0 }
        : await prisma.lavoriPriceRequest.updateMany({
            where: {
              id: lead.id,
              ...(directo ? { OR: [{ priceCents: null }, ...(miembroIdEntrante ? [{ miembroId: miembroIdEntrante }] : [])] } : {}),
            },
            data: {
              status: "PRICED",
              priceCents: precioCents,
              plazoDias,
              notas: notasNuevas,
              miembroId: miembroIdEntrante,
              miembroNombre: datos.miembroNombre ? String(datos.miembroNombre) : null,
              encargoId,
            },
          });
      if (aplicado.count === 0) {
        const actual = await prisma.lavoriPriceRequest.findUnique({
          where: { id: lead.id },
          select: { notas: true, priceCents: true, miembroNombre: true },
        });
        const linea = `2.º precio NO aplicado: ${miembro} propuso ${precio} €${plazoDias ? ` (plazo ${plazoDias} días)` : ""}`;
        if (actual?.notas?.includes(linea)) return NextResponse.json({ ok: true, repetido: true });
        await prisma.lavoriPriceRequest.update({
          where: { id: lead.id },
          data: { notas: [actual?.notas, linea].filter(Boolean).join("\n") },
        });
        const primera = actual?.priceCents != null ? `${(actual.priceCents / 100).toFixed(2)} € de ${actual.miembroNombre || "otro jurado"}` : "otra cifra";
        const texto = `${miembro} propone ${precio} € para ${lead.ref} (${lead.par})${quien}, pero ya había ${primera}: gana la primera y no se toca nada. Si prefieres esta, decídelo tú: ${builderUrl}`;
        await Promise.all([
          staffMail(`⚖ Segundo precio para ${lead.ref}: ${miembro} ${precio} € (vale el primero)`, [texto]),
          sendStaffAlertSMS(texto, `segundo_precio ${lead.ref}`).catch((err) => console.error("[lavori-eventos] SMS segundo precio fallo:", err)),
        ]);
        return NextResponse.json({ ok: true, repetido: false, segundoPrecio: true }, { status: 201 });
      }
      // Tarifario aprendido: el coste del jurado por tipo de documento entra en el bucle.
      const aprendido = await import("@/lib/learned-rates")
        .then((m) => m.learnFromLeadPrice(lead.id))
        .catch((err) => ({ learned: false, reason: String(err?.message || err) }));

      // La cifra cae en el BORRADOR atado (Juan, 17-sep-2026): coste real por
      // línea y precio de venta el del motor, que solo sube si el margen no da.
      // Sigue en borrador: lo revisa y lo envía Juan. Sin esto había que copiar
      // el coste a mano y montar otro presupuesto era el camino fácil (Devaulx
      // 2026-00160 / 2026-00166). Nunca toca un presupuesto ya enviado.
      let borradorRelleno: { quoteNumber: string; quoteId: string; totalEur: number; costEur: number; subidas: number; margenBajo: string | null } | null = null;
      let borradorFallo: string | null = null;
      if (lead.quoteId && quoteAtadoEstado === "DRAFT") {
        const relleno = await import("@/lib/lavori-quote-fill")
          .then((m) => m.fillDraftQuoteFromLeadPrice(lead.id))
          .catch((err) => ({ ok: false as const, reason: String(err?.message || err) }));
        if (relleno.ok) borradorRelleno = relleno;
        else borradorFallo = relleno.reason;
      }

      // Funnel directo (Juan 15/21-sep-2026): esta solicitud fue SOLO a los
      // jurados directos de su lengua y aún no tiene presupuesto atado → el
      // primer precio monta el BORRADOR (+20 % sobre su base) y se avisa a staff;
      // nunca sale solo al cliente. Claim atómico para que dos eventos casi
      // simultáneos no monten dos borradores.
      let directoResultado:
        | { kind: "retenido"; quoteId: string; quoteNumber: string; totalEur: number; costEur: number; subtotalEur: number; avisos: string[] }
        | { kind: "fallo"; reason: string }
        | null = null;
      if (
        lead.createdBy === "puerta-directo" &&
        miembroIdEntrante &&
        lead.candidatos.includes(miembroIdEntrante) &&
        !lead.quoteId
      ) {
        // MEDIA 3 (Juan, 15-sep-2026): el claim nunca puede tumbar el webhook con
        // un 5xx — si falla, se trata como "no reclamado" (sigue el mensaje normal).
        let claimCount = 0;
        try {
          const claim = await prisma.lavoriPriceRequest.updateMany({
            where: { id: lead.id, createdBy: "puerta-directo", quoteId: null },
            data: { createdBy: "puerta-directo:cotizando" },
          });
          claimCount = claim.count;
        } catch (err) {
          console.error("[lavori-eventos] claim directo fallo:", err);
        }
        if (claimCount === 1) {
          try {
            const directo = await autoQuoteFromDirectPrice(lead.id);
            if (directo.ok) {
              await prisma.lavoriPriceRequest.update({ where: { id: lead.id }, data: { createdBy: "puerta-directo:retenido" } });
              directoResultado = {
                kind: "retenido",
                quoteId: directo.quoteId,
                quoteNumber: directo.quoteNumber,
                totalEur: directo.totalEur,
                costEur: directo.costEur,
                subtotalEur: directo.subtotalEur,
                avisos: directo.avisos,
              };
            } else {
              await prisma.lavoriPriceRequest.update({ where: { id: lead.id }, data: { createdBy: "puerta-directo:manual" } });
              directoResultado = { kind: "fallo", reason: directo.reason };
            }
          } catch (err: any) {
            await prisma.lavoriPriceRequest.update({ where: { id: lead.id }, data: { createdBy: "puerta-directo:manual" } }).catch(() => {});
            directoResultado = { kind: "fallo", reason: String(err?.message || err) };
          }
        }
      }

      const borradorDirecto = directoResultado?.kind === "retenido" ? directoResultado : null;
      const enlaceDirecto = borradorDirecto ? `https://www.traduccionesjuradas.net/zona-traductor/presupuestos/${borradorDirecto.quoteId}` : null;
      const cifraDirecto = borradorDirecto
        ? (() => {
            const margen = borradorDirecto.subtotalEur - borradorDirecto.costEur;
            const pct = borradorDirecto.costEur > 0 ? (margen / borradorDirecto.costEur) * 100 : 0;
            return `coste base ${borradorDirecto.costEur.toFixed(2)} € · venta sugerida ${borradorDirecto.subtotalEur.toFixed(2)} € netos (+20 %, suelo 40 €/doc) · margen ${margen.toFixed(2)} € (${pct.toFixed(0)} %)`;
          })()
        : "";
      const subject = cifraCambiadaTrasEnvio
        ? `⚠ ${miembro} ha CAMBIADO la cifra tras enviar el presupuesto ${quoteNumeroCambiado}: antes ${(lead.priceCents! / 100).toFixed(2)} €, ahora ${precio} €`
        : borradorDirecto
          ? `🧾 Borrador directo ${borradorDirecto.quoteNumber}: ${miembro} cotiza ${precio} € — revísalo y envíalo tú`
          : `💶 Precio de ${miembro} para la solicitud ${lead.par}${quien}: ${precio} €`;
      const lineaDirecto = borradorDirecto
        ? `Borrador ${borradorDirecto.quoteNumber} montado (${borradorDirecto.totalEur.toFixed(2)} € con IVA), NO enviado al cliente: ${cifraDirecto}. Revísalo y envíalo si el jurado confirma: ${enlaceDirecto}${borradorDirecto.avisos.length ? ` ⚠ ${borradorDirecto.avisos.join(" · ")}` : ""}`
        : "";
      if (directoResultado) {
        await sendStaffAlertSMS(
          borradorDirecto
            ? `Directo ${lead.par} ${miembro}: ${cifraDirecto}. Borrador ${borradorDirecto.quoteNumber}: ${enlaceDirecto}`
            : `Directo ${lead.ref}: ${miembro} cotiza ${precio}€ pero no hay borrador (${directoResultado.kind === "fallo" ? directoResultado.reason : "?"}): ${builderUrl}`,
          `directo_precio ${lead.ref}`
        ).catch((err) => console.error("[lavori-eventos] SMS directo fallo:", err));
      }
      // ALTA 1(c): aviso por dos transportes — la cifra ya está en manos del
      // cliente (presupuesto enviado) y esto puede dejar el margen a cero.
      if (cifraCambiadaTrasEnvio) {
        await sendStaffAlertSMS(
          `${miembro} cambió la cifra tras enviar ${quoteNumeroCambiado}: ${(lead.priceCents! / 100).toFixed(2)}€ → ${precio}€`,
          `cifra_cambiada ${lead.ref}`
        ).catch(() => {});
      }
      await staffMail(subject, [
        cifraCambiadaTrasEnvio
          ? `El presupuesto ${quoteNumeroCambiado} ya salió al cliente con la cifra anterior. Al pagar, NO se aceptará sola si la nueva cifra supera el coste ya puesto en las líneas — decide tú.`
          : "",
        directoResultado?.kind === "fallo" ? `No salió solo: ${directoResultado.reason}` : "",
        `${miembro} ha propuesto ${precio} € por la solicitud de precio ${lead.ref} (${lead.par})${quien}.`,
        aprendido.learned
          ? `Tarifario: tarifa aprendida (${lead.par}). Apruébala en https://www.traduccionesjuradas.net/zona-traductor/tarifario y la próxima vez el presupuesto saldrá solo.`
          : `Tarifario: no aprendido (${"reason" in aprendido ? aprendido.reason : "sin motivo"}).`,
        plazoDias ? `Plazo propuesto: ${plazoDias} días.` : "Sin plazo indicado.",
        `Neto de cliente sugerido por el modelo 75/25: ${netoSugerido} € (+ IVA y envío).`,
        datos.notas ? `Notas: ${String(datos.notas)}` : "",
        borradorRelleno
          ? `✅ El borrador ${borradorRelleno.quoteNumber} ya tiene el coste puesto (${borradorRelleno.costEur.toFixed(2)} € base) y queda en ${borradorRelleno.totalEur.toFixed(2)} € con IVA${borradorRelleno.subidas > 0 ? `; ${borradorRelleno.subidas} línea(s) subidas sobre el precio del motor para no perder margen` : " (precio del motor intacto)"}. Revísalo y envíalo: https://www.traduccionesjuradas.net/zona-traductor/presupuestos/${borradorRelleno.quoteId}`
          : "",
        borradorRelleno?.margenBajo ? `⚠ Margen por debajo del mínimo tras descuento/envío: ${borradorRelleno.margenBajo}` : "",
        borradorFallo ? `⚠ No se pudo rellenar el borrador solo: ${borradorFallo}` : "",
        lineaDirecto,
        borradorDirecto || borradorRelleno ? "" : montarLine,
      ].filter(Boolean));
      return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
    }

    const miembro = String(datos.miembroNombre || datos.miembroId || "el traductor");
    // Aceptación antes de que exista el pedido (Juan confirma en la app de lavori y
    // marca el pago después): que quede en la solicitud para que la ficha lo enseñe y
    // el pago posterior no lance otro encargo. La asignación se completa al pagar.
    if (evento === "encargo_aceptado" && !acceptanceMatchesPrice(lead, datos.miembroId ? String(datos.miembroId) : null)) {
      const actual = await prisma.lavoriPriceRequest.findUnique({ where: { id: lead.id }, select: { notas: true, miembroNombre: true } });
      const linea = `Aceptación NO aplicada: ${miembro} aceptó el encargo ${encargoId}, pero la cifra (${((lead.priceCents ?? 0) / 100).toFixed(2)} €) es de ${actual?.miembroNombre || lead.miembroId}`;
      if (actual?.notas?.includes(linea)) return NextResponse.json({ ok: true, repetido: true });
      await prisma.lavoriPriceRequest.update({
        where: { id: lead.id },
        data: { notas: [actual?.notas, linea].filter(Boolean).join("\n") },
      });
      const texto = `${linea} (${lead.ref}, ${lead.par})${quien}. No se ha tocado la solicitud: decide tú con quién sigue y con qué cifra: ${builderUrl}`;
      await Promise.all([
        staffMail(`⚠ ${miembro} aceptó ${lead.ref}, pero la cifra es de otro jurado`, [texto]),
        sendStaffAlertSMS(texto, `aceptacion_cruzada ${lead.ref}`).catch((err) => console.error("[lavori-eventos] SMS aceptación cruzada fallo:", err)),
      ]);
      return NextResponse.json({ ok: true, repetido: false, aceptacionCruzada: true }, { status: 201 });
    }
    if (evento === "encargo_aceptado") {
      await prisma.lavoriPriceRequest.update({
        where: { id: lead.id },
        data: {
          status: "ACCEPTED",
          encargoId,
          ...(datos.miembroId ? { miembroId: String(datos.miembroId) } : {}),
          ...(datos.miembroNombre ? { miembroNombre: String(datos.miembroNombre) } : {}),
        },
      });
    }
    if (evento === "pago_marcado") {
      const pagadoEn = datos.pagadoEn && !Number.isNaN(Date.parse(String(datos.pagadoEn))) ? new Date(String(datos.pagadoEn)) : new Date();
      const r = await marcarFacturaPagadaDesdeLavori({ encargoId, pagadoEn, orderReference: null });
      if (r.encontradas === 0) {
        await staffMail(`⚠ Pago marcado en lavori sin factura en contabilidad (solicitud ${lead.ref}${quien})`, [
          `Has marcado PAGADO en lavori el encargo ${encargoId} (solicitud ${lead.ref}), pero en contabilidad no hay factura del colaborador para ese encargo.`,
          `Pídesela o regístrala para que el pago no quede fuera del libro.`,
          montarLine,
        ]);
      }
      return NextResponse.json({ ok: true, repetido: false, marcadas: r.marcadas.length }, { status: 201 });
    }
    // Factura sobre una solicitud SIN pedido atado (caso Daniela 502, 9-sep-2026: solo
    // salía este email y el gasto no existía; el PDF vivía en el blob privado de
    // lavori, que lo borra a los 15 días). Se anota igual que en un pedido: PDF en
    // NUESTRO Blob + gasto needsReview, para que el cuadre lo encuentre siempre.
    if (evento === "factura_subida") {
      const totalCents = eurosToCents(datos.importe);
      const miembroId = String(datos.miembroId || "");
      const email = LAVORI_MEMBER_COLLABORATOR_EMAIL[miembroId];
      const collaborator = email ? await prisma.collaborator.findUnique({ where: { email } }) : null;
      const supplier = collaborator?.fullName || String(datos.miembroNombre || miembroId || "Colaborador lavori");
      const yaAnotada = await prisma.expense.findFirst({
        where: { category: "colaborador", isAccrual: false, concept: { contains: `encargo ${encargoId}` } },
        select: { id: true },
      });
      if (yaAnotada) return NextResponse.json({ ok: true, repetido: true });
      const nombre = datos.nombre ? String(datos.nombre) : `factura-${encargoId}.pdf`;
      let attachmentUrl = datos.url ? String(datos.url) : null;
      let attachmentKey: string | null = null;
      if (typeof datos.base64 === "string" && datos.base64.length > 0) {
        const buf = Buffer.from(datos.base64, "base64");
        if (buf.length === 0 || buf.length > SOBRE_MAX_RAW_BYTES) {
          return NextResponse.json({ ok: false, error: `datos.base64 vacío o >${Math.round(SOBRE_MAX_RAW_BYTES / 1e6)}MB` }, { status: 400 });
        }
        const blob = await put(`leads/${lead.ref}/facturas-lavori/${Date.now()}-${nombre}`, buf, {
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
          concept: `Factura del sobre lavori — encargo ${encargoId} (solicitud ${lead.ref}, sin pedido atado)`,
          category: "colaborador",
          baseCents: totalCents ?? 0,
          vatRate: 0,
          vatCents: 0,
          totalCents: totalCents ?? 0,
          payableCents: totalCents ?? 0,
          needsReview: true,
          collaboratorId: collaborator?.id ?? null,
          attachmentUrl,
          attachmentKey,
          attachmentName: nombre,
          notes: `Creado por el webhook lavori sobre la solicitud ${lead.ref}${quien}. Sin pedido atado: enlázalo al pedido en el cuadre y revisa IVA/IRPF.`,
        },
      });
      await staffMail(`🧾 Factura de ${supplier} sobre la solicitud ${lead.ref}${quien} — gasto creado, sin pedido`, [
        `Ha llegado por lavori la factura del encargo ${encargoId} (solicitud ${lead.ref}), que no tiene pedido atado.`,
        totalCents ? `Importe: ${(totalCents / 100).toFixed(2)} €.` : "Sin importe legible: revísala.",
        `Gasto ${expense.id} creado en contabilidad como PENDIENTE y needsReview. Enlázalo al pedido cuando lo haya.`,
        attachmentUrl ? `Archivo: ${attachmentUrl}` : "",
        montarLine,
      ].filter(Boolean));
      return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
    }
    await staffMail(`⚠ lavori: ${evento} sobre la solicitud de lead ${lead.ref}${quien} — gestionar a mano`, [
      `Ha llegado un evento "${evento}" de ${miembro} sobre la solicitud de precio ${lead.ref} (${lead.par}, encargo ${encargoId}), que no tiene pedido asociado.`,
      `Si el lead se convirtió en pedido, vincúlalo desde la ficha; si no, gestiona la respuesta por lavori.`,
      montarLine,
    ]);
    return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
  } catch (err) {
    console.error("[lavori-eventos] lead error", err, motorRef);
    return NextResponse.json({ ok: false, error: "error interno procesando el evento" }, { status: 500 });
  }
}
