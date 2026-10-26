import test from "node:test";
import assert from "node:assert/strict";
import { filterByActivity, matchesActivity } from "../../lib/activity-filter.ts";

const rows = [
  { id: "tj", brand: "traduccionesjuradas" },
  { id: "hb", brand: "holabonjour" },
  { id: "dev", brand: "dev" },
  { id: "sin", brand: undefined },
];

test("todo deja todas las marcas", () => {
  assert.deepEqual(filterByActivity(rows, "todo").map((r) => r.id), ["tj", "hb", "dev", "sin"]);
});

test("traducción = traduccionesjuradas y cobros sin marca", () => {
  assert.deepEqual(filterByActivity(rows, "traduccion").map((r) => r.id), ["tj", "sin"]);
});

test("clases = holabonjour", () => {
  assert.deepEqual(filterByActivity(rows, "clases").map((r) => r.id), ["hb"]);
  assert.equal(matchesActivity(null, "clases"), false);
});
