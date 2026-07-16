import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regresión del stepper: cada ancla de TAB_ANCHOR debe existir como id de
// sección en la landing del pedido. Si una sección se renombra o se elimina,
// este test avisa antes de que el CTA "Ir al paso" vuelva a aterrizar mal.
const ROOT = join(import.meta.dirname, "..", "..");

function extractTabAnchors(): Record<string, string> {
  const src = readFileSync(join(ROOT, "components/order-workspace/OrderStepper.tsx"), "utf8");
  const block = src.match(/const TAB_ANCHOR[^=]*=\s*\{([\s\S]*?)\};/);
  assert.ok(block, "TAB_ANCHOR no encontrado en OrderStepper.tsx");
  const anchors: Record<string, string> = {};
  for (const m of block![1].matchAll(/(\w+):\s*"#([\w-]+)"/g)) {
    anchors[m[1]] = m[2];
  }
  assert.ok(Object.keys(anchors).length > 0, "TAB_ANCHOR vacío");
  return anchors;
}

function extractPageIds(): Set<string> {
  const src = readFileSync(join(ROOT, "app/zona-traductor/pedido/[reference]/page.tsx"), "utf8");
  const ids = new Set<string>();
  for (const m of src.matchAll(/\bid="([\w-]+)"/g)) ids.add(m[1]);
  assert.ok(ids.size > 0, "sin ids de sección en pedido/[reference]/page.tsx");
  return ids;
}

test("cada ancla de TAB_ANCHOR existe como id en la landing del pedido", () => {
  const anchors = extractTabAnchors();
  const ids = extractPageIds();
  for (const [tab, anchor] of Object.entries(anchors)) {
    assert.ok(ids.has(anchor), `TAB_ANCHOR.${tab} → #${anchor} no existe en la página (ids: ${[...ids].join(", ")})`);
  }
});
