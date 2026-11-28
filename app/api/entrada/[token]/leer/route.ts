import { NextResponse } from "next/server";
import { handleRead } from "@/lib/entrada/api.ts";
import { entradaApiDeps } from "@/lib/entrada/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const respond = (r: { status: number; body: unknown; headers?: Record<string, string> }) => NextResponse.json(r.body, { status: r.status, headers: r.headers });
type Ctx = { params: { token: string } };

export async function POST(req: Request, { params }: Ctx) {
  const receivedAt = Date.now();
  return respond(await handleRead(req, params.token, entradaApiDeps, receivedAt));
}
