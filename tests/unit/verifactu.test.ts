import test from "node:test";
import assert from "node:assert/strict";
import {
  altaHash,
  anulacionHash,
  buildAltaString,
  formatAmount,
  formatGeneratedAt,
  formatIssueDate,
  sha256Upper,
  verifyChain,
} from "../../lib/verifactu/hash.ts";
import { buildQrUrl } from "../../lib/verifactu/qr.ts";

// Ejemplo oficial de la especificación de la AEAT (huella del registro de alta).
const OFICIAL =
  "IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00";
const OFICIAL_HASH = "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60";

test("huella: reproduce el ejemplo oficial de la AEAT", () => {
  assert.equal(sha256Upper(OFICIAL), OFICIAL_HASH);
  const r = altaHash({
    emitterNif: "89890001K",
    numSerie: "12345678/G33",
    issueDate: "01-01-2024",
    invoiceType: "F1",
    cuotaTotalCents: 1235,
    importeTotalCents: 12345,
    prevHash: null,
    generatedAt: "2024-01-01T19:20:30+01:00",
  });
  assert.equal(r.canonical, OFICIAL);
  assert.equal(r.hash, OFICIAL_HASH);
});

test("huella: la cadena se construye desde Date con huso de Madrid", () => {
  // 2024-01-01T18:20:30Z = 19:20:30+01:00 en invierno (CET)
  const s = buildAltaString({
    emitterNif: " 89890001k ",
    numSerie: "12345678/G33",
    issueDate: new Date("2024-01-01T12:00:00Z"),
    invoiceType: "F1",
    cuotaTotalCents: 1235,
    importeTotalCents: 12345,
    prevHash: "",
    generatedAt: new Date("2024-01-01T18:20:30Z"),
  });
  assert.equal(s, OFICIAL);
  // Verano (CEST): +02:00
  assert.equal(formatGeneratedAt(new Date("2026-07-01T10:00:00Z")), "2026-07-01T12:00:00+02:00");
  assert.equal(formatIssueDate(new Date("2026-03-31T22:30:00Z")), "01-04-2026", "medianoche en Madrid ya es abril");
});

test("importes en formato AEAT: punto, dos decimales, negativos en rectificativas", () => {
  assert.equal(formatAmount(12345), "123.45");
  assert.equal(formatAmount(24140), "241.40");
  assert.equal(formatAmount(5), "0.05");
  assert.equal(formatAmount(0), "0.00");
  assert.equal(formatAmount(-1250), "-12.50");
});

test("encadenamiento: cada registro enlaza con la huella anterior y verifyChain lo comprueba", () => {
  const a = altaHash({ emitterNif: "B93712784", numSerie: "26_050", issueDate: "03-09-2026", invoiceType: "F1", cuotaTotalCents: 2100, importeTotalCents: 12100, prevHash: null, generatedAt: "2026-09-03T10:00:00+02:00" });
  const b = altaHash({ emitterNif: "B93712784", numSerie: "26_051", issueDate: "03-09-2026", invoiceType: "F1", cuotaTotalCents: 4200, importeTotalCents: 24200, prevHash: a.hash, generatedAt: "2026-09-03T10:05:00+02:00" });
  const c = anulacionHash({ emitterNif: "B93712784", numSerie: "26_051", issueDate: "03-09-2026", prevHash: b.hash, generatedAt: "2026-09-03T10:06:00+02:00" });
  const chain = [
    { canonical: a.canonical, hash: a.hash, prevHash: null },
    { canonical: b.canonical, hash: b.hash, prevHash: a.hash },
    { canonical: c.canonical, hash: c.hash, prevHash: b.hash },
  ];
  assert.equal(verifyChain(chain), -1);
  // Alterar un importe rompe la cadena en ese registro
  const tampered = chain.map((r, i) => (i === 1 ? { ...r, canonical: r.canonical.replace("ImporteTotal=242.00", "ImporteTotal=2.00") } : r));
  assert.equal(verifyChain(tampered), 1);
  // Reordenar rompe el enlace
  assert.equal(verifyChain([chain[1], chain[0], chain[2]]), 0);
});

test("QR: URL de cotejo con los cuatro parámetros en el formato de la AEAT", () => {
  const url = buildQrUrl({ emitterNif: "89890001K", numSerie: "12345678/G33", issueDate: "01-01-2024", importeTotalCents: 24140 });
  assert.equal(url, "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678%2FG33&fecha=01-01-2024&importe=241.40");
  assert.match(buildQrUrl({ emitterNif: "B93712784", numSerie: "26_050", issueDate: "03-09-2026", importeTotalCents: 12100, env: "test" }), /^https:\/\/prewww2\.aeat\.es\//);
});
