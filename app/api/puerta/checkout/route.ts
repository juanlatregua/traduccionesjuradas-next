// app/api/puerta/checkout/route.ts — Puente de datos de la puerta (v2 · Fase 1
// · Bloque 1.3). Desde los DocumentAnalysis de la puerta crea una OrderSession
// + OrderDocument checkout-ready y deja la sesión en step=CHECKOUT.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { createSessionRecord, attachSessionCookie } from "@/lib/session";
import {
  computeSessionPricing,
  PURPOSE_REGULARIZACION_2026,
} from "@/lib/session-pricing";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";

export const runtime = "nodejs";

// Idiomas válidos como destino (mismo conjunto que el pricing-engine).
const KNOWN_LANGUAGES = new Set([
  "fr", "en", "de", "nl", "it", "pt", "ca", "sv", "no", "ar", "ro",
]);

// Precio de campaña del arraigo extraordinario: 25 € pre-IVA por documento,
// solo para documentos en francés dentro de una sesión de regularización 2026.
const REGULARIZACION_FR_DOC_CENTS = 2500;

type DocInput = { id: string; targetLanguage?: string };

// El lado no-español del par. null = original ES con destino sin determinar.
function resolveForeignLang(language: DocumentAnalysisResult["language"]): string | null {
  if (language.source && language.source !== "es") return language.source;
  if (language.target && language.target !== "es" && language.target !== "unknown") {
    return language.target;
  }
  return null;
}

function blobKeyFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/+/, "");
  } catch {
    return url;
  }
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `puerta-checkout:${ip}`,
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Inténtalo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { documents?: DocInput[]; purpose?: string; email?: string; phone?: string; sessionToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const inputs = Array.isArray(body.documents) ? body.documents : [];
  if (inputs.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No hay documentos para el pedido." },
      { status: 400 }
    );
  }

  // Ownership: solo se pueden llevar a checkout los documentos subidos en esta
  // misma sesión (sessionToken, UUID no enumerable que register devolvió). Sin
  // esto un atacante podría adjuntar análisis ajenos a su pedido (fuga del
  // fileUrl del documento del otro cliente) y pisar su email/teléfono de lead.
  const sessionToken = (body.sessionToken || "").trim();
  if (!sessionToken) {
    return NextResponse.json(
      { ok: false, error: "Sesión no válida. Vuelve a empezar." },
      { status: 422 }
    );
  }

  // Contacto obligatorio: lo necesitamos para email + SMS/WhatsApp del pedido.
  const email = (body.email || "").trim().toLowerCase();
  const phone = (body.phone || "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Indica un email válido." },
      { status: 422 }
    );
  }
  if (phone.replace(/\D/g, "").length < 7) {
    return NextResponse.json(
      { ok: false, error: "Indica un teléfono válido." },
      { status: 422 }
    );
  }

  const purpose =
    body.purpose === PURPOSE_REGULARIZACION_2026 ? PURPOSE_REGULARIZACION_2026 : null;

  // Cargar los análisis y validarlos (scoped al sessionToken de quien sube).
  const ids = inputs.map((d) => d.id);
  const records = await prisma.documentAnalysis.findMany({
    where: { id: { in: ids }, sessionToken },
  });
  if (records.length !== ids.length) {
    return NextResponse.json(
      { ok: false, error: "Algún documento ya no está disponible. Vuelve a empezar." },
      { status: 404 }
    );
  }

  // Recalcular el precio server-side con el pricing-engine (fuente de verdad).
  const prepared: Array<{
    rec: (typeof records)[number];
    analysis: DocumentAnalysisResult;
    quotedCents: number;
  }> = [];

  for (const input of inputs) {
    const rec = records.find((r) => r.id === input.id)!;
    if (!rec.analysisJson) {
      return NextResponse.json(
        { ok: false, error: "Hay un documento sin analizar. Vuelve a empezar." },
        { status: 422 }
      );
    }

    let analysis = rec.analysisJson as unknown as DocumentAnalysisResult;

    // El cliente pudo elegir el idioma de destino en la puerta (original ES).
    if (
      input.targetLanguage &&
      KNOWN_LANGUAGES.has(input.targetLanguage) &&
      analysis.language.source === "es"
    ) {
      analysis = {
        ...analysis,
        language: { ...analysis.language, target: input.targetLanguage },
      };
    }

    const foreignLang = resolveForeignLang(analysis.language);
    if (!foreignLang) {
      return NextResponse.json(
        { ok: false, error: "Indica el idioma de destino de cada documento." },
        { status: 422 }
      );
    }

    // El penal francés con anexo UE (Bulletin n°3, ~5 páginas) tiene precio
    // fijo propio en el pricing-engine (61,98 € → 75 € c/IVA): el anexo
    // multilingüe es trabajo real que el plano de campaña no cubre. Mismo
    // criterio que lib/pricing-engine/calculator.ts (isFrenchCriminalRecord).
    const isFrenchCriminalRecord =
      analysis.document_type.specific_type === "criminal_record" &&
      foreignLang === "fr" &&
      (analysis.document_metrics?.pages ?? 0) >= 3;

    let quotedCents: number;
    try {
      const quote = calculatePrice(analysis);
      quotedCents =
        purpose === PURPOSE_REGULARIZACION_2026 &&
        foreignLang === "fr" &&
        !isFrenchCriminalRecord
          ? REGULARIZACION_FR_DOC_CENTS
          : Math.round(quote.basePrice * 100);
    } catch (err: any) {
      console.error("[puerta/checkout] calculatePrice:", err?.message);
      return NextResponse.json(
        { ok: false, error: "No se pudo calcular el precio. Vuelve a empezar." },
        { status: 422 }
      );
    }

    prepared.push({ rec, analysis, quotedCents });
  }

  // Crear la sesión y sus documentos.
  const session = await createSessionRecord({
    purpose,
    step: "UPLOAD",
    clientEmail: email,
    clientPhone: phone,
  });

  // Reflejar el contacto en los DocumentAnalysis (alimenta el stage "lead"
  // de /admin/funnel) y estampar la referencia de la sesión: cuando el pago
  // cree el Order (reference == session.reference), createOrderFromSession
  // fijará orderId en estos análisis y cerrará el funnel (pedido/pagado).
  await prisma.documentAnalysis.updateMany({
    where: { id: { in: ids } },
    data: {
      clientEmail: email,
      clientPhone: phone,
      orderReference: session.reference,
    },
  });

  await prisma.orderDocument.createMany({
    data: prepared.map(({ rec, analysis, quotedCents }) => ({
      sessionId: session.id,
      fileKey: blobKeyFromUrl(rec.fileUrl),
      fileUrl: rec.fileUrl,
      filename: rec.fileName,
      mimeType: rec.mimeType,
      sizeBytes: rec.fileSize,
      detectedType: rec.documentType,
      sourceLang: analysis.language.source,
      targetLang: analysis.language.target,
      quotedCents,
    })),
  });

  const pricing = await computeSessionPricing(session.id);
  await prisma.orderSession.update({
    where: { id: session.id },
    data: {
      step: "CHECKOUT",
      subtotalCents: pricing.subtotalCents,
      vatCents: pricing.vatCents,
      totalCents: pricing.totalCents,
      currency: pricing.currency,
    },
  });

  const response = NextResponse.json({ ok: true, reference: session.reference });
  attachSessionCookie(response, session.id);
  return response;
}
