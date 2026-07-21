// app/api/expenses/extract/route.ts — STAFF: extrae datos de una factura de
// proveedor (PDF/imagen) con IA para prerellenar el alta de gasto. No guarda nada.
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { requireStaffAccess } from "@/lib/staff-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { extractExpenseFromDocument, type ExtractedExpense } from "@/lib/ai/extract-expense";
import { prisma } from "@/lib/prisma";

// Aviso (no bloqueo): busca por nº de factura sin exigir NIF idéntico — el
// gasto existente puede tener el NIF vacío aunque la extracción lo traiga.
async function findDuplicateOf(data: ExtractedExpense) {
  if (!data.supplierInvoiceNumber) return null;
  return prisma.expense.findFirst({
    where: { supplierInvoiceNumber: data.supplierInvoiceNumber, isAccrual: false },
    select: { id: true, date: true, totalCents: true, supplier: true, concept: true },
  });
}

export const runtime = "nodejs";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", DOCX_MIME]);

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
    const isDocx = file.type === DOCX_MIME || /\.docx$/i.test(file.name);
    if (!isDocx && /\.doc$/i.test(file.name)) {
      return NextResponse.json({ ok: false, error: "El Word antiguo (.doc) no se soporta. Guárdalo como .docx o PDF." }, { status: 400 });
    }
    if (!isDocx && file.type && !ALLOWED.has(file.type)) {
      return NextResponse.json({ ok: false, error: "Solo PDF, imagen o Word (.docx)." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: "Archivo demasiado grande (max 10 MB)." }, { status: 400 });

    if (isDocx) {
      // Word: extraer texto (Claude visión no lee .docx) → extracción por texto.
      const buffer = Buffer.from(await file.arrayBuffer());
      const { value: text } = await mammoth.extractRawText({ buffer });
      if (!text || !text.trim()) {
        return NextResponse.json({ ok: false, error: "No se pudo leer texto del Word. Prueba a guardarlo como PDF." }, { status: 400 });
      }
      const data = await extractExpenseFromDocument({ text, fileName: file.name });
      return NextResponse.json({ ok: true, data, duplicateOf: await findDuplicateOf(data) });
    }

    const fileBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const data = await extractExpenseFromDocument({ fileBase64, mimeType: file.type || "application/pdf", fileName: file.name });
    return NextResponse.json({ ok: true, data, duplicateOf: await findDuplicateOf(data) });
  } catch (err: any) {
    console.error("[expenses-extract] error", err);
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo extraer." }, { status: 500 });
  }
}
