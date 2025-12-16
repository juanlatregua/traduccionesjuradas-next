import { NextResponse } from "next/server";
import { sendPresupuestoEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.email || !data.nombre) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    await sendPresupuestoEmail(data);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error enviando email:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
