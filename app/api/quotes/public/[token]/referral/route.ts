import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { applyReferralToQuote, redeemReferralCreditOnQuote } from "@/lib/referral";

export const runtime = "nodejs";

type Params = { params: { token: string } };

// /q/[token]: el invitado aplica un código de recomendación o el dueño canjea su crédito.
export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({ key: `quote-referral:${params.token}:${ip}`, limit: 8, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }
  const body = (await req.json().catch(() => ({}))) as { code?: string; action?: string };
  const quote = await prisma.quote.findUnique({ where: { publicToken: params.token }, select: { id: true, tokenExpiresAt: true } });
  if (!quote || (quote.tokenExpiresAt && quote.tokenExpiresAt < new Date())) {
    return NextResponse.json({ ok: false, message: "Presupuesto no encontrado." }, { status: 404 });
  }
  try {
    const result = body.action === "credit" ? await redeemReferralCreditOnQuote(quote.id) : await applyReferralToQuote(quote.id, String(body.code || ""));
    if (!result.ok) {
      if (result.detail) console.warn(`[q-referral] ${quote.id} ${result.reason}: ${result.detail}`);
      return NextResponse.json({ ok: false, reason: result.reason, message: result.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, discountCents: result.discountCents, total: result.total, clamped: result.clamped, kind: result.kind });
  } catch (e) {
    console.error("[q-referral] error", e);
    return NextResponse.json({ ok: false, message: "No se ha podido aplicar ahora. Inténtalo de nuevo." }, { status: 500 });
  }
}
