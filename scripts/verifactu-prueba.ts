// scripts/verifactu-prueba.ts — Envía facturas SINTÉTICAS al entorno de PRUEBAS de la AEAT
// con el certificado real y muestra la respuesta. No lee ni escribe la BD.
//   npx tsx --env-file=.env.local scripts/verifactu-prueba.ts
// Se niega a correr si VERIFACTU_ENV no es "test" o el endpoint no es de preproducción.

import { altaHash, anulacionHash, formatGeneratedAt, formatIssueDate } from "../lib/verifactu/hash.ts";
import { AEAT_ENDPOINTS, submitBatch } from "../lib/verifactu/aeat-direct.ts";
import { EMITTER_NIF } from "../lib/verifactu/aeat-xml.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProviderSendInput } from "../lib/verifactu/provider.ts";

const endpoint = AEAT_ENDPOINTS.test;
if (String(process.env.VERIFACTU_ENV || "").toLowerCase() !== "test") {
  console.error("Me niego: VERIFACTU_ENV debe ser exactamente «test».");
  process.exit(1);
}
if (!/^https:\/\/prewww\d*\.aeat\.es\//.test(endpoint)) {
  console.error("Me niego: el endpoint no es de preproducción de la AEAT.");
  process.exit(1);
}

const now = new Date();
const stamp = String(now.getTime());
const issue = formatIssueDate(now);
const gen = () => formatGeneratedAt(new Date());

function build(
  numSerie: string,
  type: "F1" | "F2" | "R1",
  totalCents: number,
  prev: ProviderSendInput | null,
  recipient: ProviderSendInput["recipient"],
  rectifies: ProviderSendInput["rectifies"] = null
): ProviderSendInput {
  const cuota = Math.round(totalCents - totalCents / 1.21); // en negativo para R1 sale negativo
  const generatedAtIso = gen();
  const { hash } = altaHash({ emitterNif: EMITTER_NIF, numSerie, issueDate: issue, invoiceType: type, cuotaTotalCents: cuota, importeTotalCents: totalCents, prevHash: prev?.hash ?? null, generatedAt: generatedAtIso });
  return {
    recordId: `prueba-${numSerie}`.slice(0, 60),
    kind: "ALTA",
    emitterNif: EMITTER_NIF,
    numSerie,
    issueDate: issue,
    invoiceType: type,
    cuotaTotalCents: cuota,
    importeTotalCents: totalCents,
    vatRate: 0.21,
    hash,
    prevHash: prev?.hash ?? null,
    prev: prev ? { emitterNif: EMITTER_NIF, numSerie: prev.numSerie, issueDate: prev.issueDate } : null,
    generatedAtIso,
    recipient,
    rectifies,
  };
}

function annul(of: ProviderSendInput, prev: ProviderSendInput): ProviderSendInput {
  const generatedAtIso = gen();
  const { hash } = anulacionHash({ emitterNif: EMITTER_NIF, numSerie: of.numSerie, issueDate: of.issueDate, prevHash: prev.hash, generatedAt: generatedAtIso });
  return {
    recordId: `prueba-anul-${of.numSerie}`.slice(0, 60),
    kind: "ANULACION",
    emitterNif: EMITTER_NIF,
    numSerie: of.numSerie,
    issueDate: of.issueDate,
    invoiceType: "",
    cuotaTotalCents: 0,
    importeTotalCents: 0,
    hash,
    prevHash: prev.hash,
    prev: { emitterNif: EMITTER_NIF, numSerie: prev.numSerie, issueDate: prev.issueDate },
    generatedAtIso,
  };
}

// La AEAT rechaza «PrimerRegistro» si ya hay registros (error 2007): se encadena con el último enviado,
// recordado en un fichero temporal fuera del repo.
const STATE = process.env.VERIFACTU_PRUEBA_STATE || join(tmpdir(), "verifactu-prueba-estado.json");
type Last = { numSerie: string; issueDate: string; hash: string };
const last: Last | null = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
const first = last ? ({ ...last, emitterNif: EMITTER_NIF } as unknown as ProviderSendInput) : null;

const only = process.argv[2]; // "f1es": añade un F1 con NIF español sintético
const a = build(`TEST-${stamp}-A`, "F2", 12100, first, null);
const b = build(`TEST-${stamp}-B`, "F1", 24200, a, { name: "Cliente Prueba GmbH", nif: "DE811115368", country: "Alemania" });
const c = build(`TEST-${stamp}-C`, "F1", 6050, b, { name: "Cliente Prueba Maroc", nif: "AB123456", country: "Marruecos" });
const d = build(`TEST-${stamp}-D`, "R1", -6050, c, { name: "Cliente Prueba Maroc", nif: "AB123456", country: "Marruecos" }, { numSerie: c.numSerie, issueDate: c.issueDate });
const e = annul(a, d);
const batch = [a, b, c, d, e];
if (only === "f1es") batch.push(build(`TEST-${stamp}-F`, "F1", 6050, e, { name: "HBTJ CONSULTORES LINGÜISTICOS SL", nif: EMITTER_NIF, country: "España" }));

(async () => {
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Enviando ${batch.length} registros: ${batch.map((i) => `${i.numSerie} (${i.invoiceType})`).join(", ")}`);
  try {
    const { parsed, status, body } = await submitBatch(endpoint, batch);
    console.log(`HTTP ${status} · EstadoEnvio=${parsed.estadoEnvio} · CSV=${parsed.csv} · TiempoEsperaEnvio=${parsed.tiempoEsperaEnvio}`);
    for (const l of parsed.lines) {
      console.log(`  ${l.numSerie} [${l.operacion}] ${l.estadoRegistro}${l.codigoError ? ` · ${l.codigoError}: ${l.descripcionError}` : ""}${l.duplicado ? ` · DUPLICADO(${l.duplicado.estado})` : ""}`);
    }
    const tail = batch[batch.length - 1];
    const tailLine = parsed.lines[parsed.lines.length - 1];
    if (tailLine && tailLine.estadoRegistro !== "Incorrecto") writeFileSync(STATE, JSON.stringify({ numSerie: tail.numSerie, issueDate: tail.issueDate, hash: tail.hash }));
    if (process.env.VERBOSE) console.log(body);
  } catch (e) {
    console.error("Fallo:", (e as Error).message);
    process.exit(2);
  }
})();
