// lib/verifactu/provider.ts — Frontera con el PROVEEDOR de envío a la AEAT
// (colaborador social que firma y remite los registros en nombre del emisor).
//
// Decisión (nota 3-sep-2026): vía B, proveedor por API. Hasta que Juan dé de
// alta uno, no hay proveedor configurado y los registros se quedan en LOCAL:
// la cadena de huellas existe y es verificable, pero NO se remite nada y el
// PDF NO lleva QR ni frase "verificable". Cuando llegue la clave, solo hay que
// implementar `send` para el proveedor elegido y poner VERIFACTU_PROVIDER.

export type ProviderSendInput = {
  kind: "ALTA" | "ANULACION";
  emitterNif: string;
  numSerie: string;
  issueDate: string; // dd-mm-aaaa
  invoiceType: string;
  cuotaTotalCents: number;
  importeTotalCents: number;
  hash: string;
  prevHash: string | null;
  generatedAtIso: string;
  recipient?: { name: string; nif?: string | null; country?: string | null } | null;
  lines?: { description: string; baseCents: number; vatRate: number; vatCents: number }[];
  rectifies?: { numSerie: string; issueDate: string } | null;
};

export type ProviderSendResult = {
  status: "ACCEPTED" | "ACCEPTED_WITH_ERRORS" | "REJECTED" | "SENT";
  providerRef?: string | null;
  response?: unknown;
  error?: string | null;
};

export interface VerifactuProvider {
  readonly name: string;
  send(input: ProviderSendInput): Promise<ProviderSendResult>;
}

export function getVerifactuProvider(): VerifactuProvider | null {
  const name = String(process.env.VERIFACTU_PROVIDER || "").trim().toLowerCase();
  if (!name) return null;
  // Aquí se registra el adaptador del proveedor elegido (Binovo, apiverifactu,
  // InvoCash…). Hasta entonces, configurar la variable sin adaptador es un error
  // visible, no un silencio.
  throw new Error(`VERIFACTU_PROVIDER="${name}" no tiene adaptador implementado todavía.`);
}

export function verifactuEnv(): "prod" | "test" {
  return String(process.env.VERIFACTU_ENV || "test").toLowerCase() === "prod" ? "prod" : "test";
}
