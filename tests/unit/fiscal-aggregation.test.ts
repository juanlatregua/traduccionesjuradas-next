import test from "node:test";
import assert from "node:assert/strict";
import { aggregateFiscal, snapVat } from "../../lib/fiscal-aggregation.ts";

function exp(over: Record<string, unknown> = {}) {
  return {
    baseCents: 10000,
    vatCents: 2100,
    ivaDeducible: true,
    taxTreatment: "general",
    needsReview: false,
    irpfCents: 0,
    ...over,
  };
}

test("snapVat: normaliza a los tipos permitidos (fracción o porcentaje)", () => {
  assert.equal(snapVat(0.21), 0.21);
  assert.equal(snapVat(21), 0.21);
  assert.equal(snapVat(0.001), 0);
  assert.equal(snapVat(0.1), 0.1);
  assert.equal(snapVat("x"), 0.21);
});

test("aggregateFiscal: caso clásico — devengado por tipo + soportado deducible", () => {
  const { d303, d111 } = aggregateFiscal(
    [
      { baseCents: 100000, vatCents: 21000 },
      { baseCents: 50000, vatCents: 10500 },
      { baseCents: 20000, vatCents: 0 }, // IVA 0 (no sujeta) → tramo 0%
    ],
    [exp({ baseCents: 50000, vatCents: 10500 })]
  );
  assert.deepEqual(d303.devengado, [
    { ratePct: 21, baseCents: 150000, cuotaCents: 31500 },
    // el tramo 0% se filtra en build303 solo si base y cuota son 0 → aquí queda
    { ratePct: 0, baseCents: 20000, cuotaCents: 0 },
  ]);
  assert.equal(d303.baseDeducibleCents, 50000);
  assert.equal(d303.ivaSoportadoDeducibleCents, 10500);
  assert.equal(d303.resultadoCents, 31500 - 10500);
  assert.equal(d111.numPerceptores, 0);
});

test("aggregateFiscal: los gastos needsReview se EXCLUYEN dentro de la función", () => {
  const base = aggregateFiscal([], [exp()]);
  const withPending = aggregateFiscal([], [exp(), exp({ needsReview: true, baseCents: 999999, vatCents: 99999, irpfCents: 5000 })]);
  assert.deepEqual(withPending, base);
  assert.equal(withPending.d111.retencionesCents, 0);
});

test("aggregateFiscal: ISP intracom deducible es neutro; base fuera del deducible clásico", () => {
  const { d303 } = aggregateFiscal([], [exp({ taxTreatment: "isp_intracom", vatCents: 0 })]);
  assert.equal(d303.ispIntracomBaseCents, 10000);
  assert.equal(d303.ispIntracomCuotaCents, 2100);
  assert.equal(d303.ispCuotaDeducibleCents, 2100);
  assert.equal(d303.baseDeducibleCents, 0); // base ISP no entra en la clásica
  assert.equal(d303.resultadoCents, 0); // autorrepercusión 100% deducible → neutra
});

test("aggregateFiscal: split ISP deducible/no deducible — devenga entera, deduce parcial", () => {
  const { d303 } = aggregateFiscal(
    [],
    [
      exp({ taxTreatment: "isp_import", vatCents: 0, baseCents: 15000 }),
      exp({ taxTreatment: "isp_import", vatCents: 0, baseCents: 5000, ivaDeducible: false }),
    ]
  );
  assert.equal(d303.ispImportBaseCents, 20000);
  assert.equal(d303.ispImportCuotaCents, 4200);
  assert.equal(d303.ispCuotaDeducibleCents, 3150); // solo el 21% de 150€
  assert.equal(d303.resultadoCents, 1050);
});

test("aggregateFiscal: 111 — base, retenciones y nº de perceptores", () => {
  const { d111 } = aggregateFiscal(
    [],
    [
      exp({ baseCents: 30000, irpfCents: 4500 }),
      exp({ baseCents: 20000, irpfCents: 3000 }),
      exp({ baseCents: 10000, irpfCents: 0 }), // sin retención → no cuenta como perceptor
    ]
  );
  assert.equal(d111.baseRetencionesCents, 50000);
  assert.equal(d111.retencionesCents, 7500);
  assert.equal(d111.numPerceptores, 2);
});
