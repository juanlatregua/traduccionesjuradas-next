// lib/expediente-token.ts — Token firmado (HMAC) para consulta pública de un
// expediente, sin añadir campos al schema. El token encierra la referencia
// EXP-xxxx; la página /expediente/[token] verifica la firma y resuelve la ref.

import crypto from "crypto";

function getSecret() {
  return process.env.NEXTAUTH_SECRET || "expediente-dev-secret";
}

function sign(value: string) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

export function createExpedienteRef() {
  // EXP-XXXXXX (6 alfanuméricos en mayúscula, sin caracteres ambiguos)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return `EXP-${out}`;
}

export function createExpedienteToken(ref: string) {
  const payload = Buffer.from(ref, "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readExpedienteToken(token?: string | null): string | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  if (sign(payload) !== signature) return null;
  try {
    return Buffer.from(payload, "base64url").toString("utf8");
  } catch {
    return null;
  }
}
