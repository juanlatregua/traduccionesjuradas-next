import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { sendPriceRequestAckToClient } from "@/lib/quote-email";
import { sendLeadPriceRequest, type LeadDoc } from "@/lib/lavori-lead";

export const runtime = "nodejs";

/* Solicitud de PRECIO vía lavori para un LEAD (WhatsApp/teléfono/puerta) SIN pedido,
   desde el builder: el staff sube o hereda los documentos, elige el par y los manda
   al candidato del par como encargo dirigido sin precio (adenda 11-ago-2026).
   La vuelta (precio_propuesto) aterriza en LavoriPriceRequest vía /api/lavori/eventos.
   Toda la lógica vive en lib/lavori-lead.ts (mismo carril que el enlace de un
   toque del aviso a staff); aquí solo auth, forma del body y acuse al cliente. */

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json().catch(() => null)) as {
      docs?: LeadDoc[];
      sourceLang?: string;
      targetLang?: string;
      words?: number;
      expedienteRef?: string;
      customerHint?: string;
      customerPhone?: string;
      customerEmail?: string;
      customerName?: string;
      especificaciones?: string;
      candidatos?: string[];
    } | null;

    const result = await sendLeadPriceRequest({
      docs: Array.isArray(body?.docs) ? body!.docs! : [],
      sourceLang: String(body?.sourceLang || ""),
      targetLang: String(body?.targetLang || ""),
      words: body?.words,
      especificaciones: body?.especificaciones,
      candidatos: body?.candidatos,
      expedienteRef: body?.expedienteRef,
      customerHint: body?.customerHint,
      createdBy: staff.email ?? null,
    });
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }

    // Acuse al cliente (12-ago SMS; 24-ago también email): al salir los documentos
    // hacia el traductor, el cliente recibe UN aviso — email si es real, SMS/WhatsApp
    // si es lead solo-WhatsApp. Con await: sin él, la lambda se congela al responder
    // y la llamada muere sin salir (E2E 12-ago). Un fallo del acuse no tumba el POST.
    // Solo si el encargo es NUEVO: en un reintento (repetido) el cliente ya lo recibió.
    if (!result.repetido) {
      await sendPriceRequestAckToClient({
        name: body?.customerName,
        email: body?.customerEmail,
        phone: body?.customerPhone,
      });
    }

    return NextResponse.json(
      { ok: true, ref: result.ref, encargoId: result.encargoId, repetido: result.repetido, nombres: result.nombres },
      { status: 201 }
    );
  } catch (err) {
    console.error("[lavori-price-request lead] error", err);
    return NextResponse.json(
      { ok: false, error: "Error al enviar la solicitud de precio." },
      { status: 500 }
    );
  }
}
