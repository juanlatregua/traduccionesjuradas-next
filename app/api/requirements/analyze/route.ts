// app/api/requirements/analyze/route.ts — Lector de requerimientos (IA)
//
// Espejo de /api/documents/analyze pero para PETICIONES oficiales. v1: solo
// modo archivo (el cliente ya subió vía /api/documents/upload + register y
// tiene {documentId, sessionToken}). Cap propio (50/día) aislado del
// diagnóstico de pago. NO devuelve precio.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, checkRequirementsCap } from "@/lib/rate-limit";
import { analyzeRequirement } from "@/lib/ai/requirements";
import type { RequirementsExtraction } from "@/lib/ai/requirements";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildManualQuoteWhatsAppLink } from "@/lib/contact";

export const runtime = "nodejs";
export const maxDuration = 120;

const WHATSAPP_URL = buildManualQuoteWhatsAppLink({
  reason: "manual",
  note: "Lector de requerimientos",
});
const VALID_LANGS = new Set(["es", "fr", "en", "de", "pt"]);

export async function POST(req: Request) {
  const ip = getClientIp(req);

  const staff = await requireStaffAccess(req);
  const isStaff = staff.ok;

  if (!isStaff) {
    // Cap diario PROPIO del lector. Si se llena → estado degradado (no error
    // seco): la UI ofrece contacto humano y el límite se vuelve captación.
    const capOk = await checkRequirementsCap();
    if (!capOk) {
      return NextResponse.json(
        {
          ok: false,
          capReached: true,
          error:
            "Ahora mismo hay mucha demanda en el lector. Súbenos tu carta y te respondemos por WhatsApp o email en breve.",
          whatsappUrl: WHATSAPP_URL,
        },
        { status: 429 }
      );
    }

    const rl = await checkRateLimit({
      key: `req-analyze:${ip}`,
      limit: 15,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Has superado el límite diario. Inténtalo mañana o escríbenos por WhatsApp.",
          whatsappUrl: WHATSAPP_URL,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }
  }

  try {
    const body = await req.json();
    const { documentId, sessionToken } = body;
    const lang = VALID_LANGS.has(body?.lang) ? body.lang : "es";

    if (!documentId) {
      return NextResponse.json({ ok: false, error: "documentId requerido." }, { status: 400 });
    }

    const doc = await prisma.documentAnalysis.findUnique({ where: { id: documentId } });
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
    }

    // Ownership: solo accesible para quien lo subió (sessionToken no enumerable).
    if (!isStaff && (!sessionToken || doc.sessionToken !== sessionToken)) {
      return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
    }

    // Cache: si ya se analizó como requerimiento, devuelve el JSON guardado.
    if (doc.status === "ANALYZED" && doc.documentType === "official_requirement" && doc.analysisJson) {
      return NextResponse.json({
        ok: true,
        requirements: doc.analysisJson,
        sessionToken: doc.sessionToken,
        documentId: doc.id,
        cached: true,
      });
    }

    await prisma.documentAnalysis.update({
      where: { id: documentId },
      data: { status: "ANALYZING" },
    });

    const fileResponse = await fetch(doc.fileUrl);
    if (!fileResponse.ok) {
      await prisma.documentAnalysis.update({
        where: { id: documentId },
        data: { status: "ANALYSIS_FAILED" },
      });
      return NextResponse.json(
        { ok: false, error: "No se pudo acceder al archivo. Vuelve a subirlo." },
        { status: 422 }
      );
    }
    const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());

    let requirements: RequirementsExtraction;
    try {
      requirements = await Promise.race([
        analyzeRequirement({
          buffer: fileBuffer,
          mimeType: doc.mimeType,
          fileName: doc.fileName,
          lang,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT: análisis excedió 115s")), 115000)
        ),
      ]);
    } catch (err: any) {
      const detail = err.status
        ? `API ${err.status}: ${err.error?.error?.message || err.message}`
        : err.message;
      console.error("[requirements/analyze] Claude error:", detail, "| mime:", doc.mimeType);
      await prisma.documentAnalysis.update({
        where: { id: documentId },
        data: { status: "ANALYSIS_FAILED" },
      });
      return NextResponse.json(
        {
          ok: false,
          error:
            "No hemos podido leer tu carta. Puedes escribirnos por WhatsApp y la revisamos a mano.",
          whatsappUrl: WHATSAPP_URL,
          _debug: detail,
        },
        { status: 422 }
      );
    }

    // Persistencia: reutiliza DocumentAnalysis, discrimina por documentType.
    // El prompt ya censura PII en origen (no se transcriben nombres). NO se
    // toca `source` (atribución de captación del funnel).
    await prisma.documentAnalysis.update({
      where: { id: documentId },
      data: {
        status: "ANALYZED",
        analysisJson: requirements as any,
        documentType: "official_requirement",
        countryOrigin: requirements.procedure?.country || null,
      },
    });

    return NextResponse.json({
      ok: true,
      requirements,
      sessionToken: doc.sessionToken,
      documentId: doc.id,
      cached: false,
    });
  } catch (err: any) {
    console.error("[requirements/analyze]", err);
    return NextResponse.json(
      { ok: false, error: "Error interno al leer el requerimiento." },
      { status: 500 }
    );
  }
}
