import test from "node:test";
import assert from "node:assert/strict";
import { milestoneSmsFor } from "../../lib/workflow.ts";

test("EN_TRADUCCION dispara siempre el hito 'en proceso'", () => {
  assert.equal(milestoneSmsFor("EN_TRADUCCION", {}), "en_proceso");
  assert.equal(
    milestoneSmsFor("EN_TRADUCCION", { delivered: false, translatedFileUrl: null }),
    "en_proceso"
  );
});

test("TRADUCIDO_ENTREGADO con delivered=true dispara 'lista' (vía /delivery)", () => {
  assert.equal(milestoneSmsFor("TRADUCIDO_ENTREGADO", { delivered: true }), "lista");
});

test("TRADUCIDO_ENTREGADO con fichero ya persistido dispara 'lista' (vía Kanban)", () => {
  assert.equal(
    milestoneSmsFor("TRADUCIDO_ENTREGADO", { translatedFileUrl: "https://blob/x.pdf" }),
    "lista"
  );
});

test("TRADUCIDO_ENTREGADO sin entregable NO promete descarga", () => {
  assert.equal(milestoneSmsFor("TRADUCIDO_ENTREGADO", {}), null);
  assert.equal(
    milestoneSmsFor("TRADUCIDO_ENTREGADO", { delivered: false, translatedFileUrl: null }),
    null
  );
});

test("estados sin hito de cliente no avisan", () => {
  assert.equal(milestoneSmsFor("PAGO_VALIDADO", { delivered: true }), null);
  assert.equal(milestoneSmsFor("PENDIENTE_PAGO", {}), null);
  assert.equal(milestoneSmsFor("CERRADO", { translatedFileUrl: "x" }), null);
});
