import test from "node:test";
import assert from "node:assert/strict";

const { matchLeadByCustomer, isLeadPairable, LEAD_PAIRABLE_STATUSES } = await import("../../lib/lavori-lead-match.ts");

const candidatas = [
  { ref: "LEAD-A", customerHint: "Mario Moreno", priceCents: 32500, status: "PRICED" },
  { ref: "LEAD-B", customerHint: "miguel.lacalle16@gmail.com · +34634838301", priceCents: 4500, status: "ACCEPTED" },
  { ref: "LEAD-C", customerHint: "Ofir · +34600066632", priceCents: 4000, status: "PRICED" },
  { ref: "LEAD-D", customerHint: "sin precio", priceCents: null, status: "PRICED" },
  { ref: "LEAD-E", customerHint: "aceptada sin cifra", priceCents: null, status: "ACCEPTED" },
];

test("emparejar: ACCEPTED cuenta igual que PRICED (Daniela/26_C3675D)", () => {
  assert.deepEqual([...LEAD_PAIRABLE_STATUSES], ["PRICED", "ACCEPTED"]);
  assert.equal(isLeadPairable({ status: "PRICED", priceCents: 100 }), true);
  assert.equal(isLeadPairable({ status: "PRICED", priceCents: null }), false);
  assert.equal(isLeadPairable({ status: "ACCEPTED", priceCents: null }), true, "aceptada sin cifra: se asigna, no se abre otro encargo");
});

test("emparejar por nombre exacto (Mario Moreno, solicitud del builder sin email)", () => {
  assert.equal(matchLeadByCustomer(candidatas, { name: "  mario moreno ", email: null, phone: null })?.ref, "LEAD-A");
  assert.equal(matchLeadByCustomer(candidatas, { name: "Mario", email: null, phone: null }), null, "nombre corto no empareja");
});

test("emparejar por email o por los 9 últimos dígitos del teléfono", () => {
  assert.equal(matchLeadByCustomer(candidatas, { email: "MIGUEL.lacalle16@gmail.com" })?.ref, "LEAD-B");
  assert.equal(matchLeadByCustomer(candidatas, { phone: "634 838 301" })?.ref, "LEAD-B");
  assert.equal(matchLeadByCustomer(candidatas, { phone: "0034600066632" })?.ref, "LEAD-C");
});

test("el email marcador @whatsapp.local nunca empareja; PRICED sin cifra no; ACCEPTED sin cifra sí", () => {
  assert.equal(matchLeadByCustomer([{ customerHint: "34600066632@whatsapp.local", priceCents: 4000, status: "PRICED" }], { email: "34600066632@whatsapp.local" }), null);
  assert.equal(matchLeadByCustomer(candidatas, { name: "sin precio" }), null);
  assert.equal(matchLeadByCustomer(candidatas, { name: "aceptada sin cifra" })?.ref, "LEAD-E");
});
