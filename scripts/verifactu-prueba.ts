// scripts/verifactu-prueba.ts — Envía facturas SINTÉTICAS al entorno de PRUEBAS de la AEAT
// con el certificado real y muestra la respuesta. No lee ni escribe la BD.
//   npx tsx --env-file=.env.local scripts/verifactu-prueba.ts            # F2, F1 UE, F1 no UE, R1, anulación, F1 ES
//   npx tsx --env-file=.env.local scripts/verifactu-prueba.ts subsanacion # rechazo (NIF-IVA inválido) + subsanación hasta Correcto
//   npx tsx --env-file=.env.local scripts/verifactu-prueba.ts r5          # F2 y su rectificativa R5
//   npx tsx --env-file=.env.local scripts/verifactu-prueba.ts huella      # ¿valida la AEAT que la huella anterior exista?
//   npx tsx --env-file=.env.local scripts/verifactu-prueba.ts inmediato   # registro nuevo enviado al momento (sin 2004)
//   npx tsx --env-file=.env.local scripts/verifactu-prueba.ts tardio      # registro de 5 min, sin y con Incidencia=S
// Se niega a correr si VERIFACTU_ENV no es "test" o el endpoint no es de preproducción.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { altaHash, anulacionHash, formatGeneratedAt, formatIssueDate } from "../lib/verifactu/hash.ts";
import { AEAT_ENDPOINTS, submitBatch } from "../lib/verifactu/aeat-direct.ts";
import { EMITTER_NIF } from "../lib/verifactu/aeat-xml.ts";
import type { ProviderSendInput } from "../lib/verifactu/provider.ts";

