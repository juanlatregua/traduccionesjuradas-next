import { NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/lectura-constructor/api.ts";

export function respond(r: ApiResponse) {
  return NextResponse.json(r.body, { status: r.status, headers: r.headers });
}
