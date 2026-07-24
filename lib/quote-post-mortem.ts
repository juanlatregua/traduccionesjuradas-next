// lib/quote-post-mortem.ts — Post-mortem determinista de un presupuesto que
// expira sin pago: contrasta el quote contra los análisis IA YA guardados
// (DocumentAnalysis del expediente) y el pricing engine, buscando errores que
// expliquen la no conversión. Sin llamadas a Claude: todo sale de la BD.
// Se ejecuta UNA vez al expirar (cron /api/quotes/reminders) y se persiste en
// Quote.postMortemJson; el digest diario lo lee, no lo recalcula.

import { prisma } from "@/lib/prisma";
import { calculatePrice } from "@/lib/pricing-engine/calculator";
import { decimalToNumber } from "@/lib/quotes";

export type PostMortemFinding = {
  code:
    | "price_above_engine"
    | "price_below_engine"
    | "language_mismatch"
    | "duplicate_lines"
    | "line_below_cost"
    | "holder_mismatch";
  detail: string;
};

export type QuotePostMortem = {
  at: string;
  findings: PostMortemFinding[];
  quoteTotalEur: number;
  expectedTotalEur: number | null; // suma del pricing engine sobre los análisis del expediente
  docs: { fileName: string; fileUrl: string }[];
};

// Desviación relativa a partir de la cual el precio dado se considera fuera de
// rango frente al pricing engine (los presupuestos manuales legítimos se desvían,
// pero >35% merece una mirada).
const PRICE_DEVIATION_THRESHOLD = 0.35;

function normalizeDesc(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function buildQuotePostMortem(quoteId: string): Promise<QuotePostMortem | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { lines: { orderBy: { createdAt: "asc" } } },
  });
  if (!quote) return null;

  const analyses = quote.expedienteRef
    ? await prisma.documentAnalysis.findMany({
        where: { sessionToken: `exp:${quote.expedienteRef}` },
        select: {
          fileName: true,
          fileUrl: true,
          sourceLanguage: true,
          extractedNames: true,
          analysisJson: true,
        },
      })
    : [];

  const findings: PostMortemFinding[] = [];
  const quoteTotalEur = decimalToNumber(quote.total);

  // Documentos visibles del presupuesto: análisis del expediente o, si no hay,
  // los PDF enlazados en las líneas.
  const docs: { fileName: string; fileUrl: string }[] = analyses.length
    ? analyses.map((a) => ({ fileName: a.fileName, fileUrl: a.fileUrl }))
    : quote.lines
        .filter((l) => l.sourceFileUrl)
        .map((l) => ({ fileName: l.description, fileUrl: l.sourceFileUrl as string }));

  // 1) Líneas duplicadas (mismo concepto dos veces).
  const seen = new Map<string, number>();
  for (const line of quote.lines) {
    const key = normalizeDesc(line.description);
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1);
  if (dups.length) {
    findings.push({
      code: "duplicate_lines",
      detail: `Concepto repetido: ${dups.map(([k, n]) => `"${k}" ×${n}`).join(", ")}`,
    });
  }

  // 2) Línea vendida por debajo del coste del traductor.
  for (const line of quote.lines) {
    const cost = line.supplierUnitCost ? decimalToNumber(line.supplierUnitCost) : null;
    const price = decimalToNumber(line.unitPrice);
    if (cost != null && cost > 0 && price < cost) {
      findings.push({
        code: "line_below_cost",
        detail: `"${line.description}": precio ${price.toFixed(2)} € por debajo del coste ${cost.toFixed(2)} €`,
      });
    }
  }

  // 3) Idioma del análisis vs idiomas del presupuesto.
  const pair = [quote.sourceLang, quote.targetLang].map((l) => (l || "").toLowerCase());
  for (const a of analyses) {
    const lang = (a.sourceLanguage || "").toLowerCase();
    if (lang && lang !== "unknown" && !pair.includes(lang)) {
      findings.push({
        code: "language_mismatch",
        detail: `"${a.fileName}" se analizó como ${lang} pero el presupuesto es ${quote.sourceLang}→${quote.targetLang}`,
      });
    }
  }

  // 4) Precio dado vs pricing engine sobre los análisis guardados.
  // analysisJson puede ser un análisis suelto o el agregado de expediente
  // multi-documento {segmented: true, documents: [{analysis}]}.
  let expectedTotalEur: number | null = null;
  const engineTotals: number[] = [];
  let engineFailures = 0;
  for (const a of analyses) {
    if (!a.analysisJson) continue;
    const json = a.analysisJson as any;
    const units: any[] =
      json?.segmented && Array.isArray(json.documents)
        ? json.documents.map((d: any) => d?.analysis).filter(Boolean)
        : [json];
    for (const unit of units) {
      try {
        const engineQuote = calculatePrice(unit);
        if (Number.isFinite(engineQuote?.totalPrice)) engineTotals.push(engineQuote.totalPrice);
        else engineFailures += 1;
      } catch {
        engineFailures += 1; // análisis antiguo o incompleto: no bloquea el post-mortem
      }
    }
  }
  if (engineFailures === 0 && engineTotals.length > 0) {
    expectedTotalEur = Math.round(engineTotals.reduce((s, n) => s + n, 0) * 100) / 100;
    if (expectedTotalEur > 0 && quoteTotalEur > 0) {
      const deviation = (quoteTotalEur - expectedTotalEur) / expectedTotalEur;
      if (deviation > PRICE_DEVIATION_THRESHOLD) {
        findings.push({
          code: "price_above_engine",
          detail: `Total ${quoteTotalEur.toFixed(2)} € un ${Math.round(deviation * 100)}% por ENCIMA del engine (${expectedTotalEur.toFixed(2)} €)`,
        });
      } else if (deviation < -PRICE_DEVIATION_THRESHOLD) {
        findings.push({
          code: "price_below_engine",
          detail: `Total ${quoteTotalEur.toFixed(2)} € un ${Math.round(-deviation * 100)}% por DEBAJO del engine (${expectedTotalEur.toFixed(2)} €)`,
        });
      }
    }
  }

  // 5) Titulares del presupuesto vs nombres extraídos de los documentos.
  // extractedNames se guarda CENSURADO por RGPD ("Jua***"): solo se pueden
  // comparar los 3 primeros caracteres de cada token.
  const holders = (quote.holderNames || "").trim();
  const extracted = analyses.flatMap((a) => a.extractedNames || []);
  if (holders && extracted.length) {
    const holderPrefixes = holders
      .toLowerCase()
      .split(/[\s,;]+/)
      .filter((t) => t.length >= 3)
      .map((t) => t.slice(0, 3));
    const extractedPrefixes = extracted
      .map((n) => n.toLowerCase().replace(/\*+$/, ""))
      .filter((p) => p.length >= 3);
    const overlap =
      holderPrefixes.length === 0 ||
      extractedPrefixes.length === 0 ||
      holderPrefixes.some((h) => extractedPrefixes.some((e) => e.startsWith(h) || h.startsWith(e)));
    if (!overlap) {
      findings.push({
        code: "holder_mismatch",
        detail: `Titulares "${holders}" no coinciden con los nombres extraídos de los documentos (${extracted.slice(0, 3).join(", ")}…)`,
      });
    }
  }

  return {
    at: new Date().toISOString(),
    findings,
    quoteTotalEur,
    expectedTotalEur,
    docs,
  };
}
