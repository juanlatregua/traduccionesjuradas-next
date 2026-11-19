import { NextResponse } from "next/server";
import { handleConfirmLink } from "@/lib/entrada/api.ts";
import { entradaApiDeps } from "@/lib/entrada/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = await handleConfirmLink(req, entradaApiDeps);
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}
