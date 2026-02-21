import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isStaffEmail } from "@/lib/staff-access";
import { getOrderDetail, updateDeliveryState } from "@/lib/orders";
import { sendTranslationEtaEmail, sendTranslationReadyEmail } from "@/lib/email";
import { addBusinessDays, formatEta, getHolidaySetFromEnv, suggestEtaBusinessDays } from "@/lib/eta";

export const runtime = "nodejs";

type Params = { params: { reference: string } };

type DeliveryBody = {
  state?: "EN_PROCESO" | "TRADUCIDO";
  translatedFileUrl?: string;
  notifyClient?: boolean;
  etaDate?: string;
  autoEta?: boolean;
};

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isStaffEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Acceso denegado." }, { status: 403 });
  }

  try {
    const order = await getOrderDetail(params.reference);
    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    const body = (await req.json()) as DeliveryBody;
    const state = body.state || "EN_PROCESO";
    const translatedFileUrl = (body.translatedFileUrl || "").trim();
    const etaDateRaw = (body.etaDate || "").trim();

    if (order.paymentStatus !== "PAID") {
      return NextResponse.json(
        { ok: false, error: "No se puede avanzar la entrega en pedidos pendientes de pago." },
        { status: 400 }
      );
    }

    if (state === "TRADUCIDO" && !translatedFileUrl) {
      return NextResponse.json(
        { ok: false, error: "Para marcar como traducido debes adjuntar URL del archivo." },
        { status: 400 }
      );
    }

    let etaDate: Date | null | undefined;
    let etaMessage = "";

    if (state === "EN_PROCESO") {
      if (body.autoEta === false && !etaDateRaw) {
        return NextResponse.json(
          { ok: false, error: "Debes indicar una ETA manual o activar el calculo automatico." },
          { status: 400 }
        );
      }

      if (etaDateRaw) {
        const parsed = new Date(etaDateRaw);
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ ok: false, error: "Fecha ETA no valida." }, { status: 400 });
        }
        parsed.setHours(12, 0, 0, 0);
        etaDate = parsed;
      } else if (body.autoEta !== false) {
        const businessDays = suggestEtaBusinessDays({
          words: order.words,
          pagesLabel: order.pagesLabel,
          langPair: order.langPair,
        });
        etaDate = addBusinessDays(new Date(), businessDays, getHolidaySetFromEnv());
      }

      if (etaDate) {
        etaMessage = ` ETA: ${formatEta(etaDate)}.`;
      }
    }

    await updateDeliveryState(order.reference, state, {
      translatedFileUrl: translatedFileUrl || undefined,
      dueDate: state === "EN_PROCESO" ? etaDate : undefined,
      eventMessage: `Estado de entrega actualizado a ${state}.${etaMessage}`.trim(),
    });

    if (state === "EN_PROCESO" && etaDate) {
      sendTranslationEtaEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        etaDateLabel: formatEta(etaDate),
      }).catch((e) => console.error("[orders-delivery] eta email failed", e));
    }

    if (body.notifyClient && state === "TRADUCIDO" && translatedFileUrl) {
      sendTranslationReadyEmail({
        toEmail: order.clientEmail,
        reference: order.reference,
        downloadUrl: translatedFileUrl,
      }).catch((e) => console.error("[orders-delivery] ready email failed", e));
    }

    return NextResponse.json({
      ok: true,
      etaDate: etaDate ? etaDate.toISOString().slice(0, 10) : null,
    });
  } catch (err: any) {
    console.error("[orders-delivery] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al actualizar la entrega." },
      { status: 500 }
    );
  }
}
