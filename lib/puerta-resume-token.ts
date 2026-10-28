// lib/puerta-resume-token.ts — token firmado del botón «Continuar con mi pedido»
// del email del presupuesto automático: reabre la puerta con ESE documento ya
// analizado (antes llevaba a la puerta vacía). Sin imports con alias para poder
// probarlo con node --test.

import crypto from "node:crypto";

export const RESUME_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type ResumePayload = { s: string; d: string; exp: number };

function sig(secret: string, b64: string) {
  return crypto.createHmac("sha256", secret).update(`retomar:${b64}`).digest("base64url");
}

export function createResumeToken(secret: string, sessionToken: string, documentId: string, now = Date.now()): string {
  if (!secret) throw new Error("secret requerido");
  const b64 = Buffer.from(JSON.stringify({ s: sessionToken, d: documentId, exp: now + RESUME_TOKEN_TTL_MS } satisfies ResumePayload)).toString("base64url");
  return `${b64}.${sig(secret, b64)}`;
}

export function verifyResumeToken(secret: string, token: string | null | undefined, now = Date.now()): { sessionToken: string; documentId: string } | null {
  if (!secret || !token) return null;
  const [b64, s] = token.split(".");
  if (!b64 || !s) return null;
  const a = Buffer.from(s);
  const b = Buffer.from(sig(secret, b64));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as ResumePayload;
    if (!p || typeof p.s !== "string" || !p.s || typeof p.d !== "string" || !p.d || typeof p.exp !== "number" || p.exp < now) return null;
    return { sessionToken: p.s, documentId: p.d };
  } catch {
    return null;
  }
}
