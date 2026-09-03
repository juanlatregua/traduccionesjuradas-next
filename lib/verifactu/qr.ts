// lib/verifactu/qr.ts — URL de cotejo del código QR de la factura (Orden
// HAC/1177/2024, cap. VIII). Módulo PURO. El QR se dibuja en lib/invoice-pdf.ts
// SOLO cuando el registro está aceptado por la AEAT (a través del proveedor):
// una factura con QR y frase "verificable" que la AEAT no conoce es peor que
// una factura sin QR.

import { formatAmount, formatIssueDate } from "./hash.ts";

export type QrEnv = "prod" | "test";

const BASE: Record<QrEnv, string> = {
  prod: "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR",
  test: "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR",
};

export const VERIFACTU_PHRASE = "Factura verificable en la sede electrónica de la AEAT";
export const VERIFACTU_LEGEND = "VERI*FACTU";

export function buildQrUrl(input: {
  emitterNif: string;
  numSerie: string;
  issueDate: Date | string;
  importeTotalCents: number;
  env?: QrEnv;
}): string {
  const q = new URLSearchParams();
  q.set("nif", String(input.emitterNif).trim().toUpperCase());
  q.set("numserie", String(input.numSerie).trim());
  q.set("fecha", formatIssueDate(input.issueDate));
  q.set("importe", formatAmount(input.importeTotalCents));
  return `${BASE[input.env || "prod"]}?${q.toString()}`;
}
