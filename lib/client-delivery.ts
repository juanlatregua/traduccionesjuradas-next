// Fuente ÚNICA de "traducciones descargables por el CLIENTE".
// Regla de negocio: NO ENTREGAR SIN COBRAR — sin pago confirmado el cliente no
// ve ningún fichero, aunque el pedido tenga entregas persistidas (entrega
// directa sin marcar "ya pagado", etc.). El gate por deliveryState evita
// además exponer la subida SIN VERIFICAR del colaborador, que escribe
// translatedFileUrl antes de la revisión del staff (auditoría 10-jul, A1/A4).

export type ClientDeliveryFile = { url: string; filename: string | null };

export function clientVisibleDeliveryFiles(order: {
  paymentStatus: string | null;
  deliveryState: string | null;
  deliveryFilesJson?: unknown;
  finalDeliveryFileUrl?: string | null;
  translatedFileUrl?: string | null;
  finalFilename?: string | null;
}): ClientDeliveryFile[] {
  if (order.paymentStatus !== "PAID") return [];
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
