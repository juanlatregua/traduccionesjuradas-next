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
import { clientPriceFromCost } from "@/lib/quote-math";
import { AUTO_PRICEABLE_FOREIGN, isAutoPriceable } from "@/lib/pricing-engine/languages";
import { assessAutoPriceRisk } from "@/lib/ai/price-risk";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";

export const runtime = "nodejs";

const WHATSAPP_URL = "https://wa.me/34951333614";

// Idiomas válidos como destino (== claves de PER_WORD_RATE, fuente única).
const KNOWN_LANGUAGES = AUTO_PRICEABLE_FOREIGN;

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

  let body: {
    documents?: DocInput[];
    purpose?: string;
    email?: string;
    phone?: string;
    sessionToken?: string;
    lang?: string;
    deliveryType?: string;
    shipping?: {
      name?: string;
      address?: string;
      city?: string;
      province?: string;
      postalCode?: string;
      country?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  // Idioma del cliente capturado en la puerta (es|fr). Persiste en la sesión
  // para que checkout/confirmación, SMS y email salgan en su idioma.
  const clientLocale = body.lang === "fr" ? "fr" : "es";

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

    // GATE DURO: idioma fuera del set auto-tarificable (p.ej. ruso, ucraniano)
    // NO crea OrderSession ni llega a Stripe. Defensa en profundidad: aunque el
    // diagnóstico/frontend fallen, ningún idioma no soportado se cobra.
    // Incidente TJ-20260602-NJ42 (ruso malclasificado "uk", cobrado 50,82€).
    if (!isAutoPriceable(foreignLang)) {
      return NextResponse.json(
        {
          ok: false,
          unsupported: true,
          error:
            "Por ahora no ofrecemos traducción jurada automática en este idioma. Escríbenos por WhatsApp y te preparamos un presupuesto a medida.",
          whatsappUrl: WHATSAPP_URL,
        },
        { status: 422 }
      );
    }

    // GATE DURO de autotarificación por DOCUMENTO (incidente 1099-MISC): los
    // formularios fiscales/financieros, multi-copia o con texto pegado
    // infracuentan palabras → infracobro. No llegan a Stripe; presupuesto manual.
    // Se confía en price_risk persistido y se re-evalúa por si el análisis es viejo.
    if (analysis.price_risk?.risky || assessAutoPriceRisk({ analysis, fileName: rec.fileName }).risky) {
      return NextResponse.json(
        {
          ok: false,
          unsupported: true,
          error:
            "Este documento necesita un presupuesto a medida (formularios fiscales/financieros o con varias copias). Escríbenos por WhatsApp y te lo preparamos al momento.",
          whatsappUrl: WHATSAPP_URL,
        },
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
          : Math.round(clientPriceFromCost(quote.basePrice, foreignLang) * 100);
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
    clientLocale,
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

  // Entrega en papel (+12 € + IVA): exige dirección de envío. Se persiste en la
  // sesión; computeSessionPricing suma el recargo y createOrderFromSession crea
  // el ShippingData al formalizar el pedido.
  const wantsPaper = String(body.deliveryType || "").toLowerCase() === "paper";
  if (wantsPaper) {
    const s = body.shipping || {};
    const name = String(s.name || "").trim();
    const address = String(s.address || "").trim();
    const city = String(s.city || "").trim();
    const province = String(s.province || "").trim();
    const postalCode = String(s.postalCode || "").trim();
    if (!name || !address || !city || !province || !/^\d{4,10}$/.test(postalCode)) {
      return NextResponse.json(
        { ok: false, error: "Para el envío en papel necesitamos nombre, dirección, ciudad, provincia y código postal." },
        { status: 422 }
      );
    }
    await prisma.orderSession.update({
      where: { id: session.id },
      data: {
        deliveryType: "paper",
        shippingJson: {
          name,
          phone,
          address,
          city,
          province,
          postalCode,
          country: String(s.country || "España").trim() || "España",
        },
      },
    });
  }

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
