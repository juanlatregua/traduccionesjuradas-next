import { NextResponse } from "next/server";
import { handleOpen } from "@/lib/entrada/api.ts";
import { entradaApiDeps } from "@/lib/entrada/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (r: { status: number; body: unknown; headers?: Record<string, string> }) => NextResponse.json(r.body, { status: r.status, headers: r.headers });

export async function POST(req: Request) {
  return respond(await handleOpen(req, entradaApiDeps));
}
