import crypto from "crypto";

type PendingPayload = {
  email: string;
  codeHash: string;
  exp: number;
};

type VerifiedPayload = {
  email: string;
  exp: number;
};

export const STAFF_OTP_PENDING_COOKIE = "staff_otp_pending";
export const STAFF_OTP_VERIFIED_COOKIE = "staff_otp_verified";

function getSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("NEXTAUTH_SECRET no configurado.");
  return "staff-otp-dev-secret";
}

// v2 (22-oct-2026): cada tipo de token firma con su propio dominio (un «pendiente»
// no vale como «verificado») y el código nunca viaja en claro en la cookie.
type TokenKind = "pending" | "verified";

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(kind: TokenKind, payloadB64: string) {
  return crypto.createHmac("sha256", getSecret()).update(`staff-otp:v2:${kind}:${payloadB64}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

function hashCode(email: string, exp: number, code: string) {
  return crypto.createHmac("sha256", getSecret()).update(`staff-otp:v2:code:${email}:${exp}:${code}`).digest("base64url");
}

function encodeSignedPayload<T>(kind: TokenKind, payload: T) {
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(kind, payloadB64);
  return `${payloadB64}.${signature}`;
}

function decodeSignedPayload<T>(kind: TokenKind, value?: string | null) {
  if (!value) return null;
  const [payloadB64, signature] = value.split(".");
  if (!payloadB64 || !signature) return null;
  if (!safeEqual(sign(kind, payloadB64), signature)) return null;
  try {
    return JSON.parse(fromBase64Url(payloadB64)) as T;
  } catch {
    return null;
  }
}

export function createPendingOtpToken(email: string, code: string, ttlMs: number) {
  const normalized = email.trim().toLowerCase();
  const exp = Date.now() + ttlMs;
  const payload: PendingPayload = { email: normalized, codeHash: hashCode(normalized, exp, code), exp };
  return encodeSignedPayload("pending", payload);
}

export function readPendingOtpToken(value?: string | null) {
  return decodeSignedPayload<PendingPayload>("pending", value);
}

export function isPendingOtpCodeValid(pending: PendingPayload, code: string) {
  if (typeof pending.codeHash !== "string") return false;
  return safeEqual(hashCode(pending.email, pending.exp, code.trim()), pending.codeHash);
}

export function createVerifiedOtpToken(email: string, ttlMs: number) {
  const payload: VerifiedPayload = {
    email: email.trim().toLowerCase(),
    exp: Date.now() + ttlMs,
  };
  return encodeSignedPayload("verified", payload);
}

export function isVerifiedOtpTokenValid(value: string | undefined, email: string | null | undefined) {
  if (!value || !email) return false;
  const payload = decodeSignedPayload<VerifiedPayload>("verified", value);
  if (!payload) return false;
  if (payload.exp < Date.now()) return false;
  return payload.email === email.trim().toLowerCase();
}

export function readVerifiedOtpToken(value?: string | null) {
  const payload = decodeSignedPayload<VerifiedPayload>("verified", value);
  if (!payload) return null;
  if (payload.exp < Date.now()) return null;
  return payload;
}

export function generateOtpCode() {
  return String(crypto.randomInt(100000, 1000000));
}
