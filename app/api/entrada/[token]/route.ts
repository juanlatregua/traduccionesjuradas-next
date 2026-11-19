import { NextResponse } from "next/server";
import { handleGet } from "@/lib/entrada/api.ts";
import { entradaApiDeps } from "@/lib/entrada/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (r: { status: number; body: unknown; headers?: Record<string, string> }) => NextResponse.json(r.body, { status: r.status, headers: r.headers });
type Ctx = { params: { token: string } };

export async function GET(req: Request, { params }: Ctx) {
  return respond(await handleGet(req, params.token, entradaApiDeps));
}
