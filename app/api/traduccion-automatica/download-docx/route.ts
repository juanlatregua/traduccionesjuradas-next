import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { generateDraftDocx } from "@/lib/draft-docx";
import type { TranslationDraftResult } from "@/lib/translation-prompts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body?.content || !body?.orderReference) {
      return NextResponse.json(
        { ok: false, error: "content y orderReference requeridos." },
        { status: 400 }
      );
    }

    const parsed = body.content as TranslationDraftResult;
    const direccion: "ES→FR" | "FR→ES" = body.direccion || "ES→FR";

    const docxBuffer = await generateDraftDocx(parsed, direccion);
    const filename = `BORRADOR_${body.orderReference}_JUR.docx`;

    return new Response(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error("[download-docx] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al generar DOCX." },
      { status: 500 }
    );
  }
}
