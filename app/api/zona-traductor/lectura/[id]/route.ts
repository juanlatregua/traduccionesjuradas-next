import { handleEdit, handleGet } from "@/lib/lectura-constructor/api.ts";
import { apiDeps } from "@/lib/lectura-constructor/server.ts";
import { respond } from "../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  return respond(await handleGet(req, params.id, apiDeps));
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  return respond(await handleEdit(req, params.id, apiDeps));
}
