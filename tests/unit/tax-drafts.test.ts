import test from "node:test";
import assert from "node:assert/strict";
import { build303, build111, draftToText } from "../../lib/tax-drafts.ts";

test("build303 sin ISP: comportamiento clásico", () => {
  const d = build303([{ ratePct: 21, baseCents: 100000, cuotaCents: 21000 }], 50000, 10500);
  assert.equal(d.ivaRepercutidoCents, 21000);
  assert.equal(d.ivaSoportadoDeducibleCents, 10500);
  assert.equal(d.resultadoCents, 10500);
  assert.equal(d.ispIntracomBaseCents, 0);
  assert.equal(d.ispImportBaseCents, 0);
});

test("build303 con ISP intracom: cuota 21% suma al devengado Y al deducible", () => {
  const d = build303([], 0, 0, { intracomBaseCents: 10000 });
  assert.equal(d.ispIntracomCuotaCents, 2100);
  assert.equal(d.ivaRepercutidoCents, 2100);
  assert.equal(d.ivaSoportadoDeducibleCents, 2100);
  assert.equal(d.resultadoCents, 0); // neutro si es 100% deducible
});

test("build303 con ISP intracom + importación: bases separadas, resultado no se mueve", () => {
  const d = build303([{ ratePct: 21, baseCents: 100000, cuotaCents: 21000 }], 50000, 10500, { intracomBaseCents: 10000, importBaseCents: 20000 });
  assert.equal(d.ispIntracomBaseCents, 10000);
  assert.equal(d.ispIntracomCuotaCents, 2100);
  assert.equal(d.ispImportBaseCents, 20000);
  assert.equal(d.ispImportCuotaCents, 4200);
  assert.equal(d.ivaRepercutidoCents, 21000 + 2100 + 4200);
  assert.equal(d.ivaSoportadoDeducibleCents, 10500 + 2100 + 4200);
  // Mismo resultado que sin ISP: la autorrepercusión deducible es neutra.
  assert.equal(d.resultadoCents, 21000 - 10500);
});

test("draftToText: etiquetas ISP descriptivas + nota de gestoría, sin modelo 130", () => {
  const d303 = build303([{ ratePct: 21, baseCents: 100000, cuotaCents: 21000 }], 50000, 10500, { intracomBaseCents: 10000, importBaseCents: 20000 });
  const text = draftToText("2026 · T2", d303, build111(0, 0, 0));
  assert.match(text, /Adquis\. intracomunitarias de servicios/);
  assert.match(text, /Importación de servicios/);
  assert.match(text, /casillas exactas: validar con gestoría/);
  assert.match(text, /modelo 202/);
  assert.doesNotMatch(text, /MODELO 130/);
  assert.match(text, /Cuota deducible por ISP:\s+63\.00 €/);
});

test("draftToText sin ISP: no pinta líneas ISP", () => {
  const d303 = build303([{ ratePct: 21, baseCents: 100000, cuotaCents: 21000 }], 50000, 10500);
  const text = draftToText("2026 · T2", d303, build111(0, 0, 0));
  assert.doesNotMatch(text, /ISP/);
});

test("build303 con ISP no deducible: devenga pero no deduce (sube el resultado)", () => {
  const d = build303([], 0, 0, { intracomBaseCents: 10000, intracomDeducibleBaseCents: 0 });
  assert.equal(d.ispIntracomCuotaCents, 2100);
  assert.equal(d.ispCuotaDeducibleCents, 0);
  assert.equal(d.ivaRepercutidoCents, 2100);
  assert.equal(d.ivaSoportadoDeducibleCents, 0);
  assert.equal(d.resultadoCents, 2100);
});

test("build303 con ISP parcialmente deducible + aviso en el TXT", () => {
  const d = build303([], 0, 0, { importBaseCents: 20000, importDeducibleBaseCents: 15000 });
  assert.equal(d.ispImportCuotaCents, 4200);
  assert.equal(d.ispCuotaDeducibleCents, 3150);
  assert.equal(d.resultadoCents, 1050);
  const text = draftToText("2026 · T3", d, build111(0, 0, 0));
  assert.match(text, /ISP no deducible: 10\.50 € devengados sin deducción/);
});
