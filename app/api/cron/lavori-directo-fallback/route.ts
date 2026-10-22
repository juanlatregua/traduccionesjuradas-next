import { NextResponse } from "next/server";
import { escalateStaleDirectRequests } from "@/lib/lavori-directo";
import { hasCronSecret } from "@/lib/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!hasCronSecret(req, process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }
  const result = await escalateStaleDirectRequests();
  return NextResponse.json(result);
}

export const POST = GET;
