// lib/verifactu/aeat-direct.ts — Proveedor «aeat»: remisión VERI*FACTU DIRECTA a la AEAT.
//
// SOAP sobre HTTPS con autenticación de cliente (mTLS) con el certificado de
// representante (PKCS#12) del obligado. Endpoints del WSDL oficial
// (SistemaFacturacion.wsdl, servicio sfVerifactu):
//   · pruebas:    https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP
//   · producción: https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP
//     (www10 / prewww10 son para certificado de SELLO, no el nuestro)
// Credenciales: VERIFACTU_CERT_P12_BASE64 (prod) o VERIFACTU_CERT_PATH (local) +
// VERIFACTU_CERT_PASSWORD. La contraseña nunca se registra.

import https from "node:https";
import { readFileSync } from "node:fs";
import { buildEnvelope, AeatDataError } from "./aeat-xml.ts";
import { parseAeatResponse, lineToResult, matchLines, type AeatResponse } from "./aeat-response.ts";
import type { ProviderBatchResult, ProviderSendInput, ProviderSendResult, VerifactuProvider } from "./provider.ts";

export const AEAT_ENDPOINTS = {
  test: "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
  prod: "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP",
} as const;

const TIMEOUT_MS = 30_000;

let cachedAgent: https.Agent | null = null;

export function loadCertificate(): { pfx: Buffer; passphrase: string } {
  const passphrase = process.env.VERIFACTU_CERT_PASSWORD || "";
  const b64 = process.env.VERIFACTU_CERT_P12_BASE64;
  const path = process.env.VERIFACTU_CERT_PATH;
  if (!passphrase) throw new Error("Falta VERIFACTU_CERT_PASSWORD.");
  if (b64) return { pfx: Buffer.from(b64, "base64"), passphrase };
  if (path) return { pfx: readFileSync(path), passphrase };
  throw new Error("Falta el certificado: VERIFACTU_CERT_P12_BASE64 o VERIFACTU_CERT_PATH.");
}

function agent(): https.Agent {
  if (!cachedAgent) cachedAgent = new https.Agent({ ...loadCertificate(), keepAlive: false });
  return cachedAgent;
}

/** POST del sobre SOAP. Devuelve estado HTTP y cuerpo; los fallos de red/timeout lanzan. */
export function postSoap(endpoint: string, xml: string, opts?: { timeoutMs?: number }): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const req = https.request(
      {
        method: "POST",
        hostname: url.hostname,
        path: url.pathname + url.search,
        agent: agent(),
        headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: '""', "Content-Length": Buffer.byteLength(xml, "utf8") },
        timeout: opts?.timeoutMs ?? TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("timeout", () => req.destroy(new Error(`Timeout de ${(opts?.timeoutMs ?? TIMEOUT_MS) / 1000}s hablando con la AEAT.`)));
    req.on("error", reject);
    req.write(xml, "utf8");
    req.end();
  });
}

/** Envía un lote y devuelve la respuesta ya parseada. Lanza si no hay respuesta SOAP utilizable. */
export async function submitBatch(endpoint: string, inputs: ProviderSendInput[], opts: { incidencia?: boolean } = {}): Promise<{ parsed: AeatResponse; status: number; body: string }> {
  const xml = buildEnvelope(inputs, opts);
  const { status, body } = await postSoap(endpoint, xml);
  const parsed = parseAeatResponse(body);
  if (parsed.fault) throw new Error(`SOAP Fault de la AEAT (HTTP ${status}): ${parsed.fault}`);
  if (!parsed.estadoEnvio) throw new Error(`Respuesta de la AEAT sin EstadoEnvio (HTTP ${status}): ${body.slice(0, 300)}`);
  return { parsed, status, body };
}

export function resultsFromResponse(inputs: ProviderSendInput[], parsed: AeatResponse): ProviderBatchResult {
  const matched = matchLines(inputs, parsed.lines);
  // Sin línea para un registro: el envío entero fue rechazado (cabecera/estructura). No es un
  // rechazo del registro: se lanza y el registro sigue en cola para reintentar tras corregirlo.
  const missing = matched.findIndex((l) => !l);
  if (missing >= 0) throw new Error(`Envío ${parsed.estadoEnvio}: la AEAT no devolvió línea para ${inputs[missing].numSerie}. Respuesta: ${JSON.stringify(parsed).slice(0, 400)}`);
  const results: ProviderSendResult[] = matched.map((line) => {
    const r = lineToResult(line!, parsed.csv);
    r.response = { ...(r.response as object), estadoEnvio: parsed.estadoEnvio, tiempoEsperaEnvio: parsed.tiempoEsperaEnvio };
    return r;
  });
  return { results, waitSeconds: parsed.tiempoEsperaEnvio };
}

export function aeatDirectProvider(env: "prod" | "test"): VerifactuProvider {
  const endpoint = AEAT_ENDPOINTS[env];
  return {
    name: "aeat",
    async sendBatch(inputs, opts) {
      const { parsed } = await submitBatch(endpoint, inputs, opts);
      return resultsFromResponse(inputs, parsed);
    },
    async send(input) {
      const { results } = await this.sendBatch!([input]);
      return results[0];
    },
  };
}

export { AeatDataError };
