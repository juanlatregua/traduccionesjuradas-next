import { divRoundHalfUp } from "../dinero/money.ts";

// USD cents per million tokens. Cache write = 5-minute write (1.25 × input).
// Update here when prices change; unknown models make the cost null instead of guessing.
export const MODEL_PRICES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 400, output: 2000, cacheRead: 20, cacheWrite: 500 },
  "claude-opus-5": { input: 500, output: 2500, cacheRead: 50, cacheWrite: 625 },
  "claude-opus-4-8": { input: 500, output: 2500, cacheRead: 50, cacheWrite: 625 },
};

export const DEFAULT_EUR_PER_USD = 0.86;

export type TokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type ModelUsage = TokenUsage & { model: string };

export const ZERO_USAGE: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return { input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite };
}

/** Cost in millionths of a USD cent (exact integer: tokens × cents per MTok). */
export function usageMicroCents(usage: ModelUsage): number | null {
  const p = MODEL_PRICES[usage.model];
  if (!p) return null;
  return usage.input * p.input + usage.output * p.output + usage.cacheRead * p.cacheRead + usage.cacheWrite * p.cacheWrite;
}

export type Cost = { usd: number; eurCents: number; unpricedModels: string[] };

export function costOf(usages: readonly ModelUsage[], eurPerUsd = DEFAULT_EUR_PER_USD): Cost {
  let micro = 0;
  const unpricedModels: string[] = [];
  for (const u of usages) {
    const c = usageMicroCents(u);
    if (c === null) unpricedModels.push(u.model);
    else micro += c;
  }
  const ratePpm = Math.round(eurPerUsd * 1_000_000);
  return { usd: micro / 100_000_000, eurCents: divRoundHalfUp(micro * ratePpm, 1_000_000_000_000), unpricedModels };
}
