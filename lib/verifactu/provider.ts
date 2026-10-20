// lib/verifactu/provider.ts — Frontera con el PROVEEDOR de envío a la AEAT
// (colaborador social que firma y remite los registros en nombre del emisor).
//
// Decisión (nota 3-sep-2026): vía B, proveedor por API. Hasta que Juan dé de
// alta uno, no hay proveedor configurado y los registros se quedan en LOCAL:
// la cadena de huellas existe y es verificable, pero NO se remite nada y el
// PDF NO lleva QR ni frase "verificable". Cuando llegue la clave, solo hay que
// implementar `send` para el proveedor elegido y poner VERIFACTU_PROVIDER.

import { aeatDirectProvider } from "./aeat-direct.ts";

export type ProviderSendInput = {
  recordId?: string; // RefExterna: la AEAT lo devuelve y sirve para casar la respuesta
  kind: "ALTA" | "ANULACION";
  emitterNif: string;
  numSerie: string;
  issueDate: string; // dd-mm-aaaa
  invoiceType: string;
  cuotaTotalCents: number;
  importeTotalCents: number;
  vatRate?: number; // 0.21
  description?: string;
  hash: string;
  prevHash: string | null;
  prev?: { emitterNif: string; numSerie: string; issueDate: string } | null; // registro anterior de la cadena
  generatedAtIso: string;
  recipient?: { name: string; nif?: string | null; country?: string | null } | null;
  lines?: { description: string; baseCents: number; vatRate: number; vatCents: number }[];
  rectifies?: { numSerie: string; issueDate: string } | null;
  subsanacion?: boolean; // alta que corrige un registro anterior de la misma factura (Subsanacion=S)
  rechazoPrevio?: boolean; // …y el anterior fue rechazado, no existe en la AEAT (RechazoPrevio=X)
  sinRegistroPrevio?: boolean; // anulación de una factura cuyo alta nunca se remitió (LOCAL)
};

export type ProviderSendResult = {
  status: "ACCEPTED" | "ACCEPTED_WITH_ERRORS" | "REJECTED" | "SENT";
  providerRef?: string | null;
  response?: unknown;
  error?: string | null;
};

export type ProviderBatchResult = {
  results: ProviderSendResult[]; // mismo orden que la entrada
  waitSeconds?: number | null; // TiempoEsperaEnvio de la AEAT
};

export interface VerifactuProvider {
  readonly name: string;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
  // Envío en lote (un emisor por llamada). Lanza si el envío entero falla.
  sendBatch?(inputs: ProviderSendInput[], opts?: { incidencia?: boolean }): Promise<ProviderBatchResult>;
}

export function getVerifactuProvider(): VerifactuProvider | null {
  const name = String(process.env.VERIFACTU_PROVIDER || "").trim().toLowerCase();
  if (!name) return null;
  if (name === "aeat") return aeatDirectProvider(verifactuEnv());
  // Configurar la variable con un nombre sin adaptador es un error visible, no un silencio.
  throw new Error(`VERIFACTU_PROVIDER="${name}" no tiene adaptador implementado todavía.`);
}

/**
 * Entorno de la AEAT. En producción de Vercel la variable tiene que valer exactamente «prod» o
 * «test»: cualquier otra cosa lanza (fail-closed) en vez de caer a pruebas sin que nadie lo vea.
 */
export function verifactuEnv(): "prod" | "test" {
  const raw = process.env.VERIFACTU_ENV;
  if (raw === "prod" || raw === "test") return raw;
  if (process.env.VERCEL_ENV === "production") throw new Error(`VERIFACTU_ENV="${raw ?? ""}" no válido en producción: debe ser exactamente "prod" o "test".`);
  return String(raw || "test").toLowerCase() === "prod" ? "prod" : "test";
}

/** QR y frase solo si el entorno guardado al aceptar el registro coincide con el actual. */
export function pdfEnvMatches(stored: string | undefined | null, current: "prod" | "test"): boolean {
  return stored === current;
}
