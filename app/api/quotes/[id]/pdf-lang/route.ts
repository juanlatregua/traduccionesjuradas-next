import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { QUOTE_PDF_LANGS } from "@/lib/quote-pdf-langs";

export const runtime = "nodejs";

type Params = { params: { id: string } };

// Idioma del PDF del presupuesto (petición Juan 21-ago-2026). Cambio pequeño y
// aislado: no pasa por el PATCH completo (líneas, cliente…) para poder tocarlo
// desde la ficha sin reenviar todo. El PDF se regenera al previsualizar,
// confirmar, reenviar o mandar el recibo.
export async function POST(req: Request, { params }: Params) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { lang?: string } | null;
  const lang = String(body?.lang || "").trim().toLowerCase();
  if (!(QUOTE_PDF_LANGS as readonly string[]).includes(lang)) {
    return NextResponse.json({ ok: false, error: "Idioma no soportado." }, { status: 400 });
  }
  const quote = await prisma.quote.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!quote) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }
  await prisma.quote.update({ where: { id: params.id }, data: { pdfLang: lang } });
  return NextResponse.json({ ok: true, pdfLang: lang });
}
