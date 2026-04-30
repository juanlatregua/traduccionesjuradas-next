"use client";

const KEY = "completed_orders_v1";
const MAX_ENTRIES = 5;
const TTL_MS = 7 * 24 * 3600 * 1000;

export type StoredOrder = {
  reference: string;
  documentType?: string;
  estimatedDelivery?: string;
  status?: string;
  createdAt: number;
};

function safeParse(raw: string | null): StoredOrder[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (o): o is StoredOrder =>
        typeof o?.reference === "string" && typeof o?.createdAt === "number",
    );
  } catch {
    return [];
  }
}

function purgeExpired(orders: StoredOrder[]): StoredOrder[] {
  const cutoff = Date.now() - TTL_MS;
  return orders.filter((o) => o.createdAt >= cutoff);
}

export function getRecentOrders(): StoredOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const orders = purgeExpired(safeParse(localStorage.getItem(KEY)));
    return orders.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function saveCompletedOrder(order: Omit<StoredOrder, "createdAt">): void {
  if (typeof window === "undefined") return;
  try {
    const existing = purgeExpired(safeParse(localStorage.getItem(KEY)));
    const filtered = existing.filter((o) => o.reference !== order.reference);
    const next = [
      { ...order, createdAt: Date.now() },
      ...filtered,
    ].slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // quota or disabled — silent
  }
}

export function removeOrder(reference: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = purgeExpired(safeParse(localStorage.getItem(KEY)));
    const next = existing.filter((o) => o.reference !== reference);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // silent
  }
}
