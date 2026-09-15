import { NextResponse } from "next/server";
import { escalateStaleDirectRequests } from "@/lib/lavori-directo";

export const runtime = "nodejs";
export const maxDuration = 300;

function hasCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === secret || header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!hasCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  const result = await escalateStaleDirectRequests();
  return NextResponse.json(result);
}

export const POST = GET;
