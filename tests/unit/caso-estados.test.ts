import test from "node:test";
import assert from "node:assert/strict";
import {
  CASO_ESTADOS,
  puedeCaso,
  casoTerminal,
  esCasoEstado,
  estadoPorPedidos,
  estadoDeCaso,
  quoteIntocable,
  quoteVivo,
  lprViva,
} from "../../lib/caso/estados.ts";

test("transiciones: el pedido manda, ENTREGADO y CANCELADO son terminales", () => {
  assert.ok(puedeCaso("ABIERTO", "EN_CURSO"));
  assert.ok(puedeCaso("PERDIDO", "EN_CURSO"), "llega el pedido de un caso perdido");
  assert.ok(puedeCaso("PERDIDO", "ABIERTO"), "reabrir");
  assert.ok(puedeCaso("EN_CURSO", "ENTREGADO"));
  assert.ok(!puedeCaso("EN_CURSO", "ABIERTO"));
  assert.ok(!puedeCaso("EN_CURSO", "PERDIDO"), "un caso con pedido no se pierde");
  assert.ok(!puedeCaso("ENTREGADO", "EN_CURSO"));
  assert.ok(casoTerminal("ENTREGADO") && casoTerminal("CANCELADO"));
  assert.ok(!casoTerminal("PERDIDO"));
  for (const e of CASO_ESTADOS) assert.ok(puedeCaso(e, e));
  assert.ok(esCasoEstado("ABIERTO") && !esCasoEstado("PAGADO"));
});

test("estado por EXISTENCIA de pedido, no por cobro (crédito: pedido sin pagar = EN_CURSO)", () => {
  assert.equal(estadoPorPedidos([]), null);
  assert.equal(estadoPorPedidos([{ status: "PENDING_PAYMENT", paymentStatus: "PENDING" }]), "EN_CURSO");
  assert.equal(estadoPorPedidos([{ status: "PAID", paymentStatus: "PAID", deliveryState: "TRADUCIDO" }]), "ENTREGADO");
  assert.equal(estadoPorPedidos([{ status: "PAID", workflowState: "CERRADO" }]), "ENTREGADO");
  assert.equal(estadoPorPedidos([{ status: "CANCELLED" }]), "CANCELADO");
  assert.equal(estadoPorPedidos([{ status: "PAID", paymentStatus: "REFUNDED" }]), "CANCELADO");
  assert.equal(
    estadoPorPedidos([{ status: "CANCELLED" }, { status: "DELIVERED" }]),
    "ENTREGADO",
    "el cancelado no cuenta si otro se entregó"
  );
  assert.equal(estadoPorPedidos([{ status: "DELIVERED" }, { status: "PAID" }]), "EN_CURSO");
});

test("sin pedido: ABIERTO si hay algo vivo, PERDIDO si no", () => {
  assert.equal(estadoDeCaso({ pedidos: [], vivo: true }), "ABIERTO");
  assert.equal(estadoDeCaso({ pedidos: [], vivo: false }), "PERDIDO");
  assert.equal(estadoDeCaso({ pedidos: [{ status: "PENDING_PAYMENT" }], vivo: false }), "EN_CURSO");
});

test("quoteIntocable: formalizado, cobrado o segundo plazo pendiente", () => {
  assert.ok(quoteIntocable({ status: "PAID" }));
  assert.ok(quoteIntocable({ status: "DELIVERED" }));
  assert.ok(quoteIntocable({ status: "EXPIRED", paidAt: new Date() }));
  assert.ok(quoteIntocable({ status: "SENT", balanceAmount: 120.5, balancePaidAt: null }));
  assert.ok(!quoteIntocable({ status: "SENT", balanceAmount: 120.5, balancePaidAt: new Date() }));
  assert.ok(!quoteIntocable({ status: "ACCEPTED" }));
  assert.ok(!quoteIntocable({ status: "EXPIRED", balanceAmount: null }));
});

test("vivos: presupuesto sin formalizar ni borrar; solicitud viva reciente", () => {
  assert.ok(quoteVivo({ status: "SENT" }));
  assert.ok(!quoteVivo({ status: "SENT", deletedAt: new Date() }));
  assert.ok(!quoteVivo({ status: "EXPIRED" }));
  assert.ok(!quoteVivo({ status: "SENT", lostReason: "NO_LONGER_NEEDED" }), "cierre suave / No aceptado: ya no vive");
  const ahora = new Date("2026-10-11T12:00:00Z");
  assert.ok(lprViva({ status: "PRICED", createdAt: new Date("2026-10-01T00:00:00Z") }, ahora));
  assert.ok(!lprViva({ status: "PRICED", createdAt: new Date("2026-08-01T00:00:00Z") }, ahora));
  assert.ok(!lprViva({ status: "RETIRED", createdAt: ahora }, ahora));
});
