import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/rate-limit";
import { handleReviewPost } from "@/lib/order-review";
import { reviewDeps } from "@/lib/order-review-db";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: { reference: string } }) {
  const body = (await req.json().catch(() => null)) as { t?: unknown; r?: unknown; comment?: unknown } | null;
  if (!body) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const res = await handleReviewPost(
    { reference: params.reference, t: body.t, r: body.r, comment: body.comment, ip: getClientIp(req) },
    reviewDeps
  );
  return NextResponse.json(res.body, { status: res.status });
}
