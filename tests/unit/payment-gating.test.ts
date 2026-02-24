import test from "node:test";
import assert from "node:assert/strict";
import { hasUploadedSourceDocument, MISSING_SOURCE_DOCUMENT_ERROR } from "../../lib/payment-gating.ts";

test("detecta documento fuente cuando existe evento con fileUrl", () => {
  const hasDoc = hasUploadedSourceDocument({
    events: [
      { type: "workflow.state_changed", payload: { to: "PENDIENTE_PAGO" } },
      {
        type: "order.source_document_uploaded",
        payload: { fileUrl: "https://blob.vercel-storage.com/orders/26_001/doc.pdf" },
      },
    ],
  });

  assert.equal(hasDoc, true);
});

test("bloquea pago cuando no hay documento fuente", () => {
  const hasDoc = hasUploadedSourceDocument({
    events: [{ type: "workflow.state_changed", payload: { to: "PENDIENTE_PAGO" } }],
  });

  assert.equal(hasDoc, false);
  assert.equal(
    MISSING_SOURCE_DOCUMENT_ERROR,
    "Debes subir al menos un documento original antes de continuar al pago."
  );
});

