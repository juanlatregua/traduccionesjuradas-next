// Avisos de dinero que no pueden esperar al barrido de 24 h: rastro ANTES del envío,
// dos transportes (email + SMS a staff) e idempotentes por pedido/presupuesto.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendStaffAlertSMS } from "@/lib/sms";

const SITE = "https://www.traduccionesjuradas.net";
const adminEmail = () => process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";

export const COST_MISSING_EVENT = "finance.cost_missing_alert";
export const BRIDGE_FAILED_MARK = "[AVISO STAFF] cobro sin pedido";

/** Un automatismo asignó traductor ajeno sin coste: aviso inmediato, una vez por pedido. */
export async function alertUnpricedAssignment(input: {
  orderId: string;
  translator: string;
  origin: string;
}): Promise<void> {
  try {
    const ya = await prisma.orderEvent.findFirst({ where: { orderId: input.orderId, type: COST_MISSING_EVENT }, select: { id: true } });
    if (ya) return;
    const order = await prisma.order.findUnique({
      where: { id: input.orderId },
      select: { reference: true, clientName: true, langPair: true, amountCents: true },
    });
    if (!order) return;
    const ficha = `${SITE}/zona-traductor/pedido/${order.reference}`;
    const texto = [
      `El pedido ${order.reference} se ha asignado a ${input.translator} SIN COSTE (${input.origin}).`,
      "",
      `Cliente: ${order.clientName || "—"} · ${order.langPair || "—"} · cobrado ${(order.amountCents / 100).toFixed(2)} €`,
      "Sin la cifra del traductor no se sabe si el pedido deja margen.",
      "Acuerda el coste con el traductor y ponlo en la ficha (asignación con coste, € sin IVA).",
      ficha,
    ].join("\n");
    await prisma.orderEvent.create({
      data: {
        orderId: input.orderId,
        type: COST_MISSING_EVENT,
        message: `Asignado a ${input.translator} sin coste (${input.origin}): aviso a staff por email + SMS.`,
        payload: { translator: input.translator, origin: input.origin },
      },
    });
    await Promise.all([
      sendMail({
        to: adminEmail(),
        subject: `⚠ ${order.reference} asignado a ${input.translator} SIN COSTE`,
        text: texto,
        html: renderSimpleEmailHtml(texto),
      }).catch((err) => console.error("[coste] email fallo:", err)),
      sendStaffAlertSMS(
        `TraduccionesJuradas: ${order.reference} asignado a ${input.translator} SIN COSTE. Pon la cifra en la ficha. Mira el email.`,
        `coste_sin_cifra ${order.reference}`
      ).catch(() => {}),
    ]);
  } catch (err) {
    console.error("[coste] aviso fallo:", err);
  }
}

/** Stripe cobró un presupuesto y el puente no creó el pedido: aviso una vez por presupuesto. */
export async function alertQuoteBridgeFailure(input: {
  quoteId: string;
  quoteNumber: string;
  customerEmail: string;
  amountEur: number;
  error: string;
  stripeEventId: string;
}): Promise<void> {
  try {
    const ya = await prisma.messageLog.findFirst({ where: { quoteId: input.quoteId, subject: BRIDGE_FAILED_MARK }, select: { id: true } });
    const texto = [
      `Stripe ha cobrado el presupuesto ${input.quoteNumber} (${input.amountEur.toFixed(2)} €) y NO se ha creado el pedido.`,
      "",
      `Cliente: ${input.customerEmail}`,
      `Error: ${input.error.slice(0, 400)}`,
      `Evento Stripe: ${input.stripeEventId}`,
      "",
      "El presupuesto está PAID sin pedido: nadie ha pedido traductor. Stripe reintentará el evento; si sigue sin pedido, créalo desde el presupuesto.",
      `${SITE}/zona-traductor/presupuestos/${input.quoteId}`,
    ].join("\n");
    await prisma.messageLog.create({
      data: { quoteId: input.quoteId, channel: "EMAIL", type: "PAID_CONFIRMATION", recipient: "staff", subject: BRIDGE_FAILED_MARK, body: texto, status: "NOTICE" },
    });
    if (ya) return;
    await Promise.all([
      sendMail({
        to: adminEmail(),
        subject: `⚠ Cobro sin pedido: presupuesto ${input.quoteNumber} (${input.amountEur.toFixed(2)} €)`,
        text: texto,
        html: renderSimpleEmailHtml(texto),
      }).catch((err) => console.error("[cobro-sin-pedido] email fallo:", err)),
      sendStaffAlertSMS(
        `TraduccionesJuradas: COBRO SIN PEDIDO, presupuesto ${input.quoteNumber} ${input.amountEur.toFixed(2)} EUR. El puente fallo. Mira el email.`,
        `cobro_sin_pedido ${input.quoteNumber}`
      ).catch(() => {}),
    ]);
  } catch (err) {
    console.error("[cobro-sin-pedido] aviso fallo:", err);
  }
}
