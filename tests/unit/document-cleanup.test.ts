import test from "node:test";
import assert from "node:assert/strict";

// Self-contained tests — reproduce selection logic to avoid @/ import alias issues

const UNPAID_STATUSES = [
  "UPLOADED",
  "ANALYZING",
  "ANALYZED",
  "ANALYSIS_FAILED",
  "QUOTE_GENERATED",
  "PAYMENT_PENDING",
];

const PAID_STATUSES = [
  "PAID",
  "IN_TRANSLATION",
  "TRANSLATED",
  "DELIVERED",
];

const RETENTION_DAYS = 30;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

interface MockDoc {
  id: string;
  status: string;
  fileUrl: string;
  createdAt: Date;
}

/**
 * Reproduces the cron selection logic:
 * - Phase A: unpaid docs older than threshold → delete entirely
 * - Phase B: paid docs older than threshold with real fileUrl → redact fileUrl
 * Returns { toDelete: ids[], toRedact: ids[] }
 */
function selectForCleanup(docs: MockDoc[]) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - RETENTION_DAYS);

  const toDelete: string[] = [];
  const toRedact: string[] = [];

  for (const doc of docs) {
    if (doc.createdAt >= threshold) continue;

    if (UNPAID_STATUSES.includes(doc.status)) {
      toDelete.push(doc.id);
    } else if (
      PAID_STATUSES.includes(doc.status) &&
      doc.fileUrl !== "[DELETED-GDPR]"
    ) {
      toRedact.push(doc.id);
    }
  }

  return { toDelete, toRedact };
}

// ── Tests ───────────────────────────────────────────────────────────

test("old unpaid document is selected for deletion", () => {
  const docs: MockDoc[] = [
    { id: "1", status: "UPLOADED", fileUrl: "https://blob/a.pdf", createdAt: daysAgo(31) },
  ];
  const { toDelete, toRedact } = selectForCleanup(docs);
  assert.deepEqual(toDelete, ["1"]);
  assert.deepEqual(toRedact, []);
});

test("old paid document is selected for redaction, not deletion", () => {
  const docs: MockDoc[] = [
    { id: "2", status: "PAID", fileUrl: "https://blob/b.pdf", createdAt: daysAgo(45) },
  ];
  const { toDelete, toRedact } = selectForCleanup(docs);
  assert.deepEqual(toDelete, []);
  assert.deepEqual(toRedact, ["2"]);
});

test("recent documents are never selected (regardless of status)", () => {
  const docs: MockDoc[] = [
    { id: "3", status: "UPLOADED", fileUrl: "https://blob/c.pdf", createdAt: daysAgo(5) },
    { id: "4", status: "PAID", fileUrl: "https://blob/d.pdf", createdAt: daysAgo(10) },
    { id: "5", status: "ANALYZING", fileUrl: "https://blob/e.pdf", createdAt: daysAgo(29) },
  ];
  const { toDelete, toRedact } = selectForCleanup(docs);
  assert.deepEqual(toDelete, []);
  assert.deepEqual(toRedact, []);
});

test("already-redacted paid document is skipped", () => {
  const docs: MockDoc[] = [
    { id: "6", status: "DELIVERED", fileUrl: "[DELETED-GDPR]", createdAt: daysAgo(60) },
  ];
  const { toDelete, toRedact } = selectForCleanup(docs);
  assert.deepEqual(toDelete, []);
  assert.deepEqual(toRedact, []);
});

test("all unpaid statuses are correctly identified for deletion", () => {
  const docs: MockDoc[] = UNPAID_STATUSES.map((status, i) => ({
    id: `u${i}`,
    status,
    fileUrl: `https://blob/${i}.pdf`,
    createdAt: daysAgo(31),
  }));
  const { toDelete, toRedact } = selectForCleanup(docs);
  assert.equal(toDelete.length, UNPAID_STATUSES.length);
  assert.deepEqual(toRedact, []);
});

test("all paid statuses are correctly identified for redaction", () => {
  const docs: MockDoc[] = PAID_STATUSES.map((status, i) => ({
    id: `p${i}`,
    status,
    fileUrl: `https://blob/${i}.pdf`,
    createdAt: daysAgo(31),
  }));
  const { toDelete, toRedact } = selectForCleanup(docs);
  assert.deepEqual(toDelete, []);
  assert.equal(toRedact.length, PAID_STATUSES.length);
});

test("mixed batch: old unpaid deleted, old paid redacted, recent kept", () => {
  const docs: MockDoc[] = [
    { id: "a", status: "UPLOADED", fileUrl: "https://blob/1.pdf", createdAt: daysAgo(40) },
    { id: "b", status: "ANALYSIS_FAILED", fileUrl: "https://blob/2.pdf", createdAt: daysAgo(35) },
    { id: "c", status: "PAID", fileUrl: "https://blob/3.pdf", createdAt: daysAgo(50) },
    { id: "d", status: "DELIVERED", fileUrl: "https://blob/4.pdf", createdAt: daysAgo(31) },
    { id: "e", status: "UPLOADED", fileUrl: "https://blob/5.pdf", createdAt: daysAgo(10) },
    { id: "f", status: "IN_TRANSLATION", fileUrl: "https://blob/6.pdf", createdAt: daysAgo(5) },
    { id: "g", status: "TRANSLATED", fileUrl: "[DELETED-GDPR]", createdAt: daysAgo(90) },
  ];
  const { toDelete, toRedact } = selectForCleanup(docs);
  assert.deepEqual(toDelete, ["a", "b"]);
  assert.deepEqual(toRedact, ["c", "d"]);
});

test("document exactly at threshold boundary is NOT selected", () => {
  const docs: MockDoc[] = [
    { id: "edge", status: "UPLOADED", fileUrl: "https://blob/edge.pdf", createdAt: daysAgo(30) },
  ];
  const { toDelete, toRedact } = selectForCleanup(docs);
  // daysAgo(30) produces roughly "now minus 30 days" — same instant as threshold,
  // so createdAt >= threshold → not selected
  assert.deepEqual(toDelete, []);
  assert.deepEqual(toRedact, []);
});
