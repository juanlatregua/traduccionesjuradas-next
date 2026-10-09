import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateAutoApprove,
  evaluateDegrade,
  costDispersion,
  handFixedClientCents,
  isAutoManaged,
  isPausedByHand,
  conversionOf,
  isAutoPolicyOn,
  type PolicyRate,
  type PolicySample,
} from "../../lib/learned-rates-math.ts";
import { autoClientPriceCentsFromCost } from "../../lib/quote-math.ts";
import { isAutoPriceable } from "../../lib/pricing-engine/languages.ts";

// Política autónoma del agente de precios (Juan, 9-oct-2026).
const NOW = new Date("2026-10-09T08:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const rate = (o: Partial<PolicyRate> = {}): PolicyRate => ({
  lang: "pt", direction: "to_es", docType: "birth_certificate", unit: "doc",
  costCents: 3000, clientCents: null, wordsRef: 250, status: "CANDIDATE", lastSampleAt: daysAgo(2), ...o,
});
const cost = (c: number, d: number, extra: Partial<PolicySample> = {}): PolicySample => ({ kind: "translator_price", costCents: c, clientCents: null, at: daysAgo(d), ...extra });
const good = (): PolicySample[] => [cost(3000, 40), cost(3000, 20), cost(3000, 5, { accepted: true })];

test("auto-aprueba con 3 muestras, dispersión baja y un encargo aceptado; precio = regla de margen", () => {
  const v = evaluateAutoApprove(rate(), good(), NOW, isAutoPriceable);
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.priceCents, 4000); // 30 € de coste → suelo de 40 € gana
    assert.equal(v.clientCents, null);
    assert.equal(v.samples, 3);
  }
});

test("el precio auto sale de autoClientPriceFromCost (tramos, +10 € mínimo)", () => {
  const v = evaluateAutoApprove(rate({ costCents: 8000 }), [cost(8000, 40), cost(8000, 20), cost(8000, 5, { accepted: true })], NOW, isAutoPriceable);
  assert.equal(v.ok && v.priceCents, Math.ceil(autoClientPriceCentsFromCost(8000) / 50) * 50);
});

test("nunca francés, ni ru/uk, ni lenguas fuera de isAutoPriceable", () => {
  for (const lang of ["fr", "de", "ru", "uk", "he"]) {
    const v = evaluateAutoApprove(rate({ lang }), good(), NOW, isAutoPriceable);
    assert.equal(v.ok, false, lang);
  }
});

test("menos de 3 muestras en 90 días no aprueba (las viejas no cuentan)", () => {
  const v = evaluateAutoApprove(rate(), [cost(3000, 200), cost(3000, 120, { accepted: true }), cost(3000, 5), cost(3000, 3)], NOW, isAutoPriceable);
  assert.equal(v.ok, false);
});

test("dispersión > 15 % no aprueba; justo 15 % sí", () => {
  assert.ok(Math.abs(costDispersion([cost(1000, 1), cost(1150, 1)]) - 0.15) < 1e-9);
  const mal = evaluateAutoApprove(rate(), [cost(3000, 40), cost(3600, 20), cost(3000, 5, { accepted: true })], NOW, isAutoPriceable);
  assert.equal(mal.ok, false);
  const justo = evaluateAutoApprove(rate({ costCents: 3450 }), [cost(3000, 40), cost(3450, 20), cost(3000, 5, { accepted: true })], NOW, isAutoPriceable);
  assert.equal(justo.ok, true);
});

test("sin encargo aceptado ni presupuesto pagado no aprueba, y queda a un paso", () => {
  const v = evaluateAutoApprove(rate(), [cost(3000, 40), cost(3000, 20), cost(3000, 5)], NOW, isAutoPriceable);
  assert.equal(v.ok, false);
  assert.equal(!v.ok && v.near, true);
});

test("coste = precio fijado a mano (margen cero) no se auto-aprueba", () => {
  const caro = [cost(5000, 40), cost(5000, 20), cost(5000, 5, { accepted: true })];
  const samples = [...caro, { kind: "manual", costCents: null, clientCents: 5000, at: daysAgo(1) } as PolicySample];
  const v = evaluateAutoApprove(rate({ costCents: 5000 }), samples, NOW, isAutoPriceable);
  assert.equal(v.ok, false);
});

