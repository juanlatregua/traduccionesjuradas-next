// app/api/expenses/extract/route.ts — STAFF: extrae datos de una factura de
// proveedor (PDF/imagen) con IA para prerellenar el alta de gasto. No guarda nada.
import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { extractExpenseFromDocument } from "@/lib/ai/extract-expense";

export const runtime = "nodejs";

const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const rl = await checkRateLimit({ key: `expense-extract:${access.email}:${getClientIp(req)}`, limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ ok: false, error: "Demasiadas extracciones en poco tiempo." }, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Envía la factura como multipart/form-data." }, { status: 400 });
  }

  try {
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Archivo requerido." }, { status: 400 });
    if (file.type && !ALLOWED.has(file.type)) return NextResponse.json({ ok: false, error: "Solo PDF o imagen." }, { status: 400 });
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Archivo demasiado grande (max 10 MB)." }, { status: 400 });

    const fileBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const data = await extractExpenseFromDocument({ fileBase64, mimeType: file.type || "application/pdf", fileName: file.name });
    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error("[expenses-extract] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo extraer." }, { status: 500 });
  }
}
