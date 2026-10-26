import test from "node:test";
import assert from "node:assert/strict";
import { daysUntil, deadlineLine, frDeliveryPrefill, isUrgentDeadline, jurorDeadlineNote, parseDeadline, parseNeededBy, urgentSubjectPrefix } from "../../lib/needed-by.ts";

// 26-oct-2026 10:00 Madrid
const NOW = new Date("2026-10-26T09:00:00Z");
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

test("parseNeededBy: fecha real, de hoy a un año; lo demás se ignora", () => {
  assert.deepEqual(parseNeededBy("2026-10-26", NOW), day("2026-10-26"));
  assert.deepEqual(parseNeededBy("2027-10-26", NOW), day("2027-10-26"));
  assert.equal(parseNeededBy("2027-10-27", NOW), null);
  assert.equal(parseNeededBy("2026-10-25", NOW), null);
  assert.equal(parseNeededBy("2026-02-30", NOW), null);
  assert.equal(parseNeededBy("mañana", NOW), null);
  assert.equal(parseNeededBy(20261030, NOW), null);
  assert.equal(parseNeededBy("", NOW), null);
});

test("«hoy» es el día de Madrid: 23:30 UTC del 26 ya es el 27", () => {
  const late = new Date("2026-10-26T23:30:00Z");
  assert.equal(parseNeededBy("2026-10-26", late), null);
  assert.equal(daysUntil(day("2026-10-27"), late), 0);
});

test("parseDeadline: DATE exige fecha; ASAP/FLEXIBLE sin fecha", () => {
  assert.deepEqual(parseDeadline("ASAP", "2026-10-30", NOW), { urgency: "ASAP", neededBy: null });
  assert.deepEqual(parseDeadline("flexible", null, NOW), { urgency: "FLEXIBLE", neededBy: null });
  assert.deepEqual(parseDeadline("DATE", "2026-10-30", NOW), { urgency: "DATE", neededBy: day("2026-10-30") });
  assert.equal(parseDeadline("DATE", "", NOW), null);
  assert.equal(parseDeadline("DATE", "2020-01-01", NOW), null);
  assert.equal(parseDeadline("YA", "2026-10-30", NOW), null);
  assert.equal(parseDeadline(undefined, undefined, NOW), null);
});

test("urgente: lo antes posible o fecha dentro de 3 días (hoy, mañana, +2)", () => {
  const d = (iso: string) => ({ urgency: "DATE", neededBy: day(iso) });
  assert.equal(urgentSubjectPrefix(d("2026-10-26"), NOW), "URGENTE · lo necesita el 26/10 · ");
  assert.equal(urgentSubjectPrefix(d("2026-10-28"), NOW), "URGENTE · lo necesita el 28/10 · ");
  assert.equal(urgentSubjectPrefix(d("2026-10-29"), NOW), "");
  assert.equal(urgentSubjectPrefix({ urgency: "ASAP", neededBy: null }, NOW), "URGENTE · lo antes posible · ");
  assert.equal(urgentSubjectPrefix({ urgency: "FLEXIBLE", neededBy: null }, NOW), "");
  assert.equal(urgentSubjectPrefix(null, NOW), "");
  assert.equal(isUrgentDeadline(d("2026-10-27"), NOW), true);
});

test("líneas para staff y jurado", () => {
  assert.equal(deadlineLine({ urgency: "DATE", neededBy: day("2026-10-27") }, NOW), "Lo necesita: martes, 27 de octubre de 2026 (mañana)");
  assert.match(deadlineLine({ urgency: "DATE", neededBy: day("2026-10-26") }, NOW)!, /\(HOY\)$/);
  assert.match(deadlineLine({ urgency: "DATE", neededBy: day("2026-11-05") }, NOW)!, /\(en 10 días\)$/);
  assert.equal(deadlineLine({ urgency: "ASAP", neededBy: null }, NOW), "Lo necesita: lo antes posible");
  assert.equal(deadlineLine(null, NOW), null);
  assert.equal(jurorDeadlineNote({ urgency: "DATE", neededBy: day("2026-11-05") }), "Fecha límite del cliente: 05/11/2026");
  assert.equal(jurorDeadlineNote({ urgency: "FLEXIBLE", neededBy: null }), null);
});

test("prefill FR del builder: en el día = +40 % (solo aviso); ≤5 págs = 1 día hábil", () => {
  assert.deepEqual(frDeliveryPrefill({ urgency: "DATE", neededBy: day("2026-10-26") }, 2, NOW), {
    term: "En el día",
    hint: "Entrega en el día: +40 % sobre el precio normal",
  });
  assert.deepEqual(frDeliveryPrefill({ urgency: "DATE", neededBy: day("2026-10-27") }, 5, NOW), { term: "1 día hábil", hint: null });
  assert.equal(frDeliveryPrefill({ urgency: "DATE", neededBy: day("2026-10-30") }, 9, NOW), null);
  assert.equal(frDeliveryPrefill(null, 1, NOW), null);
});
