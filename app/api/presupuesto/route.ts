// app/api/presupuesto/route.ts
import { NextResponse } from "next/server";
import {
  sendPresupuestoEmail,
  sendPresupuestoConfirmationEmail,
} from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logPresupuesto } from "./logger";

export const runtime = "nodejs";

export type PresupuestoPayload = {
  documentos: Array<{
    tipo: string;
    tipoLabel: string;
    combinacion: string;
    palabras: number;
    precioEstimado: number;
  }>;
  contacto: {
    email: string;
    telefono?: string;
    fechaLimite?: string;
    notas?: string;
  };
  metadata: {
    idioma: string;
    paginaOrigen: string;
    timestamp: string;
  };
  website?: string; // honeypot
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `presupuesto:${ip}`,
    limit: 12,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Inténtalo de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json()) as PresupuestoPayload;

    // Honeypot
    if (body.website) {
      return NextResponse.json({ ok: true });
    }

    const email = body.contacto?.email?.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Falta un email válido." },
        { status: 400 }
      );
    }

    if (!body.documentos || body.documentos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Añade al menos un documento al presupuesto." },
        { status: 400 }
      );
    }

    if (body.documentos.length > 20) {
      return NextResponse.json(
        { ok: false, error: "Máximo 20 documentos por solicitud." },
        { status: 400 }
      );
    }

    const referencia = `TJ-${String(Date.now()).slice(-6)}`;

    const payload = { ...body, contacto: { ...body.contacto, email }, referencia };

    const skipSend = process.env.SENDGRID_SKIP_DEV === "true";
    const missingEnv =
      !process.env.SENDGRID_API_KEY ||
      !process.env.SENDGRID_FROM ||
      !process.env.PRESUPUESTO_TO;

    if (skipSend) {
      console.warn("[/api/presupuesto] Envío de email omitido por SENDGRID_SKIP_DEV=true");
      logPresupuesto({
        status: "ok",
        referencia,
        route: "api/presupuesto",
        userEmail: email,
        timestamp: new Date().toISOString(),
        error: "SKIP_DEV",
      });
      return NextResponse.json({
        ok: true,
        mensaje: "Solicitud recibida. Te responderemos en menos de 2 horas laborables.",
        referencia,
      });
    }

    if (missingEnv && process.env.NODE_ENV !== "production") {
      console.warn("[/api/presupuesto] Envío omitido: faltan env SENDGRID_* / PRESUPUESTO_TO");
      logPresupuesto({
        status: "error",
        error: "Faltan env SENDGRID",
        referencia,
        route: "api/presupuesto",
        userEmail: email,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        { ok: false, error: "Faltan variables de email" },
        { status: 500 }
      );
    }

    // Email interno
    await sendPresupuestoEmail(payload);

    // Confirmación al cliente (no bloqueante)
    try {
      await sendPresupuestoConfirmationEmail(payload);
    } catch (err: any) {
      console.error("[/api/presupuesto] Error al enviar confirmación:", err);
      logPresupuesto({
        status: "error",
        error: err?.message || "Error confirmación cliente",
        referencia,
        route: "api/presupuesto",
        userEmail: email,
        toInternal: process.env.PRESUPUESTO_TO,
        toClient: email,
        timestamp: new Date().toISOString(),
      });
    }

    logPresupuesto({
      status: "ok",
      referencia,
      route: "api/presupuesto",
      userEmail: email,
      toInternal: process.env.PRESUPUESTO_TO,
      toClient: email,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      mensaje: "Solicitud recibida. Te responderemos en menos de 2 horas laborables.",
      referencia,
    });
  } catch (err: any) {
    console.error("[API /presupuesto] Error:", err?.message || err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
