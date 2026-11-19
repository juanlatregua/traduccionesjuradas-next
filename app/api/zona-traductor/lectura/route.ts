import { handleStart } from "@/lib/lectura-constructor/api.ts";
import { apiDeps } from "@/lib/lectura-constructor/server.ts";
import { respond } from "./respond";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return respond(await handleStart(req, apiDeps));
}
