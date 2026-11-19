import { NextResponse } from "next/server";
import { handleAddFile, handleRemoveFile } from "@/lib/entrada/api.ts";
import { entradaApiDeps } from "@/lib/entrada/server.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (r: { status: number; body: unknown; headers?: Record<string, string> }) => NextResponse.json(r.body, { status: r.status, headers: r.headers });
type Ctx = { params: { token: string } };

export async function POST(req: Request, { params }: Ctx) {
  return respond(await handleAddFile(req, params.token, entradaApiDeps));
}

export async function DELETE(req: Request, { params }: Ctx) {
  const id = new URL(req.url).searchParams.get("id") || "";
  return respond(await handleRemoveFile(req, params.token, id, entradaApiDeps));
}
