// Fuente ÚNICA de "documentos fuente del pedido" a partir de OrderEvents.
// Antes esta lógica estaba copiada en 4 sitios (cockpit, workspace, área
// cliente y collaborators) con shapes ligeramente distintos — cualquier cambio
// del formato de payload rompía 4 pantallas de 3 audiencias (P1-7 auditoría
// 9-jul). Emisores del evento: subida manual (orders/[reference]/documents),
// funnel (wireSessionDocsToOrder) y presupuesto (populateOrderItemsFromQuote).

export type SourceDocument = {
  name: string;
  url?: string;
  type?: string;
  uploadedAt?: string;
};

type EventLike = { type: string; payload: unknown; createdAt?: Date };

export function getSourceDocumentsFromEvents(events: EventLike[]): SourceDocument[] {
  const uploaded: SourceDocument[] = events
    .filter((e) => e.type === "order.source_document_uploaded")
    .map((e) => {
      const payload = (e.payload || {}) as Record<string, unknown>;
      return {
        name: String(payload.fileName || "Documento"),
        url: payload.fileUrl ? String(payload.fileUrl) : undefined,
        type: payload.fileType ? String(payload.fileType) : undefined,
        uploadedAt: String(payload.uploadedAt || e.createdAt?.toISOString?.() || "") || undefined,
      };
    });

  const submitted = events.find((e) => e.type === "presupuesto.submitted");
  const submittedFiles: SourceDocument[] = (() => {
    if (!submitted) return [];
    const payload = (submitted.payload || {}) as Record<string, unknown>;
    const files = Array.isArray(payload.files) ? payload.files : [];
    return files.map((file) => {
      const f = (file || {}) as Record<string, unknown>;
      return {
        name: String(f.name || "Documento"),
        url: f.url ? String(f.url) : undefined,
        type: f.type ? String(f.type) : undefined,
        uploadedAt:
          String(f.uploadedAt || submitted.createdAt?.toISOString?.() || "") || undefined,
      };
    });
  })();

  const seen = new Set<string>();
  return [...uploaded, ...submittedFiles].filter((doc) => {
    if (!doc.url) return true;
    if (seen.has(doc.url)) return false;
    seen.add(doc.url);
    return true;
  });
}
