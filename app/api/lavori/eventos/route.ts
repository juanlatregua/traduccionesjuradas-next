import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { notifyClientTranslationStarted } from "@/lib/orders";
import { LAVORI_MEMBER_COLLABORATOR_EMAIL } from "@/lib/lavori-bridge";

export const runtime = "nodejs";

/* Fase 1.5 del puente — VUELTA lavori→motor (contrato propuesto 11-ago-2026).
   Un solo endpoint con 3 eventos, auth simétrica a la ida (MOTOR_LAVORI_SECRET):
   - precio_propuesto  → OrderEvent + aviso a staff con el precio y el neto 75/25 sugerido
   - encargo_aceptado  → asignación automática del colaborador (cierra la vuelta manual v1)
   - factura_subida    → Expense pendiente de revisión en contabilidad
   Idempotencia por (evento, encargoId) dentro del pedido: repetir es seguro. */

const STAFF_ALERT_EMAIL = process.env.ADMIN_EMAIL || "info@traduccionesjuradas.net";

const EVENTO_TIPOS = ["precio_propuesto", "encargo_aceptado", "factura_subida"] as const;
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
    select: { id: true, reference: true, langPair: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: `pedido "${reference}" no encontrado` }, { status: 404 });
  }

  const eventType = `lavori.${evento}`;
  const previo = await prisma.orderEvent.findFirst({
    where: { orderId: order.id, type: eventType, payload: { path: ["encargoId"], equals: encargoId } },
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
      await staffMail(`💶 Precio de ${miembro} para ${order.reference}: ${precio} €`, [
        `${miembro} ha propuesto ${precio} € por el encargo de lavori (${encargoId}).`,
        datos.plazoDias ? `Plazo propuesto: ${datos.plazoDias} días.` : "Sin plazo indicado.",
        `Neto de cliente sugerido por el modelo 75/25: ${netoSugerido} € (+ IVA y envío).`,
        datos.notas ? `Notas: ${String(datos.notas)}` : "",
        `Ficha: ${ficha}`,
      ].filter(Boolean));
    }

    if (evento === "encargo_aceptado") {
      const miembroId = String(datos.miembroId || "");
      const email = LAVORI_MEMBER_COLLABORATOR_EMAIL[miembroId];
      const collaborator = email
        ? await prisma.collaborator.findUnique({ where: { email } })
        : null;
      const miembro = String(datos.miembroNombre || miembroId || "el traductor");

      if (collaborator) {
        await prisma.collaboratorAssignment.upsert({
          where: { orderId_collaboratorId: { orderId: order.id, collaboratorId: collaborator.id } },
          create: { orderId: order.id, collaboratorId: collaborator.id, status: "ACCEPTED", acceptedAt: new Date() },
          update: { status: "ACCEPTED", acceptedAt: new Date(), rejectedAt: null, rejectionReason: null },
        });
        await prisma.order.update({ where: { id: order.id }, data: { assignedTo: collaborator.fullName } });
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
          attachmentUrl: datos.url ? String(datos.url) : null,
          attachmentName: datos.nombre ? String(datos.nombre) : null,
          notes: `Creado por el webhook lavori (Fase 1.5). Revisar régimen fiscal (IVA/ISP/IRPF) antes de dar por bueno.`,
        },
      });
      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: eventType,
          message: `lavori: factura del sobre recibida (${supplier}${totalCents ? `, ${(totalCents / 100).toFixed(2)} €` : ""}) — gasto en contabilidad pendiente de revisión.`,
          payload: { encargoId, motorRef, ...datos, expenseId: expense.id },
        },
      });
      await staffMail(`🧾 Factura de ${supplier} (${order.reference}) — revisar en contabilidad`, [
        `Ha llegado por lavori la factura del encargo ${encargoId} (pedido ${order.reference}).`,
        totalCents ? `Importe: ${(totalCents / 100).toFixed(2)} €.` : "Sin importe legible: revísala.",
        `Gasto creado en contabilidad como PENDIENTE y needsReview (régimen fiscal por confirmar).`,
        `Ficha: ${ficha}`,
      ]);
    }

    return NextResponse.json({ ok: true, repetido: false }, { status: 201 });
  } catch (err) {
    console.error("[lavori-eventos] error", err);
    return NextResponse.json({ ok: false, error: "error interno procesando el evento" }, { status: 500 });
  }
}
