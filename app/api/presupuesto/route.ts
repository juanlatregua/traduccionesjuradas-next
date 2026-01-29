// app/api/presupuesto/route.ts
import { NextResponse } from "next/server";
import {
  sendPresupuestoEmail,
  sendPresupuestoConfirmationEmail,
} from "@/lib/email";

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
    // Node 16 en local no expone global File; usamos cualquier Blob con arrayBuffer/size
    const fileBlobs = filesRaw.filter((x) => {
      if (!x) return false;
      const anyX = x as any;
      return typeof anyX.arrayBuffer === "function" && typeof anyX.size === "number";
    }) as (Blob & { name?: string; type?: string; size: number })[];

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
        const fileName = (f as any).name || "archivo";
        const fileType = (f as any).type || "application/octet-stream";
        const fileSize = (f as any).size || 0;

        if (fileSize > MAX_FILE_SIZE_BYTES) {
          throw new Error(`Archivo demasiado grande: ${fileName}`);
        }

        const ab = await f.arrayBuffer();
        const contentBase64 = Buffer.from(ab).toString("base64");

        return {
          name: fileName,
          type: fileType,
          size: fileSize,
          contentBase64,
        };
      })
    );

    const missingEnv =
      !process.env.SENDGRID_API_KEY ||
      !process.env.SENDGRID_FROM ||
      !process.env.PRESUPUESTO_TO;

    if (missingEnv && process.env.NODE_ENV !== "production") {
      console.warn(
        "[/api/presupuesto] Envío de email omitido en dev: faltan env SENDGRID_* / PRESUPUESTO_TO"
      );
    } else {
      // Primero email interno; si falla, lanzamos.
      await sendPresupuestoEmail(data, files);
      // Luego confirmación al cliente; si falla, registramos pero no rompemos al usuario.
      try {
        await sendPresupuestoConfirmationEmail(data);
      } catch (err) {
        console.error("[/api/presupuesto] Error al enviar confirmación:", err);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /presupuesto] Error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
