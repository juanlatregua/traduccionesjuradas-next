import test from "node:test";
import assert from "node:assert/strict";
import { isIncidentError, leadingRunLength, remainingWaitSeconds, shouldSendNow } from "../../lib/verifactu/envio.ts";
import { buildEnvelope, EMITTER_NIF } from "../../lib/verifactu/aeat-xml.ts";

const t0 = new Date("2026-10-20T10:00:00Z");
const at = (s: number) => new Date(t0.getTime() + s * 1000);

test("remainingWaitSeconds: sin envío previo no espera; respeta TiempoEsperaEnvio o 60 s por defecto", () => {
  assert.equal(remainingWaitSeconds(null, 60, t0), 0);
  assert.equal(remainingWaitSeconds(t0, 60, at(20)), 40);
  assert.equal(remainingWaitSeconds(t0, 60, at(61)), 0);
  assert.equal(remainingWaitSeconds(t0, null, at(10)), 50);
  assert.equal(remainingWaitSeconds(t0, 120, at(10)), 110);
});

test("isIncidentError: red, timeout, SOAP Fault y 5xx cuentan; retraso, línea ausente o config no", () => {
  assert.equal(isIncidentError("Timeout de 30s hablando con la AEAT."), true);
  assert.equal(isIncidentError("connect ECONNRESET"), true);
  assert.equal(isIncidentError("SOAP Fault de la AEAT (HTTP 500): x"), true);
  assert.equal(isIncidentError("Respuesta de la AEAT sin EstadoEnvio (HTTP 503): <html>"), true);
  assert.equal(isIncidentError("Envío Incorrecto: la AEAT no devolvió línea para 26_001."), false);
  assert.equal(isIncidentError("Falta VERIFACTU_CERT_PASSWORD."), false);
});

test("leadingRunLength: corta el lote donde cambia la Incidencia", () => {
  assert.equal(leadingRunLength([]), 0);
  assert.equal(leadingRunLength([false, false, false]), 3);
  assert.equal(leadingRunLength([true, true, false, true]), 2);
  assert.equal(leadingRunLength([false, true]), 1);
});

test("shouldSendNow: solo con proveedor y sin espera pendiente", () => {
  assert.equal(shouldSendNow(true, 0), true);
  assert.equal(shouldSendNow(true, 15), false);
  assert.equal(shouldSendNow(false, 0), false);
});

test("buildEnvelope: Incidencia=S solo cuando se pide, tras ObligadoEmision", () => {
  const rec: any = { recordId: "r", kind: "ANULACION", emitterNif: EMITTER_NIF, numSerie: "26_001", issueDate: "20-10-2026", invoiceType: "", cuotaTotalCents: 0, importeTotalCents: 0, hash: "A".repeat(64), prevHash: null, prev: null, generatedAtIso: "2026-10-20T10:00:00+02:00" };
  assert.ok(!buildEnvelope([rec]).includes("Incidencia"));
  const x = buildEnvelope([rec], { incidencia: true });
  assert.match(x, /<\/sf:ObligadoEmision><sf:RemisionVoluntaria><sf:Incidencia>S<\/sf:Incidencia><\/sf:RemisionVoluntaria><\/sum:Cabecera>/);
});
