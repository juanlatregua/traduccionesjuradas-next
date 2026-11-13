import test from "node:test";
import assert from "node:assert/strict";
import { isCriticalStaffSms } from "../../lib/staff-sms-policy.ts";

const crit = (c: string, env: Record<string, string | undefined> = {}) => isCriticalStaffSms(c, "x", env);

test("dinero: sigue por SMS", () => {
  for (const c of ["pago 26_ABC123", "cobro_sin_pedido Q-1", "cobro_resuelto Q-1", "importe_no_coincide Q-1", "coste_sin_cifra 26_ABC123",
    "doble cobro segundo pago", "segundo pago presupuesto", "margen Q-1", "margen_cero 26_ABC123", "pactado_sin_margen 26_ABC123",
    "pactado_duplicado 26_ABC123", "aceptacion_frenada 26_ABC123", "verifactu F-1", "cobro_resuelto X", "copia_fallida 26_ABC123",
    "lavori_fallback 26_ABC123", "encargo_retirado 26_ABC123", "payment_reconciliation",
    "cobrado_congelado Q-1", "precio_supera_coste 26_ABC123", "justificante 26_ABC123"]) {
    assert.equal(crit(c), true, c);
  }
});

test("resto: va por email", () => {
  for (const c of ["ai_outage", "analysis_failure", "lead_24h 26_ABC", "cliente_contesto Q-1", "agente_bandeja_enviado Q-1", "directo_tardio X", "descartada_tardio X",
    "segundo_precio X", "aceptacion_cruzada X", "aceptacion_aceptacion_pedido_asignado X", "aceptacion_pedido_asignado X", "delivery_sent_26_ABC123",
    "cotizacion 26_ABC123", "lo_llevo_yo 26_ABC123", "cierre_sin_buzon", "puerta_request_quote", "presupuesto 26_ABC123", "whatsapp-inbound 1",
    "translator-delivered", "quotes_reminders", "tarifa_degradada 1", "directo_precio X", "precio_tras_envio Q-1", ""]) {
    assert.equal(crit(c), false, c);
  }
});

test("el cuerpo PAGO fuerza SMS aunque el contexto no sea conocido", () => {
  assert.equal(isCriticalStaffSms("otro", "PAGO 10.00 EUR - pedido X", {}), true);
});

test("kill-switch STAFF_SMS", () => {
  assert.equal(crit("lead_24h X", { STAFF_SMS: "all" }), true);
  assert.equal(crit("pago 26_ABC123", { STAFF_SMS: "off" }), false);
  assert.equal(crit("lead_24h X", { STAFF_SMS: " ALL " }), true);
  assert.equal(crit("pago X", { STAFF_SMS: "" }), true);
});