const endpoint = AEAT_ENDPOINTS.test;
if (process.env.VERIFACTU_ENV !== "test") {
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
let ageMs = 0;
const gen = () => formatGeneratedAt(new Date(Date.now() - ageMs));

type Prev = { numSerie: string; issueDate: string; hash: string };
type Rec = ProviderSendInput;
type Recipient = ProviderSendInput["recipient"];

function build(numSerie: string, type: "F1" | "F2" | "R1" | "R5", totalCents: number, prev: Prev | null, recipient: Recipient, extra: Partial<Rec> = {}): Rec {
  const cuota = Math.round(totalCents - totalCents / 1.21);
  const generatedAtIso = gen();
  const { hash } = altaHash({ emitterNif: EMITTER_NIF, numSerie, issueDate: issue, invoiceType: type, cuotaTotalCents: cuota, importeTotalCents: totalCents, prevHash: prev?.hash ?? null, generatedAt: generatedAtIso });
  return {
    recordId: `prueba-${numSerie}-${extra.subsanacion ? "s" : "a"}`.slice(0, 60),
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
    ...extra,
  };
}

function annul(of: Rec, prev: Prev): Rec {
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

// La AEAT rechaza «PrimerRegistro» si ya hay registros (error 2007): se encadena con el último
// enviado, recordado en un fichero temporal fuera del repo.
const STATE = process.env.VERIFACTU_PRUEBA_STATE || join(tmpdir(), "verifactu-prueba-estado.json");
let last: Prev | null = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : null;
const asPrev = (r: Rec): Prev => ({ numSerie: r.numSerie, issueDate: r.issueDate, hash: r.hash });

async function send(label: string, batch: Rec[], opts: { incidencia?: boolean } = {}) {
  console.log(`\n== ${label}: ${batch.map((i) => `${i.numSerie}${i.subsanacion ? "(subsanación)" : ""} ${i.kind === "ANULACION" ? "ANUL" : i.invoiceType}`).join(", ")}`);
  const { parsed, status, body } = await submitBatch(endpoint, batch, opts);
  console.log(`HTTP ${status} · EstadoEnvio=${parsed.estadoEnvio} · CSV=${parsed.csv} · TiempoEsperaEnvio=${parsed.tiempoEsperaEnvio}`);
  parsed.lines.forEach((l, i) => {
    console.log(`  ${l.numSerie} [${l.operacion}] ${l.estadoRegistro}${l.codigoError ? ` · ${l.codigoError}: ${l.descripcionError}` : ""}${l.duplicado ? ` · DUPLICADO(${l.duplicado.estado})` : ""}`);
    // La cadena de la AEAT solo avanza con los registros que acepta.
    if (l.estadoRegistro !== "Incorrecto" && batch[i]) last = asPrev(batch[i]);
  });
  if (last) writeFileSync(STATE, JSON.stringify(last));
  if (process.env.VERBOSE) console.log(body);
  return parsed;
}

const DE: Recipient = { name: "Cliente Prueba GmbH", nif: "DE811115368", country: "Alemania" };
const MA: Recipient = { name: "Cliente Prueba Maroc", nif: "AB123456", country: "Marruecos" };
const FR_BAD: Recipient = { name: "Cliente Prueba SARL", nif: "FR12345678901", country: "Francia" };

async function main() {
  const mode = process.argv[2] || "base";
  console.log(`Endpoint: ${endpoint}`);
  if (mode === "base" || mode === "f1es") {
    const a = build(`TEST-${stamp}-A`, "F2", 12100, last, null);
    const b = build(`TEST-${stamp}-B`, "F1", 24200, asPrev(a), DE);
    const c = build(`TEST-${stamp}-C`, "F1", 6050, asPrev(b), MA);
    const d = build(`TEST-${stamp}-D`, "R1", -6050, asPrev(c), MA, { rectifies: { numSerie: c.numSerie, issueDate: c.issueDate } });
    const e = annul(a, asPrev(d));
    const batch = [a, b, c, d, e];
    if (mode === "f1es") batch.push(build(`TEST-${stamp}-F`, "F1", 6050, asPrev(e), { name: "HBTJ CONSULTORES LINGÜISTICOS SL", nif: EMITTER_NIF, country: "España" }));
    await send("base", batch);
  } else if (mode === "subsanacion") {
    const bad = build(`TEST-${stamp}-S`, "F1", 12100, last, FR_BAD);
    const r1 = await send("1. alta con NIF-IVA inválido (debe rechazarse)", [bad]);
    if (r1.lines[0]?.estadoRegistro !== "Incorrecto") console.log("  (!) no se rechazó");
    // Subsanación de un alta RECHAZADA: Subsanacion=S + RechazoPrevio=X, huella nueva, encadenada con el registro inmediatamente anterior.
    const fixed = build(bad.numSerie, "F1", 12100, asPrev(bad), DE, { subsanacion: true, rechazoPrevio: true });
    await send("2. subsanación (S + RechazoPrevio X), encadenada tras el rechazado", [fixed]);
    // Subsanación de un registro ACEPTADO (solo Subsanacion=S).
    const again = build(bad.numSerie, "F1", 12100, asPrev(fixed), { ...DE, name: "Cliente Prueba GmbH (corregido)" }, { subsanacion: true });
    await send("3. subsanación de un registro ya aceptado (solo S)", [again]);
  } else if (mode === "r5") {
    const f2 = build(`TEST-${stamp}-G`, "F2", 12100, last, null);
    const r5 = build(`TEST-${stamp}-H`, "R5", -12100, asPrev(f2), null, { rectifies: { numSerie: f2.numSerie, issueDate: f2.issueDate } });
    await send("F2 + R5 que la rectifica", [f2, r5]);
    const r1sobreF2 = build(`TEST-${stamp}-I`, "R1", -500, last, DE, { rectifies: { numSerie: f2.numSerie, issueDate: f2.issueDate } });
    await send("(contraste) R1 que rectifica una F2", [r1sobreF2]);
  } else if (mode === "huella") {
    const orphan = build(`TEST-${stamp}-J`, "F2", 12100, last, null);
    const ghost = build(`TEST-${stamp}-K`, "F2", 12100, { numSerie: orphan.numSerie, issueDate: orphan.issueDate, hash: orphan.hash }, null);
    await send("K encadenada a un J que NO se envía (huella anterior inexistente en la AEAT)", [ghost]);
  } else if (mode === "inmediato") {
    const a = build(`TEST-${stamp}-N`, "F2", 12100, last, null);
    await send("registro recién generado, enviado al momento", [a]);
  } else if (mode === "tardio") {
    ageMs = 5 * 60 * 1000;
    const a = build(`TEST-${stamp}-T`, "F2", 12100, last, null);
    await send("registro con 5 min de antigüedad, sin Incidencia", [a]);
    const b = build(`TEST-${stamp}-U`, "F2", 12100, asPrev(a), null);
    await send("registro con 5 min de antigüedad, con Incidencia=S", [b], { incidencia: true });
  } else {
    console.error("Modo desconocido");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fallo:", (e as Error).message);
  process.exit(2);
});
