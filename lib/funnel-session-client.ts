import type { CheckoutSessionSnapshot } from "@/lib/funnel-routing";

const STORAGE_KEY = "tj_fr_checkout_session_v1";

export function createCheckoutSessionId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `fr_${Date.now().toString(36)}_${random}`;
}

export function readCheckoutSession(): CheckoutSessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutSessionSnapshot;
    if (!parsed?.sessionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCheckoutSession(snapshot: CheckoutSessionSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures (private mode, quota, etc.)
  }
}

export function clearCheckoutSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

