// app/api/presupuesto/route.ts
import { NextResponse } from "next/server";
import {
  sendPresupuestoEmail,
  sendPresupuestoConfirmationEmail,
} from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logPresupuesto } from "./logger";

export const runtime = "nodejs"; // importante para libs Node en Vercel

const MAX_FILES = 6;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB por archivo (ajústalo)

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit({
    key: `presupuesto:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Intentalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

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

    if (!data.email) {
      logPresupuesto({
        status: "error",
        error: "Falta el email",
        hasAttachments: false,
        route: "api/presupuesto",
        userEmail: data.email,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ ok: false, error: "Falta el email." }, { status: 400 });
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

    const skipSend = process.env.SENDGRID_SKIP_DEV === "true";

    if (skipSend) {
      console.warn("[/api/presupuesto] Envío de email omitido por SENDGRID_SKIP_DEV=true");
      logPresupuesto({
        status: "ok",
        hasAttachments: files.length > 0,
        route: "api/presupuesto",
        userEmail: data.email,
        toInternal: process.env.PRESUPUESTO_TO,
        timestamp: new Date().toISOString(),
        error: "SKIP_DEV",
      });
      return NextResponse.json({ ok: true });
    }

    if (missingEnv && process.env.NODE_ENV !== "production") {
      console.warn("[/api/presupuesto] Envío omitido: faltan env SENDGRID_* / PRESUPUESTO_TO");
      logPresupuesto({
        status: "error",
        error: "Faltan env SENDGRID",
        hasAttachments: files.length > 0,
        route: "api/presupuesto",
        userEmail: data.email,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json({ ok: false, error: "Faltan variables de email" }, { status: 500 });
    }

    // Primero email interno; si falla, lanzamos.
    await sendPresupuestoEmail(data, files);
    // Luego confirmación al cliente; si falla, registramos pero no rompemos al usuario.
    try {
      await sendPresupuestoConfirmationEmail(data);
    } catch (err: any) {
      console.error("[/api/presupuesto] Error al enviar confirmación:", err);
      logPresupuesto({
        status: "error",
        error: (err as any)?.message || "Error confirmación cliente",
        hasAttachments: files.length > 0,
        route: "api/presupuesto",
        userEmail: data.email,
        toInternal: process.env.PRESUPUESTO_TO,
        toClient: data.email,
        timestamp: new Date().toISOString(),
      });
    }

    logPresupuesto({
      status: "ok",
      hasAttachments: files.length > 0,
      route: "api/presupuesto",
      userEmail: data.email,
      toInternal: process.env.PRESUPUESTO_TO,
      toClient: data.email,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[API /presupuesto] Error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
