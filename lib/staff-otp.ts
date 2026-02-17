import crypto from "crypto";

type PendingPayload = {
  email: string;
  code: string;
  exp: number;
};

type VerifiedPayload = {
  email: string;
  exp: number;
};

export const STAFF_OTP_PENDING_COOKIE = "staff_otp_pending";
export const STAFF_OTP_VERIFIED_COOKIE = "staff_otp_verified";

function getSecret() {
  return process.env.NEXTAUTH_SECRET || "staff-otp-dev-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payloadB64: string) {
  return crypto.createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

function encodeSignedPayload<T>(payload: T) {
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

function decodeSignedPayload<T>(value?: string | null) {
  if (!value) return null;
  const [payloadB64, signature] = value.split(".");
  if (!payloadB64 || !signature) return null;
  if (sign(payloadB64) !== signature) return null;
  try {
    return JSON.parse(fromBase64Url(payloadB64)) as T;
  } catch {
    return null;
  }
}

export function createPendingOtpToken(email: string, code: string, ttlMs: number) {
  const payload: PendingPayload = {
    email: email.trim().toLowerCase(),
    code,
    exp: Date.now() + ttlMs,
  };
  return encodeSignedPayload(payload);
}

export function readPendingOtpToken(value?: string | null) {
  return decodeSignedPayload<PendingPayload>(value);
}

export function createVerifiedOtpToken(email: string, ttlMs: number) {
  const payload: VerifiedPayload = {
    email: email.trim().toLowerCase(),
    exp: Date.now() + ttlMs,
  };
  return encodeSignedPayload(payload);
}

export function isVerifiedOtpTokenValid(value: string | undefined, email: string | null | undefined) {
  if (!value || !email) return false;
  const payload = decodeSignedPayload<VerifiedPayload>(value);
  if (!payload) return false;
  if (payload.exp < Date.now()) return false;
  return payload.email === email.trim().toLowerCase();
}

export function generateOtpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
