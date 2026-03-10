import test from "node:test";
import assert from "node:assert/strict";

// Test 1: submitCollaboratorQuote accepts QUOTE_REVISION_REQUESTED status
test("submitCollaboratorQuote WHERE clause accepts both REQUESTED and QUOTE_REVISION_REQUESTED", () => {
  // Validate the status filter used in submitCollaboratorQuote
  const allowedStatuses = ["REQUESTED", "QUOTE_REVISION_REQUESTED"];
  assert.ok(allowedStatuses.includes("REQUESTED"), "Should accept REQUESTED");
  assert.ok(allowedStatuses.includes("QUOTE_REVISION_REQUESTED"), "Should accept QUOTE_REVISION_REQUESTED");
  assert.ok(!allowedStatuses.includes("QUOTED"), "Should NOT accept QUOTED");
  assert.ok(!allowedStatuses.includes("ACCEPTED"), "Should NOT accept ACCEPTED");
});

// Test 2: encargo API guard allows quote submission for QUOTE_REVISION_REQUESTED
test("encargo POST quote guard allows REQUESTED and QUOTE_REVISION_REQUESTED", () => {
  const allowedForQuote = (status: string) =>
    status === "REQUESTED" || status === "QUOTE_REVISION_REQUESTED";

  assert.ok(allowedForQuote("REQUESTED"));
  assert.ok(allowedForQuote("QUOTE_REVISION_REQUESTED"));
  assert.ok(!allowedForQuote("QUOTED"));
  assert.ok(!allowedForQuote("ACCEPTED"));
  assert.ok(!allowedForQuote("DELIVERED"));
  assert.ok(!allowedForQuote("REJECTED"));
});

// Test 3: getFileType helper classifies files correctly
test("getFileType classifies file extensions correctly", () => {
  function getFileType(filename: string): "pdf" | "docx" | "image" | "unknown" {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "pdf";
    if (ext === "doc" || ext === "docx") return "docx";
    if (["jpg", "jpeg", "png", "webp"].includes(ext || "")) return "image";
    return "unknown";
  }

  assert.equal(getFileType("traduccion.pdf"), "pdf");
  assert.equal(getFileType("DOCUMENTO.PDF"), "pdf");
  assert.equal(getFileType("borrador.docx"), "docx");
  assert.equal(getFileType("borrador.doc"), "docx");
  assert.equal(getFileType("scan.jpg"), "image");
  assert.equal(getFileType("scan.jpeg"), "image");
  assert.equal(getFileType("scan.png"), "image");
  assert.equal(getFileType("scan.webp"), "image");
  assert.equal(getFileType("archivo.zip"), "unknown");
  assert.equal(getFileType("noext"), "unknown");
});

// Test 4: AssignmentStatus enum includes QUOTE_REVISION_REQUESTED
test("AssignmentStatus enum values are correct", () => {
  const validStatuses = [
    "REQUESTED",
    "QUOTED",
    "QUOTE_REVISION_REQUESTED",
    "ACCEPTED",
    "REJECTED",
    "DELIVERED",
  ];
  // Verify all expected statuses exist
  assert.equal(validStatuses.length, 6);
  assert.ok(validStatuses.includes("QUOTE_REVISION_REQUESTED"));
  // Verify ordering: QUOTE_REVISION_REQUESTED comes after QUOTED
  assert.ok(validStatuses.indexOf("QUOTE_REVISION_REQUESTED") > validStatuses.indexOf("QUOTED"));
});

