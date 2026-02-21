type Bucket = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, Bucket>();

function cleanup(now: number) {
  for (const [key, bucket] of memoryStore.entries()) {
    if (bucket.resetAt <= now) {
      memoryStore.delete(key);
    }
  }
}

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}) {
  const now = Date.now();
  cleanup(now);

  const existing = memoryStore.get(params.key);
  if (!existing || existing.resetAt <= now) {
    memoryStore.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { ok: true as const, remaining: params.limit - 1, retryAfterSec: 0 };
  }

  if (existing.count >= params.limit) {
    return {
      ok: false as const,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  memoryStore.set(params.key, existing);
  return {
    ok: true as const,
    remaining: Math.max(0, params.limit - existing.count),
    retryAfterSec: 0,
  };
}
