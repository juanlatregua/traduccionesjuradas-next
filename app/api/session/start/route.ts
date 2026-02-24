import { NextResponse } from "next/server";
import { createSessionRecord, attachSessionCookie } from "@/lib/session";
import { serializeOrderSession } from "@/lib/session-dto";

export const runtime = "nodejs";

type StartBody = {
  purpose?: string;
};

export async function POST(req: Request) {
  let body: StartBody = {};
  try {
    body = (await req.json()) as StartBody;
  } catch {
    body = {};
  }

  try {
    const session = await createSessionRecord({
      purpose: String(body.purpose || "").trim() || null,
      step: "UPLOAD",
    });
    const response = NextResponse.json({ ok: true, session: serializeOrderSession(session) });
    attachSessionCookie(response, session.id);
    return response;
  } catch (err: any) {
    console.error("[session/start] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo iniciar la sesion del encargo." },
      { status: 500 }
    );
  }
}

