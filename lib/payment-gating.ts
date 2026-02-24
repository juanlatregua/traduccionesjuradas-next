type EventLike = {
  type?: string | null;
  payload?: unknown;
};

type OrderLike = {
  events?: EventLike[] | null;
};

function payloadHasFileUrl(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  const fileUrl = String((payload as any).fileUrl || "").trim();
  return fileUrl.length > 0;
}

export function hasUploadedSourceDocument(order: OrderLike) {
  const events = Array.isArray(order.events) ? order.events : [];
  return events.some((event) => {
    if (event?.type !== "order.source_document_uploaded") return false;
    return payloadHasFileUrl(event.payload);
  });
}

export const MISSING_SOURCE_DOCUMENT_ERROR =
  "Debes subir al menos un documento original antes de continuar al pago.";

