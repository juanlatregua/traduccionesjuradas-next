// Avisos de dinero que no pueden esperar al barrido de 24 h: rastro ANTES del envío,
// dos transportes (email + SMS a staff) e idempotentes por pedido/presupuesto.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendStaffAlertSMS } from "@/lib/sms";
import { costAlertAlreadySent, AMOUNT_MISMATCH_EVENT, AMOUNT_MISMATCH_MARK } from "@/lib/money-alerts-math";

const SITE = "https://www.traduccionesjuradas.net";
const adminEmail = () => process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";

export const COST_MISSING_EVENT = "finance.cost_missing_alert";
export const BRIDGE_FAILED_MARK = "[AVISO STAFF] cobro sin pedido";
export const BRIDGE_RESOLVED_MARK = "[AVISO STAFF] cobro sin pedido resuelto";

/** Un automatismo asignó traductor ajeno sin coste: aviso inmediato, una vez por pedido y traductor. */
export async function alertUnpricedAssignment(input: {
  orderId: string;
  translator: string;
  origin: string;
}): Promise<void> {
  try {
    const previos = await prisma.orderEvent.findMany({ where: { orderId: input.orderId, type: COST_MISSING_EVENT }, select: { payload: true } });
    if (costAlertAlreadySent(previos, input.translator)) return;
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
}): Promise<number> {
  try {
    const previos = await prisma.messageLog.count({ where: { quoteId: input.quoteId, subject: BRIDGE_FAILED_MARK } });
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
    if (previos > 0) return previos + 1;
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
    return 1;
  } catch (err) {
    console.error("[cobro-sin-pedido] aviso fallo:", err);
    return 1;
  }
}

/** Un reintento sí creó el pedido tras un aviso de cobro sin pedido: se dice, una vez. */
export async function alertQuoteBridgeResolved(input: { quoteId: string; quoteNumber: string }): Promise<void> {
  try {
    const [fallos, resuelto] = await Promise.all([
      prisma.messageLog.count({ where: { quoteId: input.quoteId, subject: BRIDGE_FAILED_MARK } }),
      prisma.messageLog.count({ where: { quoteId: input.quoteId, subject: BRIDGE_RESOLVED_MARK } }),
    ]);
    if (fallos === 0 || resuelto > 0) return;
    const order = await prisma.order.findFirst({ where: { quoteId: input.quoteId }, select: { reference: true } });
    const texto = `Resuelto: el presupuesto ${input.quoteNumber} ya tiene pedido${order ? ` (${order.reference})` : ""} tras ${fallos} intento(s) fallido(s) del puente.${order ? `\n${SITE}/zona-traductor/pedido/${order.reference}` : ""}`;
    await prisma.messageLog.create({
      data: { quoteId: input.quoteId, channel: "EMAIL", type: "PAID_CONFIRMATION", recipient: "staff", subject: BRIDGE_RESOLVED_MARK, body: texto, status: "NOTICE" },
    });
    await Promise.all([
      sendMail({ to: adminEmail(), subject: `✅ Cobro con pedido: presupuesto ${input.quoteNumber}`, text: texto, html: renderSimpleEmailHtml(texto) }).catch((err) =>
        console.error("[cobro-sin-pedido] email resuelto fallo:", err)
      ),
      sendStaffAlertSMS(`TraduccionesJuradas: resuelto, el presupuesto ${input.quoteNumber} ya tiene pedido${order ? ` ${order.reference}` : ""}.`, `cobro_resuelto ${input.quoteNumber}`).catch(() => {}),
    ]);
  } catch (err) {
    console.error("[cobro-sin-pedido] aviso resuelto fallo:", err);
  }
}

/** Pasarela y servidor no coinciden en el importe cobrado: no se marca PAID, aviso por dos canales. */
export async function alertPaymentAmountMismatch(input: {
  via: string;
  ref: string;
  orderReference?: string;
  quoteId?: string;
  expectedCents: number;
  receivedCents: number | null;
  detail?: string;
}): Promise<void> {
  const eur = (c: number | null) => (c == null ? "desconocido" : `${(c / 100).toFixed(2)} €`);
  const texto = [
    `IMPORTE NO COINCIDE (${input.via}) en ${input.ref}: cobrado ${eur(input.receivedCents)}, esperado ${eur(input.expectedCents)}.`,
    "El pedido/presupuesto NO se ha marcado como pagado. Revisa el cobro en la pasarela y devuélvelo o regulariza a mano.",
    input.detail || "",
  ]
    .filter(Boolean)
    .join("\n");
  console.error("[pago-importe]", texto);
  try {
    if (input.orderReference) {
      const order = await prisma.order.findUnique({ where: { reference: input.orderReference }, select: { id: true } });
      if (order) {
        await prisma.orderEvent.create({
          data: {
            orderId: order.id,
            type: AMOUNT_MISMATCH_EVENT,
            message: texto,
            payload: { via: input.via, expectedCents: input.expectedCents, receivedCents: input.receivedCents, detail: input.detail || null },
          },
        });
      }
    }
    if (input.quoteId) {
      await prisma.messageLog.create({
        data: { quoteId: input.quoteId, channel: "EMAIL", type: "PAID_CONFIRMATION", recipient: "staff", subject: AMOUNT_MISMATCH_MARK, body: texto, status: "NOTICE" },
      });
    }
  } catch (err) {
    console.error("[pago-importe] rastro fallo:", err);
  }
  await Promise.all([
    sendMail({ to: adminEmail(), subject: `⚠ Importe no coincide: ${input.ref} (${input.via})`, text: texto, html: renderSimpleEmailHtml(texto) }).catch((err) =>
      console.error("[pago-importe] email fallo:", err)
    ),
    sendStaffAlertSMS(
      `TraduccionesJuradas: IMPORTE NO COINCIDE ${input.via} ${input.ref}, cobrado ${eur(input.receivedCents)} vs esperado ${eur(input.expectedCents)}. NO marcado pagado. Mira el email.`,
      `importe_no_coincide ${input.ref}`
    ).catch(() => {}),
  ]);
}
