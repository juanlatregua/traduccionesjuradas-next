// app/api/documents/analyze/route.ts — Análisis IA de documentos

import { NextResponse } from "next/server";
import { applyDeclaredLanguages } from "@/lib/puerta-languages";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, checkGlobalAnalysisCap } from "@/lib/rate-limit";
import { censorExtractedNames } from "@/lib/ai/analyze-document";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import { runDocumentAnalysis } from "@/lib/ai/run-analysis";
import { requireStaffAccess } from "@/lib/staff-auth";
import { calculatePrice, VAT_RATE } from "@/lib/pricing-engine/calculator";
import { buildDiagnosis, resolveForeignLang } from "@/lib/diagnosis";
import { clientPriceFromCost } from "@/lib/quote-math";
import { sendQuoteFollowupEmail } from "@/lib/emails/quote-followup";
import { alertStaffAiOutage, alertStaffAnalysisFailure, isAiAccountError } from "@/lib/ai/outage-alert";

export const runtime = "nodejs";
export const maxDuration = 120; // Allow up to 120s for IA analysis (PDFs pesados)

export async function POST(req: Request) {
  const ip = getClientIp(req);

  // El staff autenticado (zona-traductor / admin) procesa expedientes enteros
  // (p.ej. 16 docs de una vez), así que queda exento de los topes pensados
  // para tráfico público anónimo. Ver /api/zona-traductor/expediente/analyze.
  const staff = await requireStaffAccess(req);
  const isStaff = staff.ok;

  if (!isStaff) {
    // Global daily cap: max 200 analyses/day across all users
    const globalCapOk = await checkGlobalAnalysisCap();
    if (!globalCapOk) {
      return NextResponse.json(
        { ok: false, error: "Servicio temporalmente no disponible. Inténtalo en unos minutos." },
        { status: 429 }
      );
    }

    // Rate limit: 15 análisis por IP por día
    const rl = await checkRateLimit({
      key: `doc-analyze:${ip}`,
      limit: 15,
      windowMs: 24 * 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { ok: false, error: "Has superado el límite diario de análisis. Inténtalo mañana." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }
  }

  try {
    const body = await req.json();
    const { documentId, sessionToken } = body;

    if (!documentId) {
      return NextResponse.json({ ok: false, error: "documentId requerido." }, { status: 400 });
    }

    // Fetch document record
    const doc = await prisma.documentAnalysis.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
    }

    // Ownership: el documento solo es accesible para quien lo subió (su
    // sessionToken, UUID no enumerable que register devolvió al cliente). El
    // staff autenticado queda exento (procesa expedientes ajenos). Sin esto,
    // cualquiera con un documentId leería el análisis (nombres/fechas) de otro.
    if (!isStaff && (!sessionToken || doc.sessionToken !== sessionToken)) {
      return NextResponse.json({ ok: false, error: "Documento no encontrado." }, { status: 404 });
    }

    // Rate limit por email: 10 análisis por email por día
    if (doc.clientEmail && !isStaff) {
      const rlEmail = await checkRateLimit({
        key: `doc-analyze:email:${doc.clientEmail}`,
        limit: 10,
        windowMs: 24 * 60 * 60 * 1000,
      });
      if (!rlEmail.ok) {
        return NextResponse.json(
          { ok: false, error: "Has superado el límite diario de análisis para este email." },
          { status: 429, headers: { "Retry-After": String(rlEmail.retryAfterSec) } }
        );
      }
    }

    if (doc.status === "ANALYZED" || doc.status === "QUOTE_GENERATED") {
      // Already analyzed — return cached result
      const cachedBase = doc.quoteAmount;
      const cachedUrgent = doc.quoteUrgent;
      let cachedDiagnosis = null;
      if (doc.analysisJson) {
        try {
          const cachedAnalysis = doc.analysisJson as unknown as DocumentAnalysisResult;
          cachedDiagnosis = buildDiagnosis(cachedAnalysis, calculatePrice(cachedAnalysis));
        } catch (err: any) {
          console.error("[documents/analyze] diagnosis (cached) error:", err?.message);
        }
      }
      return NextResponse.json({
        ok: true,
        analysis: doc.analysisJson,
        quote: cachedBase
          ? {
              basePrice: cachedBase,
              urgentPrice: cachedUrgent,
              totalPrice: Math.round(cachedBase * (1 + VAT_RATE) * 100) / 100,
              urgentTotalPrice: cachedUrgent ? Math.round(cachedUrgent * (1 + VAT_RATE) * 100) / 100 : undefined,
              estimatedDaysStandard: doc.estimatedDays,
              estimatedDaysUrgent: doc.estimatedDaysUrgent,
              breakdown: doc.quoteBreakdown,
            }
          : null,
        diagnosis: cachedDiagnosis,
        cached: true,
      });
    }

    // Mark as analyzing
    await prisma.documentAnalysis.update({
      where: { id: documentId },
      data: { status: "ANALYZING" },
    });

    // Fetch the file to get base64
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

    // Runner por capas: PDF con capa de texto → Haiku sobre texto (barato);
    // escaneo/imagen → Sonnet visión. Trunca PDFs largos internamente.
    const analysisStart = Date.now();
    let analysis;
    try {
      const run = await Promise.race([
        runDocumentAnalysis({
          buffer: fileBuffer,
          mimeType: doc.mimeType,
          fileName: doc.fileName,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT: análisis excedió 115s")), 115000)
        ),
      ]);
      // El par que el cliente DECLARÓ en la puerta manda sobre lo detectado
      // (solo existe en la fila antes del análisis: status UPLOADED/ANALYZING).
      analysis = applyDeclaredLanguages(run.analysis, { source: doc.sourceLanguage, target: doc.targetLanguage });
    } catch (err: any) {
      const errorDetail = err.status
        ? `API ${err.status}: ${err.error?.error?.message || err.message}`
        : err.message;
      console.error("[documents/analyze] Claude error:", errorDetail, "| mimeType:", doc.mimeType, "| fileSize:", doc.fileSize);
      // El rastro ANTES del aviso: si el envío falla, el fallo queda igualmente
      // registrado y es recuperable desde la BD.
      await prisma.documentAnalysis.update({
        where: { id: documentId },
        data: { status: "ANALYSIS_FAILED" },
      });
      // Fallo de CUENTA (límite mensual, crédito, clave): avisar a staff — el
      // cliente ve el error y nadie se enteraba (Maider, 25-ago). Con await: lambda.
      // Y si NO es de cuenta, tampoco se pierde en silencio: es un lead que se va.
      if (isAiAccountError(err)) {
        await alertStaffAiOutage("la puerta (análisis de documento)", errorDetail);
      } else {
        // El email puede haberlo dado durante el spinner, después de leer `doc`.
        const contacto = await prisma.documentAnalysis
          .findUnique({ where: { id: documentId }, select: { clientEmail: true } })
          .catch(() => null);
        await alertStaffAnalysisFailure({
          where: "la puerta (análisis de documento)",
          detail: errorDetail,
          documentId,
          fileName: doc.fileName,
          clientEmail: contacto?.clientEmail || doc.clientEmail,
        });
      }
      return NextResponse.json(
        {
          ok: false,
          error: "No hemos podido analizar el documento. Puedes contactarnos por WhatsApp para una respuesta rápida.",
          whatsappUrl: "https://wa.me/34951333614",
          _debug: errorDetail,
        },
        { status: 422 }
      );
    }

    // Measure real analysis time — Fase 1 quiere validar el "10 s" del plan.
    const analysisMs = Date.now() - analysisStart;
    console.log(
      `[documents/analyze] analysisMs=${analysisMs} pages=${analysis.document_metrics.pages} type=${analysis.document_type.specific_type}`
    );

    // Calculate price
    const quote = calculatePrice(analysis);

    // Build the full diagnosis (tipo · ¿necesita jurada? · precio · plazo · validez)
    const diagnosis = buildDiagnosis(analysis, quote);

    // Censor names for GDPR
    const censoredNames = censorExtractedNames(analysis.extracted_data.names || []);

    // Update document record
    await prisma.documentAnalysis.update({
      where: { id: documentId },
      data: {
        status: "QUOTE_GENERATED",
        analysisJson: analysis as any,
        documentType: analysis.document_type.specific_type,
        documentCategory: analysis.document_type.category,
        sourceLanguage: analysis.language.source,
        targetLanguage: analysis.language.target,
        countryOrigin: analysis.country.origin,
        estimatedWords: analysis.document_metrics.estimated_words,
        complexity: analysis.complexity.level,
        confidence: analysis.document_type.confidence,
        extractedNames: censoredNames,
        extractedDates: analysis.extracted_data.dates || [],
        // Persistimos el precio CLIENTE (coste + margen tiered, FR sin margen),
        // coherente con el diagnóstico mostrado y con la rama cached (que aplica
        // IVA sobre este valor). Ver lib/quote-math.ts.
        quoteAmount: diagnosis.price.base,
        quoteUrgent: clientPriceFromCost(quote.urgentPrice, resolveForeignLang(analysis.language)),
        estimatedDays: quote.estimatedDaysStandard,
        estimatedDaysUrgent: quote.estimatedDaysUrgent,
        quoteBreakdown: quote.breakdown as any,
        pageCount: analysis.document_metrics.pages,
      },
    });

    // Envío del presupuesto por email (fire-and-forget). El gate exigía además
    // clientName, que la puerta NUNCA escribe → este email jamás salía para sus
    // leads, pese a que el formulario promete enviarlo. Basta el email.
    // OJO: el email se guarda EN PARALELO mientras corre el análisis (la puerta
    // lo pide durante el spinner), así que `doc.clientEmail` —leído al arrancar
    // la request— casi siempre era null aquí: releer fresco (auditoría 24-ago).
    // Y el precio del email es el del CLIENTE (diagnosis.price, coste+margen),
    // el mismo que ve en la web — no el coste interno del motor.
    // Gate del escaparate también aquí (guardián 24-ago): sin él, un doc alemán
    // vería en pantalla "te lo confirma el traductor" y recibiría a la vez un
    // email con cifra de máquina en el asunto. Solo se manda con precio público
    // limpio (fr, sin riesgo, con destino resuelto).
    const contact = await prisma.documentAnalysis.findUnique({
      where: { id: documentId },
      select: { clientEmail: true, clientName: true },
    });
    if (
      contact?.clientEmail &&
      diagnosis.publicAutoPriceable &&
      !diagnosis.priceRisky &&
      !diagnosis.askTargetLanguage
    ) {
      sendQuoteFollowupEmail({
        email: contact.clientEmail,
        name: contact.clientName,
        documentType: analysis.document_type.specific_type_es,
        price: diagnosis.price.base,
        totalPrice: diagnosis.price.total,
        langPair: `${analysis.language.source_name} → ${analysis.language.target_name}`,
        estimatedDays: quote.estimatedDaysStandard,
        apostilleSurcharge: quote.breakdown.apostilleSurcharge || undefined,
      }).catch((err) => {
        console.error("[documents/analyze] Follow-up email error:", err.message);
      });
    }

    return NextResponse.json({
      ok: true,
      analysis,
      quote,
      diagnosis,
      analysisMs,
      cached: false,
    });
  } catch (err: any) {
    console.error("[documents/analyze]", err);
    return NextResponse.json(
      { ok: false, error: "Error interno al analizar el documento." },
      { status: 500 }
    );
  }
}
