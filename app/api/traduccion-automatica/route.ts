import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { TRANSLATION_DRAFT_SYSTEM_PROMPT } from "@/lib/translation-prompts";
import type { TranslationDraftResult } from "@/lib/translation-prompts";
import { generateDraftDocx } from "@/lib/draft-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

type RequestBody = {
  orderReference: string;
  documentUrl?: string;
  direccion?: "ES→FR" | "FR→ES";
};

function getMediaType(
  mimeType: string
): "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf" {
  const map: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf"> = {
    "image/jpeg": "image/jpeg",
    "image/jpg": "image/jpeg",
    "image/png": "image/png",
    "image/gif": "image/gif",
    "image/webp": "image/webp",
    "application/pdf": "application/pdf",
  };
  return map[mimeType] || "image/jpeg";
}

async function fetchDocumentBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const t0 = Date.now();
  const res = await fetch(url);
  const elapsed = Date.now() - t0;
  if (!res.ok) {
    console.error("[traduccion-automatica] doc fetch failed", {
      status: res.status,
      url: url.slice(0, 120),
      elapsed,
    });
    throw new Error(
      res.status === 403
        ? "URL del documento expirada o sin acceso (403). Reintenta o sube el documento de nuevo."
        : `No se pudo descargar el documento: ${res.status}`
    );
  }
  const contentType = res.headers.get("content-type") || "application/pdf";
  const arrayBuffer = await res.arrayBuffer();
  const sizeKB = Math.round(arrayBuffer.byteLength / 1024);
  console.log("[traduccion-automatica] doc fetched", { sizeKB, elapsed, contentType });
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { base64, mimeType: contentType.split(";")[0].trim() };
}

export async function POST(req: Request) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) {
    return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  }

  const role = getStaffRole(staff.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json(
      { ok: false, error: "Solo ADMIN/PM puede generar borradores IA." },
      { status: 403 }
    );
  }

  const clientIp = getClientIp(req);
  const rl = await checkRateLimit({
    key: `${clientIp}:traduccion-automatica`,
    limit: 20,
    windowMs: 60 * 60 * 1000, // 20 req/hour
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiadas solicitudes. Inténtalo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { orderReference, documentUrl } = body;

    if (!orderReference) {
      return NextResponse.json({ ok: false, error: "Falta orderReference." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { reference: orderReference },
      select: {
        id: true,
        reference: true,
        title: true,
        langPair: true,
        events: {
          where: { type: { in: ["presupuesto.submitted", "order.source_document_uploaded"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { type: true, payload: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
    }

    // Determine document URL
    let docUrl = documentUrl;
    if (!docUrl) {
      // Find from order events
      for (const evt of order.events) {
        const payload = evt.payload as any;
        if (evt.type === "order.source_document_uploaded" && payload?.fileUrl) {
          docUrl = String(payload.fileUrl);
          break;
        }
        if (evt.type === "presupuesto.submitted" && Array.isArray(payload?.files)) {
          const firstFile = payload.files[0];
          if (firstFile?.url) {
            docUrl = String(firstFile.url);
            break;
          }
        }
      }
    }

    if (!docUrl) {
      return NextResponse.json(
        { ok: false, error: "No hay documento fuente para este pedido." },
        { status: 400 }
      );
    }

    // Detect direction from langPair
    const direccion: "ES→FR" | "FR→ES" = body.direccion ||
      (order.langPair?.toLowerCase().startsWith("fr") ? "FR→ES" : "ES→FR");

    // Fetch document
    const { base64: fileBase64, mimeType } = await fetchDocumentBase64(docUrl);
    const mediaType = getMediaType(mimeType);

    // Build Claude content
    const contentBlocks: Anthropic.ContentBlockParam[] = [];
    if (mediaType === "application/pdf") {
      contentBlocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
      });
    } else {
      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: fileBase64,
        },
      });
    }

    contentBlocks.push({
      type: "text",
      text: `Traduce este documento del ${direccion === "ES→FR" ? "español al francés" : "francés al español"}. Dirección: ${direccion}. Devuelve SOLO el JSON.`,
    });

    // Call Claude
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY no configurada." }, { status: 503 });
    }

    const client = new Anthropic({ apiKey });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);

    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: TRANSLATION_DRAFT_SYSTEM_PROMPT,
          messages: [{ role: "user", content: contentBlocks }],
        },
        { signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ ok: false, error: "Claude no devolvió texto." }, { status: 500 });
    }

    let jsonStr = textBlock.text.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();

    let parsed: TranslationDraftResult;
    try {
      parsed = JSON.parse(jsonStr) as TranslationDraftResult;
    } catch {
      console.error("[traduccion-automatica] JSON parse failed", jsonStr.slice(0, 500));
      return NextResponse.json(
        { ok: false, error: "La respuesta de IA no es JSON válido." },
        { status: 500 }
      );
    }

    // Generate DOCX
    const docxBuffer = await generateDraftDocx(parsed, direccion);
    const filename = `borrador-${order.reference}-${Date.now()}.docx`;

    // Upload to Vercel Blob
    const blob = await put(`drafts/${filename}`, docxBuffer, {
      access: "public",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // Update order with draft info
    await prisma.order.update({
      where: { reference: order.reference },
      data: {
        draftFileKey: blob.pathname,
        draftFileUrl: blob.url,
        draftGeneratedAt: new Date(),
        draftFilename: filename,
        draftContentJson: JSON.stringify(parsed),
      },
    });

    // Create order event
    await prisma.orderEvent.create({
      data: {
        orderId: order.id,
        type: "draft.generated",
        message: `Borrador IA generado (${direccion}): ${filename}`,
        payload: {
          actorEmail: staff.email,
          direccion,
          draftFileUrl: blob.url,
          draftFilename: filename,
          notasRevisor: parsed.notas_revisor,
        },
      },
    });

    console.log("[traduccion-automatica] draft generated", {
      reference: order.reference,
      actorEmail: staff.email,
      filename,
    });

    return NextResponse.json({
      ok: true,
      draftFileUrl: blob.url,
      draftFilename: filename,
      notas_revisor: parsed.notas_revisor || [],
    });
  } catch (err: any) {
    if (err.name === "AbortError") {
      return NextResponse.json(
        { ok: false, error: "Tiempo de espera agotado (55s). Intenta con un documento más pequeño." },
        { status: 504 }
      );
    }
    console.error("[traduccion-automatica] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Error al generar borrador." },
      { status: 500 }
    );
  }
}
