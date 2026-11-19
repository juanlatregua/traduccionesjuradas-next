import { handleConfirm } from "@/lib/lectura-constructor/api.ts";
import { apiDeps } from "@/lib/lectura-constructor/server.ts";
import { respond } from "../../respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  return respond(await handleConfirm(req, params.id, apiDeps));
}
