import { NextResponse } from "next/server";
import { sendPresupuestoEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const data = {
      nombre: String(formData.get("nombre") || ""),
      email: String(formData.get("email") || ""),
      telefono: String(formData.get("telefono") || ""),
      idiomaOrigen: String(formData.get("idiomaOrigen") || ""),
      idiomaDestino: String(formData.get("idiomaDestino") || ""),
      tipoDocumento: String(formData.get("tipoDocumento") || ""),
      plazo: String(formData.get("plazo") || ""),
      website: String(formData.get("website") || ""),
    };

    // Honeypot
    if (data.website) return NextResponse.json({ ok: true });

    if (!data.nombre || !data.email || !data.tipoDocumento) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    const files = formData.getAll("files") as File[];
    const mappedFiles = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        type: file.type || "application/octet-stream",
        buffer: await file.arrayBuffer(),
      }))
    );

    await sendPresupuestoEmail(data, mappedFiles);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Error enviando presupuesto:", err);
    return NextResponse.json(
      { ok: false, error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}
