// lib/quote-edit-db.ts — Lecturas para abrir el constructor sobre un presupuesto ya
// creado (PRESUPUESTO_PAGINA_UNICA). Lo puro está en lib/quote-edit-hydrate.ts.

import { prisma } from "@/lib/prisma";
import { decimalToNumber } from "@/lib/quotes";
import { savedBuilderDocuments } from "@/lib/expediente-analyze";
import { solicitudesVivasDelHilo } from "@/lib/caso/hilo-db";
import { nombreMiembro } from "@/lib/caso/vista";
import { preferAnalysisRows, sessionKeysForExpediente, type AnalysisDoc, type EditableQuote } from "@/lib/quote-edit-hydrate";
import type { SolicitudViva } from "@/components/StaffExpedienteIntake";

const n = (v: unknown) => decimalToNumber(v as any);

export function editableQuoteFrom(q: any): EditableQuote {
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status,
    customerName: q.customerName,
    customerEmail: q.customerEmail,
    customerPhone: q.customerPhone ?? null,
    sourceLang: q.sourceLang,
    targetLang: q.targetLang,
    deliveryType: q.deliveryType,
    shippingBase: n(q.shippingBase),
    vatRate: n(q.vatRate),
    discountType: q.discountType,
    discountValue: n(q.discountValue),
    notesLegal: q.notesLegal ?? null,
    deliveryTerm: q.deliveryTerm ?? null,
    holderNames: q.holderNames ?? null,
    validityDays: q.validityDays,
    marginPct: q.marginPct ?? null,
    paymentMethods: Array.isArray(q.paymentMethods) ? q.paymentMethods : [],
    contactWhatsapp: q.contactWhatsapp ?? null,
    pdfLang: q.pdfLang ?? null,
    paymentFrozenAt: q.paymentFrozenAt ? new Date(q.paymentFrozenAt).toISOString() : null,
    updatedAt: new Date(q.updatedAt).toISOString(),
    total: n(q.total),
    lines: (q.lines || []).map((l: any) => ({
      description: l.description,
      quantity: n(l.quantity),
      unitPrice: n(l.unitPrice),
      supplierUnitCost: l.supplierUnitCost == null ? null : n(l.supplierUnitCost),
      sourceFileUrl: l.sourceFileUrl ?? null,
      pageStart: l.pageStart ?? null,
      pageEnd: l.pageEnd ?? null,
      docKind: l.docKind ?? null,
    })),
  };
}

/** Análisis guardado de los PDF de las líneas (por URL), sin volver a llamar a la IA. */
async function analysisDocsFor(urls: string[], sessionKeys: string[]): Promise<AnalysisDoc[]> {
  if (urls.length === 0) return [];
  const rows = await prisma.documentAnalysis.findMany({
    where: { fileUrl: { in: urls } },
    select: {
      id: true, fileName: true, fileUrl: true, status: true, analysisJson: true, pageCount: true, sessionToken: true, createdAt: true,
      documentType: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, complexity: true,
    },
  });
  return preferAnalysisRows(rows, sessionKeys).flatMap((r): AnalysisDoc[] => {
    const saved = savedBuilderDocuments(r);
    if (saved) {
      return saved.documents.map((d) => ({
        fileUrl: r.fileUrl,
        fileName: r.fileName,
        pageStart: d.pageStart ?? null,
        pageEnd: d.pageEnd ?? null,
        documentType: d.documentType,
        documentTypeEs: d.documentTypeEs,
        category: d.category,
        sourceLang: d.sourceLang,
        sourceName: d.sourceName,
        targetLang: d.targetLang,
        targetName: d.targetName,
        words: d.words,
        pages: d.pages,
        complexity: d.complexity,
        countryCode: d.countryCode,
        hasApostille: d.hasApostille,
        hasTables: d.hasTables,
        hasHandwriting: d.hasHandwriting,
        apostilleSeparatePage: d.apostilleSeparatePage,
        absorbedPages: d.absorbedPages,
        mode: saved.mode,
      }));
    }
    // Analizado por la puerta (sin segmentar en el constructor): lo que guardan las columnas.
    const a = r.analysisJson as any;
    return [{
      fileUrl: r.fileUrl,
      fileName: r.fileName,
      pageStart: 1,
      pageEnd: r.pageCount || 1,
      documentType: r.documentType,
      documentTypeEs: a?.document_type?.specific_type_es ?? null,
      sourceLang: r.sourceLanguage,
      targetLang: r.targetLanguage,
      words: r.estimatedWords,
      pages: r.pageCount,
      complexity: r.complexity,
    }];
  });
}

export async function constructorDelPresupuesto(quote: any, lprRef: string | null) {
  const editable = editableQuoteFrom(quote);
  const expedienteRef: string | null = quote.expedienteRef ?? null;
  const puertaSession = expedienteRef?.startsWith("puerta:") ? expedienteRef.slice("puerta:".length) : null;
  const urls = [...new Set(editable.lines.map((l) => l.sourceFileUrl).filter((u): u is string => Boolean(u)))];
  const [analysisDocs, vivas] = await Promise.all([
    analysisDocsFor(urls, sessionKeysForExpediente(expedienteRef)).catch(() => []),
    solicitudesVivasDelHilo(quote.casoId ?? null, { quoteId: quote.id, ...(lprRef ? { lprRef } : {}), ...(expedienteRef ? { expedienteRef } : {}) }).catch(() => []),
  ]);
  const solicitudesVivas: SolicitudViva[] = vivas.map((l) => ({
    ref: l.ref,
    par: l.par,
    status: l.status,
    priceCents: l.priceCents,
    plazoDias: l.plazoDias,
    miembroNombre: l.miembroNombre,
    nombres: l.candidatos.map((id) => nombreMiembro(id) || id),
    createdAt: l.createdAt.toISOString(),
  }));
  return {
    quote: editable,
    analysisDocs,
    expedienteRef: puertaSession ? null : expedienteRef,
    puertaSession,
    casoId: (quote.casoId as string | null) ?? null,
    solicitudesVivas,
  };
}
