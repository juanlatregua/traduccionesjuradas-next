import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regresión del incidente "el pedido nace sin archivos" (familia TJ-20260708-62ZI).
// Un presupuesto hecho con documentos soltados a mano en el builder guarda el
// archivo en QuoteLine.sourceFileUrl. Ese dato tiene que sobrevivir a TODA la
// cadena: select de BD → puente → OrderDocumentItem.fileUrl + evento canónico.
// El bug no estaba en ninguna lógica: el dato se caía en tránsito (los select
// solo pedían description/unitPrice). Por eso esto se verifica sobre el cableado.
const ROOT = join(import.meta.dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const CALLERS = ["app/api/quotes/[id]/mark-paid/route.ts", "lib/quote-stripe-webhook.ts"];

for (const caller of CALLERS) {
  test(`${caller}: el select de líneas pide sourceFileUrl`, () => {
    const src = read(caller);
    const select = src.match(/lines:\s*\{\s*select:\s*\{([^}]*)\}/);
    assert.ok(select, "no se encontró el select de lines");
    assert.match(select![1], /sourceFileUrl:\s*true/, "sin sourceFileUrl el archivo se pierde en la propia query");
  });

  test(`${caller}: mapea sourceFileUrl al puente`, () => {
    const src = read(caller);
    assert.match(
      src,
      /lines:\s*quote\.lines\.map\([\s\S]{0,320}?sourceFileUrl/,
      "el select lo trae pero el map al puente lo descarta"
    );
  });
}

test("populateOrderItemsFromQuote: el fallback sin expediente adjunta fileUrl al item", () => {
  const src = read("lib/orders.ts");
  const fn = src.slice(src.indexOf("async function populateOrderItemsFromQuote"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  const fallback = body.slice(body.indexOf("if (input.lines"));
  assert.ok(fallback.length > 0, "no se encontró el fallback de líneas");
  assert.match(fallback, /fileUrl:\s*l\.sourceFileUrl/, "el item se crearía sin archivo");
});

test("populateOrderItemsFromQuote: el fallback emite order.source_document_uploaded", () => {
  const src = read("lib/orders.ts");
  const fn = src.slice(src.indexOf("async function populateOrderItemsFromQuote"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  const fallback = body.slice(body.indexOf("if (input.lines"));
  // Es el ÚNICO evento que lee el enlace del colaborador externo: sin él, el
  // encargo llega vacío aunque el OrderDocumentItem tenga el archivo.
  assert.match(fallback, /type:\s*"order\.source_document_uploaded"/, "el colaborador recibiría el encargo sin archivos");
});

test("el tipo del puente (QuoteForBridge) transporta sourceFileUrl", () => {
  const src = read("lib/quote-to-order.ts");
  const type = src.slice(src.indexOf("export type QuoteForBridge"), src.indexOf("export async function runQuoteToOrderBridge"));
  assert.match(type, /sourceFileUrl/, "el puente no declara el campo → TypeScript lo descartaría");
});

test("createOrderFromQuote acepta sourceFileUrl en sus líneas", () => {
  const src = read("lib/orders.ts");
  const type = src.slice(src.indexOf("expedienteRef?: string | null;"));
  const linesType = type.slice(0, type.indexOf("};"));
  assert.match(linesType, /sourceFileUrl/, "el input no declara el campo");
});
