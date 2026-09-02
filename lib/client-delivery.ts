// Fuente ÚNICA de "traducciones descargables por el CLIENTE".
// Regla de negocio: NO ENTREGAR SIN COBRAR — sin pago confirmado el cliente no
// ve ningún fichero, aunque el pedido tenga entregas persistidas (entrega
// directa sin marcar "ya pagado", etc.). El gate por deliveryState evita
// además exponer la subida SIN VERIFICAR del colaborador, que escribe
// translatedFileUrl antes de la revisión del staff (auditoría 10-jul, A1/A4).
//
// ÚNICA EXCEPCIÓN (Juan, 2-sep-2026): el carril de COBRO APLAZADO. "Se puede
// entregar y trabajar con determinados clientes" — empresas que aprueban, se
// traduce, se entrega y pagan a 30 días. La regla NO se relaja: se sustituye
// "cobrado" por "asegurado", que exige una FACTURA EMITIDA con vencimiento
// (isOrderSecured). Sin factura numerada y declarada no hay entrega, así que
// nadie descarga nada por estar simplemente "aprobado". Ver lib/credit-terms.ts.

import { isOrderSecured, type CreditInvoice } from "@/lib/credit-terms";

export type ClientDeliveryFile = { url: string; filename: string | null };

export function clientVisibleDeliveryFiles(order: {
  paymentStatus: string | null;
  deliveryState: string | null;
  deliveryFilesJson?: unknown;
  finalDeliveryFileUrl?: string | null;
  translatedFileUrl?: string | null;
  finalFilename?: string | null;
  clientInvoice?: CreditInvoice | null;
}): ClientDeliveryFile[] {
  if (!isOrderSecured(order)) return [];
  if (order.deliveryState !== "TRADUCIDO") return [];
  const raw = Array.isArray(order.deliveryFilesJson) ? order.deliveryFilesJson : [];
  const files = (raw as Array<{ url?: unknown; filename?: unknown }>)
    .filter((f) => f && typeof f.url === "string" && (f.url as string).trim())
    .map((f) => ({ url: String(f.url), filename: f.filename ? String(f.filename) : null }));
  if (files.length > 0) return files;
  const single =
    String(order.finalDeliveryFileUrl || "").trim() || String(order.translatedFileUrl || "").trim();
  return single ? [{ url: single, filename: order.finalFilename || null }] : [];
}
