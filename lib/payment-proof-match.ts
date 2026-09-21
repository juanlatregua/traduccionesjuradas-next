// lib/payment-proof-match.ts — ¿El justificante que subió el cliente cuadra con SU pedido?
// Puro (sin Prisma ni red) para poder probarlo. Solo dice sí cuando cuadra TODO:
// un cruce dudoso que lanza un pedido es peor que avisar a staff.
import type { PaymentProofRead } from "@/lib/ai/extract-payment-proof";

export const PROOF_MIN_CONFIDENCE = 0.85;

export type ProofOrderContext = {
  totalCents: number;
  ourAccountsLast4: string[];
  /** Envío del presupuesto (o creación del pedido): el pago no puede ser anterior. */
  since: Date;
  now: Date;
};

export type ProofDecision = { ok: true } | { ok: false; reasons: string[] };

export function madridDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const eur = (cents: number) => `${(cents / 100).toFixed(2)} €`;

/** Haiku a veces devuelve 90 en vez de 0.9: se lleva a 0..1. */
export function normalizeConfidence(value: unknown): number {
  let n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (n > 1) n = n / 100;
  return Math.min(1, n);
}

/** Solo se lee automáticamente lo que el cliente declaró como transferencia. */
export function proofNeedsManualReview(method: string | null | undefined): boolean {
  return String(method || "").toUpperCase() !== "TRANSFER";
}

/** Huella de la transferencia: importe|fecha|ordenante|cuenta. Null si falta importe o fecha. */
export function transferFingerprint(
  read: Pick<PaymentProofRead, "importeCents" | "fecha" | "ordenante" | "cuentaDestinoUltimos4">
): string | null {
  if (read.importeCents == null || !read.fecha) return null;
  const ordenante = String(read.ordenante || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  const cuenta = String(read.cuentaDestinoUltimos4 || "").replace(/\D/g, "").slice(-4);
  return `${read.importeCents}|${read.fecha}|${ordenante}|${cuenta}`;
}

export type ConfirmedProof = { reference: string; fileHash?: string | null; fingerprint?: string | null };

/** ¿Este justificante (mismo fichero o misma transferencia) ya lanzó otro pedido? */
export function findReusedProof(
  current: { reference: string; fileHash: string | null; fingerprint: string | null },
  confirmed: ConfirmedProof[]
): { reference: string; by: "fichero" | "transferencia" } | null {
  for (const c of confirmed) {
    if (c.reference === current.reference) continue;
    if (current.fileHash && c.fileHash === current.fileHash) return { reference: c.reference, by: "fichero" };
    if (current.fingerprint && c.fingerprint === current.fingerprint) return { reference: c.reference, by: "transferencia" };
  }
  return null;
}

export function matchProofToOrder(
  read: Pick<PaymentProofRead, "esJustificante" | "confianza" | "importeCents" | "moneda" | "cuentaDestinoUltimos4" | "fecha">,
  ctx: ProofOrderContext
): ProofDecision {
  const reasons: string[] = [];

  if (!read.esJustificante) reasons.push("el documento no parece un justificante de pago");
  const confianza = normalizeConfidence(read.confianza);
  if (confianza < PROOF_MIN_CONFIDENCE) {
    reasons.push(`lectura poco fiable (confianza ${Math.round(confianza * 100)} %)`);
  }

  const moneda = String(read.moneda || "").trim().toUpperCase();
  if (moneda !== "EUR") reasons.push(moneda ? `moneda ${moneda}, no EUR` : "no se ve la moneda");

  if (read.importeCents == null) reasons.push("no se ha podido leer el importe");
  else if (read.importeCents !== ctx.totalCents) {
    reasons.push(`importe ${eur(read.importeCents)} distinto del total del pedido ${eur(ctx.totalCents)}`);
  }

  const last4 = String(read.cuentaDestinoUltimos4 || "").replace(/\D/g, "").slice(-4);
  const ours = ctx.ourAccountsLast4.map((c) => c.replace(/\D/g, "").slice(-4));
  if (last4.length !== 4) reasons.push("no se ve la cuenta de destino");
  else if (!ours.includes(last4)) reasons.push(`cuenta de destino ····${last4} no es nuestra`);

  const fecha = String(read.fecha || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) reasons.push("no se ve la fecha del pago");
  else {
    if (fecha < madridDay(ctx.since)) reasons.push(`fecha ${fecha} anterior al presupuesto (${madridDay(ctx.since)})`);
    if (fecha > madridDay(ctx.now)) reasons.push(`fecha ${fecha} en el futuro`);
  }

  return reasons.length ? { ok: false, reasons } : { ok: true };
}
