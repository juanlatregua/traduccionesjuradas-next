// app/api/presupuesto/route.ts
import { NextResponse } from "next/server";
import {
  sendPresupuestoEmail,
  sendPresupuestoConfirmationEmail,
} from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { logPresupuesto } from "./logger";
import { createOrder } from "@/lib/orders";
import { prisma } from "@/lib/prisma";
import { transitionWorkflowState } from "@/lib/workflow-server";
import { put } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/payment-config";

export const runtime = "nodejs"; // importante para libs Node en Vercel

const MAX_FILES = 6;
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB por archivo (ajústalo)
const INTERNAL_PLACEHOLDER_AMOUNT_CENTS = 100; // 1 EUR temporal hasta revision interna

const LANGUAGE_CODE_MAP: Record<string, string> = {
  espanol: "es",
  espanolcastellano: "es",
  castellano: "es",
  ingles: "en",
  frances: "fr",
  aleman: "de",
  italiano: "it",
  portugues: "pt",
  catalan: "ca",
  neerlandes: "nl",
  noruego: "no",
  sueco: "sv",
};

function normalizeToken(raw?: string | null) {
  if (!raw) return "";
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function toLanguageCode(value?: string | null) {
  const normalized = normalizeToken(value);
  return LANGUAGE_CODE_MAP[normalized] || null;
}

function buildLangPair(origen?: string | null, destino?: string | null) {
  const from = toLanguageCode(origen);
  const to = toLanguageCode(destino);
  if (from && to) return `${from}-${to}`;
  return null;
}

function buildOrderTitle(tipoDocumento: string) {
  const clean = tipoDocumento.trim().replace(/\s+/g, " ");
  if (!clean) return "Solicitud web de traduccion jurada";
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

function toSafeFileName(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return normalized || "archivo";
}

function inferPresupuestoSource(req: Request) {
  const refererRaw = req.headers.get("referer");
  let sourceRaw: string | null = null;
  let campaign: string | null = null;
  let medium: string | null = null;
  let landing: string | null = null;

  if (refererRaw) {
    try {
      const refererUrl = new URL(refererRaw);
      sourceRaw =
        refererUrl.searchParams.get("src") ||
        refererUrl.searchParams.get("utm_source") ||
        null;
      campaign = refererUrl.searchParams.get("campaign") || refererUrl.searchParams.get("utm_campaign") || null;
      medium = refererUrl.searchParams.get("utm_medium") || null;
      landing = `${refererUrl.pathname}${refererUrl.search}`;
    } catch {
      landing = null;
    }
  }

  const normalizedSource = normalizeToken(sourceRaw);
  const source =
    normalizedSource === "wa" ||
    normalizedSource === "whatsapp" ||
    normalizedSource === "whatsappweb" ||
    normalizedSource === "whatsappapp"
      ? "WHATSAPP"
      : "WEB";

  return {
    source,
    sourceRaw: sourceRaw ? sourceRaw.trim() : null,
    campaign: campaign ? campaign.trim() : null,
    medium: medium ? medium.trim() : null,
    landing,
    referer: refererRaw || null,
    agent: req.headers.get("user-agent") || null,
  };
}

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
        const contentBuffer = Buffer.from(ab);
        const contentBase64 = contentBuffer.toString("base64");

        return {
          name: fileName,
          type: fileType,
          size: fileSize,
          contentBase64,
          contentBuffer,
        };
      })
    );

    if (!isBlobConfigured()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pueden adjuntar archivos en este entorno porque falta BLOB_READ_WRITE_TOKEN.",
        },
        { status: 503 }
      );
    }

    let orderReference: string | null = null;
    try {
      const sourceSnapshot = inferPresupuestoSource(req);
      const langPair = buildLangPair(data.idiomaOrigen, data.idiomaDestino) || undefined;

      const order = await createOrder({
        clientEmail: data.email.trim().toLowerCase(),
        clientName: data.nombre?.trim() || undefined,
        source: "file",
        title: buildOrderTitle(data.tipoDocumento),
        langPair,
        pagesLabel: data.tipoDocumento?.trim() || undefined,
        amountCents: INTERNAL_PLACEHOLDER_AMOUNT_CENTS,
      });
      orderReference = order.reference;

      const uploadedFiles = await Promise.all(
        files.map(async (file, index) => {
          const pathname = `orders/${order.reference}/presupuesto/${Date.now()}-${index + 1}-${toSafeFileName(file.name)}`;
          const blob = await put(pathname, file.contentBuffer, {
            access: "public",
            addRandomSuffix: true,
            contentType: file.type || "application/octet-stream",
          });
          return {
            name: file.name,
            type: file.type,
            size: file.size,
            url: blob.url,
            pathname: blob.pathname,
            uploadedAt: new Date().toISOString(),
          };
        })
      );

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "order.acquisition",
          message: `Origen de captacion: ${sourceSnapshot.source}.`,
          payload: {
            source: sourceSnapshot.source,
            sourceRaw: sourceSnapshot.sourceRaw,
            campaign: sourceSnapshot.campaign,
            medium: sourceSnapshot.medium,
            landing: sourceSnapshot.landing,
            referer: sourceSnapshot.referer,
            agent: sourceSnapshot.agent,
            actorEmail: data.email.trim().toLowerCase(),
          },
        },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "workflow.state_changed",
          message: "Workflow inicial en BORRADOR (solicitud web).",
          payload: {
            from: null,
            to: "BORRADOR",
            actorEmail: data.email.trim().toLowerCase(),
            reason: "presupuesto_submitted",
          },
        },
      });

      await prisma.orderEvent.create({
        data: {
          orderId: order.id,
          type: "presupuesto.submitted",
          message: "Solicitud de presupuesto recibida desde web.",
          payload: {
            nombre: data.nombre || null,
            email: data.email || null,
            telefono: data.telefono || null,
            idiomaOrigen: data.idiomaOrigen || null,
            idiomaDestino: data.idiomaDestino || null,
            tipoDocumento: data.tipoDocumento || null,
            plazo: data.plazo || null,
            aceptaPrivacidad: data.aceptaPrivacidad || null,
            files: uploadedFiles,
          },
        },
      });

      await transitionWorkflowState({
        reference: order.reference,
        to: "PENDIENTE_REVISION",
        actorEmail: data.email.trim().toLowerCase(),
        reason: "Solicitud recibida desde /presupuesto.",
      });
    } catch (err: any) {
      console.error("[/api/presupuesto] No se pudo crear pedido interno", err);
      logPresupuesto({
        status: "error",
        error: `No se pudo crear pedido interno: ${err?.message || "unknown"}`,
        hasAttachments: files.length > 0,
        route: "api/presupuesto",
        userEmail: data.email,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        {
          ok: false,
          error: "No se pudo registrar tu solicitud internamente. Reintenta en unos minutos.",
        },
        { status: 500 }
      );
    }

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
        orderReference,
        toInternal: process.env.PRESUPUESTO_TO,
        timestamp: new Date().toISOString(),
        error: "SKIP_DEV",
      });
      return NextResponse.json({ ok: true, reference: orderReference });
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
        orderReference,
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
      orderReference,
      toInternal: process.env.PRESUPUESTO_TO,
      toClient: data.email,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, reference: orderReference });
  } catch (err: any) {
    console.error("[API /presupuesto] Error:", err?.message || err);
    const msg = String(err?.message || "");
    if (msg.includes("BLOB_READ_WRITE_TOKEN")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No se pudieron guardar los archivos adjuntos. Configura BLOB_READ_WRITE_TOKEN en Vercel.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err?.message || "Error interno del servidor." },
      { status: 500 }
    );
  }
}
