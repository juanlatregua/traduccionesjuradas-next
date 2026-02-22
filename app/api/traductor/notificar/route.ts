import { NextResponse } from "next/server";
import { sendTranslationReadyEmail } from "@/lib/email";
import { requireStaffAccess } from "@/lib/staff-auth";

type NotifyBody = {
  reference?: string;
  clientEmail?: string;
  downloadUrl?: string;
};

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  try {
    const body = (await req.json()) as NotifyBody;
    const reference = (body.reference || "").trim();
    const clientEmail = (body.clientEmail || "").trim();
    const downloadUrl = (body.downloadUrl || "").trim();

    if (!reference || !clientEmail || !downloadUrl) {
      return NextResponse.json(
        { ok: false, error: "Faltan referencia, email de cliente o enlace de descarga." },
        { status: 400 }
      );
    }

    await sendTranslationReadyEmail({
      toEmail: clientEmail,
      reference,
      downloadUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "No se pudo enviar la notificacion." },
      { status: 500 }
    );
  }
}