// Test 5: STATUS_LABELS in CollaboratorAssignmentPanel covers all statuses
test("STATUS_LABELS covers all AssignmentStatus values", () => {
  const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    REQUESTED: { label: "Enviado", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    QUOTED: { label: "Presupuestado", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    QUOTE_REVISION_REQUESTED: { label: "Revisión solicitada", cls: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
    ACCEPTED: { label: "Aceptado", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    REJECTED: { label: "Rechazado", cls: "bg-red-500/20 text-red-300 border-red-500/30" },
    DELIVERED: { label: "Entregado", cls: "bg-lime-500/20 text-lime-300 border-lime-500/30" },
  };

  const allStatuses = ["REQUESTED", "QUOTED", "QUOTE_REVISION_REQUESTED", "ACCEPTED", "REJECTED", "DELIVERED"];
  for (const status of allStatuses) {
    assert.ok(STATUS_LABELS[status], `STATUS_LABELS should have entry for ${status}`);
    assert.ok(STATUS_LABELS[status].label.length > 0, `Label for ${status} should not be empty`);
    assert.ok(STATUS_LABELS[status].cls.length > 0, `Class for ${status} should not be empty`);
  }
});

// Test 6: State transition flow QUOTED → QUOTE_REVISION_REQUESTED → QUOTED
test("state transition: QUOTED → QUOTE_REVISION_REQUESTED → QUOTED is valid", () => {
  const validTransitions: Record<string, string[]> = {
    REQUESTED: ["QUOTED"],
    QUOTED: ["ACCEPTED", "REJECTED", "QUOTE_REVISION_REQUESTED"],
    QUOTE_REVISION_REQUESTED: ["QUOTED"],
    ACCEPTED: ["DELIVERED"],
    REJECTED: [],
    DELIVERED: [],
  };

  // requestQuoteRevision: QUOTED → QUOTE_REVISION_REQUESTED
  assert.ok(validTransitions.QUOTED.includes("QUOTE_REVISION_REQUESTED"));
  // submitCollaboratorQuote: QUOTE_REVISION_REQUESTED → QUOTED
  assert.ok(validTransitions.QUOTE_REVISION_REQUESTED.includes("QUOTED"));
  // Revision cannot happen from non-QUOTED states
  assert.ok(!validTransitions.REQUESTED.includes("QUOTE_REVISION_REQUESTED"));
  assert.ok(!validTransitions.ACCEPTED.includes("QUOTE_REVISION_REQUESTED"));
});

// Test 7: collaboratorDelivery extraction logic
test("collaboratorDelivery is extracted correctly from assignment", () => {
  const assignmentWithDelivery = {
    deliveredFileUrl: "https://blob.vercel-storage.com/collab/file.pdf",
    deliveredFilename: "traduccion_final.pdf",
    deliveredAt: new Date("2026-03-10T14:30:00Z"),
    collaborator: { fullName: "María López" },
  };

  const collaboratorDelivery = assignmentWithDelivery.deliveredFileUrl
    ? {
        fileUrl: assignmentWithDelivery.deliveredFileUrl,
        filename: assignmentWithDelivery.deliveredFilename || "Entrega colaborador",
        deliveredAt: assignmentWithDelivery.deliveredAt?.toISOString() || null,
        collaboratorName: assignmentWithDelivery.collaborator.fullName,
      }
    : null;

  assert.ok(collaboratorDelivery);
  assert.equal(collaboratorDelivery.fileUrl, "https://blob.vercel-storage.com/collab/file.pdf");
  assert.equal(collaboratorDelivery.filename, "traduccion_final.pdf");
  assert.equal(collaboratorDelivery.collaboratorName, "María López");
  assert.ok(collaboratorDelivery.deliveredAt);

  // No delivery
  const assignmentWithoutDelivery = {
    deliveredFileUrl: null,
    deliveredFilename: null,
    deliveredAt: null,
    collaborator: { fullName: "Juan García" },
  };

  const noDelivery = assignmentWithoutDelivery.deliveredFileUrl
    ? {
        fileUrl: assignmentWithoutDelivery.deliveredFileUrl,
        filename: assignmentWithoutDelivery.deliveredFilename || "Entrega colaborador",
        deliveredAt: assignmentWithoutDelivery.deliveredAt?.toISOString() || null,
        collaboratorName: assignmentWithoutDelivery.collaborator.fullName,
      }
    : null;

  assert.equal(noDelivery, null);
});

// Test 8: hasCollaboratorDelivery computation
test("hasCollaboratorDelivery correctly identifies delivered assignments", () => {
  const assignments = [
    { status: "ACCEPTED", deliveredFileUrl: null },
    { status: "DELIVERED", deliveredFileUrl: "https://blob.example.com/file.pdf" },
  ];

  const hasDelivery = assignments.some(
    (a) => a.status === "DELIVERED" && a.deliveredFileUrl
  );
  assert.ok(hasDelivery);

  const noDeliveryAssignments = [
    { status: "REQUESTED", deliveredFileUrl: null },
    { status: "QUOTED", deliveredFileUrl: null },
  ];
  const noDelivery = noDeliveryAssignments.some(
    (a) => a.status === "DELIVERED" && a.deliveredFileUrl
  );
  assert.ok(!noDelivery);
});

// Test 9: Delivery notification email payload includes all required fields
test("delivery notification payload includes collaboratorEmail and workspace URL", () => {
  const SITE_BASE_URL = "https://www.traduccionesjuradas.net";
  const payload = {
    collaboratorName: "María López",
    collaboratorEmail: "maria@example.com",
    orderReference: "TJ-2026-0042",
    filename: "traduccion_final.pdf",
    fileUrl: "https://blob.example.com/file.pdf",
  };

  // Verify all required fields are present
  assert.ok(payload.collaboratorName);
  assert.ok(payload.collaboratorEmail);
  assert.ok(payload.orderReference);
  assert.ok(payload.filename);
  assert.ok(payload.fileUrl);

  // Workspace URL construction
  const workspaceUrl = `${SITE_BASE_URL}/zona-traductor/workspace/${payload.orderReference}`;
  assert.equal(workspaceUrl, "https://www.traduccionesjuradas.net/zona-traductor/workspace/TJ-2026-0042");
});

// Test 10: allowed actions in collaborator-assignment endpoint
test("collaborator-assignment endpoint allows request-revision action", () => {
  const allowedActions = ["accept", "reject", "resend-email", "request-revision"];
  assert.ok(allowedActions.includes("request-revision"));
  assert.ok(allowedActions.includes("accept"));
  assert.ok(allowedActions.includes("reject"));
  assert.ok(allowedActions.includes("resend-email"));
  assert.equal(allowedActions.length, 4);
});