test("un precio fijado a mano por Juan se respeta", () => {
  const samples = [...good(), { kind: "manual", costCents: null, clientCents: 6500, at: daysAgo(1) } as PolicySample];
  assert.equal(handFixedClientCents(samples), 6500);
  const v = evaluateAutoApprove(rate(), samples, NOW, isAutoPriceable);
  assert.equal(v.ok && v.clientCents, 6500);
  assert.equal(v.ok && v.priceCents, 6500);
});

test("pausada a mano por Juan: no se resucita; vetada y ya aprobada no se tocan", () => {
  const pausa = [...good(), { kind: "manual_pause", costCents: 3000, clientCents: null, at: daysAgo(1) } as PolicySample];
  assert.equal(isPausedByHand(pausa), true);
  assert.equal(evaluateAutoApprove(rate(), pausa, NOW, isAutoPriceable).ok, false);
  assert.equal(evaluateAutoApprove(rate({ status: "VETOED" }), good(), NOW, isAutoPriceable).ok, false);
  assert.equal(evaluateAutoApprove(rate({ status: "APPROVED" }), good(), NOW, isAutoPriceable).ok, false);
});

test("unidad kword usa el tamaño de referencia para comprobar el margen", () => {
  const r = rate({ unit: "kword", costCents: 8000, wordsRef: 2000 });
  const v = evaluateAutoApprove(r, [cost(8000, 40), cost(8000, 20), cost(8000, 5, { accepted: true })], NOW, isAutoPriceable);
  assert.equal(v.ok, true);
});

// ── Degradación ──────────────────────────────────────────────────────────────
const autoMarked = (c = 3000): PolicySample[] => [...good(), { kind: "auto_approve", costCents: c, clientCents: 4000, at: daysAgo(3) }];

test("coste nuevo > 15 % sobre el aprobado degrada y avisa (auto-gestionada)", () => {
  const v = evaluateDegrade(rate({ status: "APPROVED" }), [...autoMarked(), cost(3600, 1)], NOW);
  assert.equal(v.degrade, true);
  if (v.degrade) { assert.equal(v.cause, "coste_sube"); assert.equal(v.handManaged, false); }
});

test("coste nuevo justo +15 % o menos no degrada", () => {
  assert.equal(evaluateDegrade(rate({ status: "APPROVED" }), [...autoMarked(), cost(3450, 1)], NOW).degrade, false);
});

test("90 días sin muestras degrada la auto-gestionada", () => {
  const old: PolicySample[] = [{ kind: "auto_approve", costCents: 3000, clientCents: 4000, at: daysAgo(100) }];
  const v = evaluateDegrade(rate({ status: "APPROVED", lastSampleAt: daysAgo(95) }), old, NOW);
  assert.equal(v.degrade && v.cause, "sin_muestras");
});

test("la aprobada/fijada a mano NO caduca por 90 días, pero sí degrada por subida de coste", () => {
  const manual: PolicySample[] = [cost(3000, 150), { kind: "manual_approve", costCents: 3000, clientCents: null, at: daysAgo(140) }];
  const r = rate({ status: "APPROVED", lastSampleAt: daysAgo(150) });
  assert.equal(evaluateDegrade(r, manual, NOW).degrade, false);
  const sube = evaluateDegrade(r, [...manual, cost(3800, 1)], NOW);
  assert.equal(sube.degrade, true);
  if (sube.degrade) { assert.equal(sube.cause, "coste_sube"); assert.equal(sube.handManaged, true); }
});

test("una tarifa aprobada antes de existir marca usa la muestra anterior como referencia (ventana corta)", () => {
  const legacy = rate({ status: "APPROVED" });
  assert.equal(evaluateDegrade(legacy, [cost(3000, 60), cost(3700, 2)], NOW).degrade, true);
  assert.equal(evaluateDegrade(legacy, [cost(3000, 60), cost(3700, 40)], NOW).degrade, false);
});

