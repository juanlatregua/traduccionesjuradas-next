import { prisma } from "@/lib/prisma";

type Bucket = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, Bucket>();
let lastDbCleanupAt = 0;

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

type RateLimitParams = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitResult = {
  ok: true;
  remaining: number;
  retryAfterSec: number;
} | {
  ok: false;
  remaining: 0;
  retryAfterSec: number;
};

function shouldUseDistributedStore() {
  const forced = String(process.env.RATE_LIMIT_STORE || "").trim().toLowerCase();
  if (forced === "memory") return false;
  if (forced === "db") return true;
  return Boolean(process.env.DATABASE_URL);
}

function checkRateLimitMemory(params: RateLimitParams): RateLimitResult {
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

async function maybeCleanupDistributedStore(nowMs: number) {
  if (nowMs - lastDbCleanupAt < 60_000) return;
  if (Math.random() > 0.05) return;
  lastDbCleanupAt = nowMs;
  const threshold = new Date(nowMs - 24 * 60 * 60 * 1000);
  await prisma.rateLimitBucket.deleteMany({
    where: { resetAt: { lt: threshold } },
  });
}

async function checkRateLimitDistributed(params: RateLimitParams): Promise<RateLimitResult> {
  const nowMs = Date.now();
  const now = new Date(nowMs);
  const resetAt = new Date(nowMs + params.windowMs);

  await maybeCleanupDistributedStore(nowMs).catch((err) => {
    console.error("[rate-limit] cleanup warning", err);
  });

  return prisma.$transaction(async (tx) => {
    const existing = await tx.rateLimitBucket.findUnique({
      where: { key: params.key },
      select: { count: true, resetAt: true },
    });

    if (!existing || existing.resetAt <= now) {
      await tx.rateLimitBucket.upsert({
        where: { key: params.key },
        create: {
          key: params.key,
          count: 1,
          resetAt,
        },
        update: {
          count: 1,
          resetAt,
        },
      });
      return {
        ok: true as const,
        remaining: Math.max(0, params.limit - 1),
        retryAfterSec: 0,
      };
    }

    if (existing.count >= params.limit) {
      return {
        ok: false as const,
        remaining: 0 as const,
        retryAfterSec: Math.max(1, Math.ceil((existing.resetAt.getTime() - nowMs) / 1000)),
      };
    }

    const updated = await tx.rateLimitBucket.update({
      where: { key: params.key },
      data: {
        count: {
          increment: 1,
        },
      },
      select: { count: true },
    });

    return {
      ok: true as const,
      remaining: Math.max(0, params.limit - updated.count),
      retryAfterSec: 0,
    };
  });
}

export async function checkRateLimit(params: RateLimitParams): Promise<RateLimitResult> {
  if (shouldUseDistributedStore()) {
    try {
      return await checkRateLimitDistributed(params);
    } catch (err) {
      console.error("[rate-limit] distributed store failed, fallback memory", err);
      return checkRateLimitMemory(params);
    }
  }
  return checkRateLimitMemory(params);
}
