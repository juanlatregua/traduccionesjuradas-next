// lib/verifactu/pdf.ts — Extras VeriFactu para el PDF de la factura: QR de
// cotejo y frase, SOLO cuando el registro de alta está ACEPTADO por la AEAT.
// Mientras no haya proveedor (sendStatus LOCAL) el PDF sale como hasta ahora.
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { buildQrUrl, VERIFACTU_LEGEND, VERIFACTU_PHRASE } from "@/lib/verifactu/qr";
import { verifactuEnv } from "@/lib/verifactu/provider";

export type VerifactuPdfExtras = { qrDataUrl: string; qrUrl: string; phrase: string; legend: string };

export async function verifactuPdfExtras(invoiceId: string): Promise<VerifactuPdfExtras | undefined> {
  const rec = await prisma.invoiceRecord.findFirst({
    where: { invoiceId, kind: "ALTA" },
    select: { sendStatus: true, emitterNif: true, numSerie: true, issueDate: true, importeTotalCents: true },
  });
  if (!rec || !rec.sendStatus.startsWith("ACCEPTED")) return undefined;
  const qrUrl = buildQrUrl({ emitterNif: rec.emitterNif, numSerie: rec.numSerie, issueDate: rec.issueDate, importeTotalCents: rec.importeTotalCents, env: verifactuEnv() });
  // ISO/IEC 18004, corrección M, margen de 2 módulos como pide la Orden.
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { errorCorrectionLevel: "M", margin: 2, width: 360 });
  return { qrDataUrl, qrUrl, phrase: VERIFACTU_PHRASE, legend: VERIFACTU_LEGEND };
}
