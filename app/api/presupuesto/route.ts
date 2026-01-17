// app/api/presupuesto/route.ts
import { NextResponse } from "next/server";
import { sendPresupuestoEmail } from "@/lib/email";

export const runtime = "nodejs"; // importante para libs Node en Vercel

const MAX_FILES = 6;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB por archivo (ajústalo)

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const data: any = {
      nombre: String(formData.get("nombre") || ""),
      email: String(formData.get("email") || ""),
      telefono: String(formData.get("telefono") || ""),
      idiomaOrigen: String(formData.get("idiomaOrigen") || ""),
      idiomaDestino: String(formData.get("idiomaDestino") || ""),
      tipoDocumento: String(formData.get("tipoDocumento") || ""),
      plazo: String(formData.get("plazo") || ""),
      aceptaPrivacidad: String(formData.get("aceptaPrivacidad") || ""),
      website: String(formData.get("website") || ""), // honeypot
    };

    // Honeypot (si bots lo rellenan, cortamos)
    if (data.website) {
      return NextResponse.json({ ok: true }); // silencioso
    }

    if (!data.email || !data.nombre) {
      return NextResponse.json(
        { ok: false, error: "Faltan campos obligatorios." },
        { status: 400 }
      );
    }

    const filesRaw = formData.getAll("files");
    const fileBlobs = filesRaw.filter((x): x is File => x instanceof File);

    if (fileBlobs.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Adjunta al menos un archivo (PDF o foto)." },
        { status: 400 }
      );
    }

    if (fileBlobs.length > MAX_FILES) {
      return NextResponse.json(
        { ok: false, error: `Máximo ${MAX_FILES} archivos.` },
        { status: 400 }
      );
    }

    const files = await Promise.all(
      fileBlobs.map(async (f) => {
        if (f.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`Archivo demasiado grande: ${f.name}`);
        }
        const ab = await f.arrayBuffer();
        const contentBase64 = Buffer.from(ab).toString("base64");

        return {
          name: f.name,
          type: f.type || "application/octet-stream",
          size: f.size,
          contentBase64,
        };
      })
    );

    await sendPresupuestoEmail(data, files);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /presupuesto] Error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
