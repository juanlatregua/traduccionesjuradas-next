// lib/verifactu/alerts.ts — Aviso a staff cuando un registro VeriFactu falla, por dos
// canales (email + SMS) y UNO por registro y motivo. Mismo patrón que lib/money-alerts.ts:
// el rastro (InvoiceEvent) se escribe ANTES de enviar y es lo que da la idempotencia.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendStaffAlertSMS } from "@/lib/sms";

const adminEmail = () => process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net";

export const VERIFACTU_ALERT_EVENT = "record.alert";

export type VerifactuAlertKind = "rejected" | "send_failed" | "build_error" | "no_provider";

const LABEL: Record<VerifactuAlertKind, string> = {
  rejected: "RECHAZADO por la AEAT",
  send_failed: "ENVÍO FALLIDO a la AEAT",
  build_error: "NO SE PUEDE ENVIAR (datos incompletos)",
  no_provider: "PENDIENTE SIN PROVEEDOR configurado",
};

export async function alertVerifactuProblem(input: {
  recordId: string;
  invoiceId: string | null;
  numSerie: string;
  kind: VerifactuAlertKind;
  detail: string;
}): Promise<boolean> {
  try {
    const previous = await prisma.invoiceEvent.findFirst({
      where: {
        type: VERIFACTU_ALERT_EVENT,
        AND: [{ payload: { path: ["recordId"], equals: input.recordId } }, { payload: { path: ["kind"], equals: input.kind } }],
      },
      select: { id: true },
    });
    if (previous) return false;
    const detail = input.detail.slice(0, 600);
    await prisma.invoiceEvent.create({
      data: {
        invoiceId: input.invoiceId,
        type: VERIFACTU_ALERT_EVENT,
        actor: "system",
        message: `Aviso a staff (email + SMS): ${LABEL[input.kind]} · ${input.numSerie}.`,
        payload: { recordId: input.recordId, kind: input.kind },
      },
    });
    const texto = [
      `VeriFactu: ${input.kind === "no_provider" ? "emisor" : "la factura"} ${input.numSerie} está ${LABEL[input.kind]}.`,
      "",
      detail,
      "",
      input.kind === "no_provider" ? "Restaura VERIFACTU_PROVIDER y VERIFACTU_ENV: los registros siguen en cola." : "Mientras no se resuelva, los registros posteriores de la cadena de ese emisor no se envían.",
    ].join("\n");
    await Promise.all([
      sendMail({
        to: adminEmail(),
        subject: `⚠ VeriFactu: ${input.numSerie} ${LABEL[input.kind]}`,
        text: texto,
        html: renderSimpleEmailHtml(texto),
      }).catch((err) => console.error("[verifactu] aviso email fallo:", err)),
      sendStaffAlertSMS(`TraduccionesJuradas: VeriFactu ${input.numSerie} ${LABEL[input.kind]}. Mira el email.`, `verifactu ${input.numSerie}`).catch(() => {}),
    ]);
    return true;
  } catch (err) {
    console.error("[verifactu] aviso fallo:", err);
    return false;
  }
}
