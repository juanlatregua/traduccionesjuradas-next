import test from "node:test";
import assert from "node:assert/strict";
import { hashFileBuffer, pickReusableTwin, type TwinCandidate } from "../../lib/document-dedup.ts";

const d = (iso: string) => new Date(iso);

function cand(p: Partial<TwinCandidate> & { id: string }): TwinCandidate {
  return {
    status: "QUOTE_GENERATED",
    analysisJson: { document_type: { specific_type: "titulo" } },
    clientEmail: "cliente@example.com",
    sessionToken: "sess-1",
    createdAt: d("2026-09-01T10:00:00Z"),
    ...p,
  };
}

test("hashFileBuffer: mismo contenido = mismo hash; un byte distinto lo cambia", () => {
  const a = hashFileBuffer(Buffer.from("documento jurado"));
  const b = hashFileBuffer(Buffer.from("documento jurado"));
  const c = hashFileBuffer(Buffer.from("documento jurada"));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("reutiliza el análisis del MISMO cliente por email", () => {
  const twin = pickReusableTwin([cand({ id: "viejo" })], {
    documentId: "nuevo",
    clientEmail: "CLIENTE@example.com", // mayúsculas y espacios no deben romperlo
    sessionToken: null,
  });
  assert.equal(twin?.id, "viejo");
});

test("reutiliza por sesión aunque todavía no haya email (la puerta lo pide durante el spinner)", () => {
  const twin = pickReusableTwin([cand({ id: "viejo", clientEmail: null })], {
    documentId: "nuevo",
    clientEmail: null,
    sessionToken: "sess-1",
  });
  assert.equal(twin?.id, "viejo");
});

test("NO reutiliza el análisis de OTRO cliente — el JSON lleva nombres y fechas del documento", () => {
  const twin = pickReusableTwin(
    [cand({ id: "de-otro", clientEmail: "otro@example.com", sessionToken: "sess-9" })],
    { documentId: "nuevo", clientEmail: "cliente@example.com", sessionToken: "sess-1" }
  );
  assert.equal(twin, null);
});

test("NO reutiliza análisis incompletos ni fallidos", () => {
  const candidatos = [
    cand({ id: "fallido", status: "ANALYSIS_FAILED" }),
    cand({ id: "subido", status: "UPLOADED" }),
    cand({ id: "analizando", status: "ANALYZING" }),
    cand({ id: "sin-json", analysisJson: null }),
  ];
  const twin = pickReusableTwin(candidatos, {
    documentId: "nuevo",
    clientEmail: "cliente@example.com",
    sessionToken: "sess-1",
  });
  assert.equal(twin, null);
});

test("nunca se reutiliza a sí mismo", () => {
  const twin = pickReusableTwin([cand({ id: "yo" })], {
    documentId: "yo",
    clientEmail: "cliente@example.com",
    sessionToken: "sess-1",
  });
  assert.equal(twin, null);
});

test("entre varios gemelos gana el más reciente (reescaneo mejor del mismo fichero)", () => {
  const twin = pickReusableTwin(
    [
      cand({ id: "antiguo", createdAt: d("2026-08-01T09:00:00Z") }),
      cand({ id: "reciente", createdAt: d("2026-09-10T09:00:00Z") }),
      cand({ id: "medio", createdAt: d("2026-08-20T09:00:00Z") }),
    ],
    { documentId: "nuevo", clientEmail: "cliente@example.com", sessionToken: "sess-1" }
  );
  assert.equal(twin?.id, "reciente");
});

test("sin email ni sesión no reutiliza nada (no se cruzan fichas a ciegas)", () => {
  const twin = pickReusableTwin([cand({ id: "viejo" })], {
    documentId: "nuevo",
    clientEmail: null,
    sessionToken: null,
  });
  assert.equal(twin, null);
});

test("caso real titulopau.pdf: el segundo análisis devuelve LO MISMO, no 1.254 palabras", () => {
  const primero = cand({
    id: "cmtclyk6",
    analysisJson: { document_metrics: { estimated_words: 1850 } },
    clientEmail: "paulabuiza@gmail.com",
    createdAt: d("2026-08-28T07:06:00Z"),
  });
  const twin = pickReusableTwin([primero], {
    documentId: "cmtg2o87",
    clientEmail: "paulabuiza@gmail.com",
    sessionToken: null,
  });
  assert.equal((twin?.analysisJson as any).document_metrics.estimated_words, 1850);
});