test("VETOED y CANDIDATE nunca se degradan", () => {
  assert.equal(evaluateDegrade(rate({ status: "VETOED" }), [...autoMarked(), cost(9000, 1)], NOW).degrade, false);
  assert.equal(evaluateDegrade(rate({ status: "CANDIDATE" }), [...autoMarked(), cost(9000, 1)], NOW).degrade, false);
});

test("un fijar posterior a la auto-aprobación la convierte en de Juan", () => {
  const s = [...autoMarked(), { kind: "manual", costCents: 3000, clientCents: null, at: daysAgo(1) } as PolicySample];
  assert.equal(isAutoManaged(autoMarked()), true);
  assert.equal(isAutoManaged(s), false);
});

test("conversión y kill-switch", () => {
  assert.deepEqual(conversionOf([{ sent: true, paid: true }, { sent: true, paid: false }, { sent: false, paid: false }]), { sent: 2, paid: 1, pct: 50 });
  assert.equal(conversionOf([]).pct, null);
  assert.equal(isAutoPolicyOn({}), true);
  assert.equal(isAutoPolicyOn({ LEARNED_RATES_AUTO: "off" }), false);
  assert.equal(isAutoPolicyOn({ LEARNED_RATES_LIVE: "OFF" }), false);
});

test("«a un paso» solo si falta un requisito y, de muestras, solo una", () => {
  const dos = evaluateAutoApprove(rate(), [cost(3000, 200, { accepted: true }), cost(3000, 20), cost(3000, 5)], NOW, isAutoPriceable);
  assert.equal(!dos.ok && dos.near, true);
  const una = evaluateAutoApprove(rate(), [cost(3000, 5, { accepted: true })], NOW, isAutoPriceable);
  assert.equal(!una.ok && una.near, false);
});

// ── Revisión opus (9-oct): solo cuenta lo que el jurado pidió ───────────────
test("semillas, ajustes manuales y pagos del cliente NO cuentan como muestras de coste", () => {
  const falsas: PolicySample[] = [
    { kind: "seed", costCents: 3000, clientCents: null, at: daysAgo(30) },
    { kind: "manual", costCents: 3000, clientCents: null, at: daysAgo(20) },
    { kind: "client_paid", costCents: 3000, clientCents: 4000, at: daysAgo(5), accepted: true },
  ];
  const v = evaluateAutoApprove(rate(), falsas, NOW, isAutoPriceable);
  assert.equal(v.ok, false);
  assert.match(!v.ok ? v.reason : "", /0\/3 precios del jurado/);
});

test("bastan 2 precios del jurado si uno es de un encargo aceptado; 2 sin aceptado, no", () => {
  const dos = [cost(3000, 20), cost(3000, 5, { accepted: true })];
  assert.equal(evaluateAutoApprove(rate(), dos, NOW, isAutoPriceable).ok, true);
  const sinAcept = [cost(3000, 20), cost(3000, 5), { kind: "client_paid", costCents: null, clientCents: 4000, at: daysAgo(1), accepted: true } as PolicySample];
  assert.equal(evaluateAutoApprove(rate(), sinAcept, NOW, isAutoPriceable).ok, false);
  assert.equal(evaluateAutoApprove(rate(), [cost(3000, 5, { accepted: true })], NOW, isAutoPriceable).ok, false);
});

test("no aprueba si el coste de la tarifa está por debajo del máximo pedido por el jurado", () => {
  const muestras = [cost(3000, 40), cost(3300, 20), cost(3000, 5, { accepted: true })];
  const bajo = evaluateAutoApprove(rate({ costCents: 3000 }), muestras, NOW, isAutoPriceable);
  assert.equal(bajo.ok, false);
  assert.match(!bajo.ok ? bajo.reason : "", /por debajo del máximo/);
  const igual = evaluateAutoApprove(rate({ costCents: 3300 }), muestras, NOW, isAutoPriceable);
  assert.equal(igual.ok, true);
});

test("coste que baja > 15 % degrada (coste_baja); justo -15 % no", () => {
  const v = evaluateDegrade(rate({ status: "APPROVED" }), [...autoMarked(), cost(2400, 1)], NOW);
  assert.equal(v.degrade && v.cause, "coste_baja");
  assert.equal(evaluateDegrade(rate({ status: "APPROVED" }), [...autoMarked(), cost(2550, 1)], NOW).degrade, false);
});
