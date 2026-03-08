"use client";

import { useState } from "react";
import {
  FileText,
  CreditCard,
  GraduationCap,
  Scale,
  Landmark,
  Briefcase,
  Globe,
  Heart,
  File,
  Plus,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import type { DocumentAnalysisResult } from "@/lib/ai/analyze-document";
import type { Quote } from "@/lib/pricing-engine/calculator";

type DocumentEntry = {
  id: string;
  analysis: DocumentAnalysisResult;
  quote: Quote;
};

type Props = {
  documents: DocumentEntry[];
  currentAnalysis: DocumentAnalysisResult;
  onAddAnother: () => void;
  onViewQuote: () => void;
  onTargetLanguageChange?: (docIndex: number, target: string, targetName: string) => void;
};

const TARGET_LANGUAGE_OPTIONS = [
  { code: "es", name: "Español", flag: "/flags/es.svg" },
  { code: "fr", name: "Francés", flag: "/flags/fr.svg" },
  { code: "en", name: "Inglés", flag: "/flags/gb.svg" },
  { code: "de", name: "Alemán", flag: "/flags/de.svg" },
  { code: "it", name: "Italiano", flag: "/flags/it.svg" },
  { code: "pt", name: "Portugués", flag: "/flags/pt.svg" },
  { code: "ar", name: "Árabe", flag: "/flags/ma.svg" },
  { code: "nl", name: "Neerlandés", flag: "/flags/nl.svg" },
  { code: "ca", name: "Catalán", flag: "/flags/ca.svg" },
];

const CATEGORY_ICON_MAP: Record<string, React.ElementType> = {
  civil_registry: FileText,
  identity: CreditCard,
  academic: GraduationCap,
  legal: Scale,
  financial: Landmark,
  labor: Briefcase,
  immigration: Globe,
  medical: Heart,
  other: File,
};

const LANGUAGE_FLAGS: Record<string, string> = {
  fr: "/flags/fr.svg",
  en: "/flags/gb.svg",
  de: "/flags/de.svg",
  it: "/flags/it.svg",
  pt: "/flags/pt.svg",
  nl: "/flags/nl.svg",
  ar: "/flags/ma.svg",
  es: "/flags/es.svg",
  ca: "/flags/ca.svg",
  sv: "/flags/se.svg",
  no: "/flags/no.svg",
};

const LANGUAGE_ALT: Record<string, string> = {
  fr: "Francés",
  en: "Inglés",
  de: "Alemán",
  it: "Italiano",
  pt: "Portugués",
  nl: "Neerlandés",
  ar: "Árabe",
  es: "Español",
  ca: "Catalán",
  sv: "Sueco",
  no: "Noruego",
};

export default function DocumentReview({
  documents,
  currentAnalysis,
  onAddAnother,
  onViewQuote,
  onTargetLanguageChange,
}: Props) {
  const currentDoc = documents[documents.length - 1];
  const previousDocs = documents.slice(0, -1);
  const IconComponent =
    CATEGORY_ICON_MAP[currentAnalysis.document_type.category] || File;

  const totalBase = documents.reduce((sum, d) => sum + d.quote.basePrice, 0);

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Current document analysis */}
      <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bleu/10">
            <IconComponent className="h-6 w-6 text-bleu" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-baskerville text-xl text-encre">
              {currentAnalysis.document_type.specific_type_es}
            </h3>
            <p className="text-sm text-graphite mt-0.5">
              {currentAnalysis.document_type.category.replace(/_/g, " ")}
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-vert/10 px-3 py-1 text-xs font-medium text-vert">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Analizado
          </div>
        </div>

        {/* Details */}
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs text-graphite uppercase tracking-wide">Idioma</p>
            <div className="mt-1 flex items-center gap-2">
              {LANGUAGE_FLAGS[currentAnalysis.language.source] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={LANGUAGE_FLAGS[currentAnalysis.language.source]}
                  alt={LANGUAGE_ALT[currentAnalysis.language.source] || currentAnalysis.language.source_name}
                  className="h-4 w-5 rounded-sm object-cover"
                />
              )}
              <span className="text-sm font-medium text-encre">
                {currentAnalysis.language.source_name}
              </span>
              <span className="text-graphite">&rarr;</span>
              {onTargetLanguageChange && (currentAnalysis.language.target === "unknown" || currentAnalysis.language.target === currentAnalysis.language.source) ? (
                <div className="relative">
                  <select
                    value={currentAnalysis.language.target}
                    onChange={(e) => {
                      const opt = TARGET_LANGUAGE_OPTIONS.find(o => o.code === e.target.value);
                      if (opt) onTargetLanguageChange(documents.length - 1, opt.code, opt.name);
                    }}
                    className="appearance-none rounded-md border border-or/40 bg-or/5 pl-2 pr-6 py-0.5 text-sm font-medium text-encre focus:border-bleu focus:ring-1 focus:ring-bleu/20 outline-none cursor-pointer"
                  >
                    <option value="unknown">Seleccionar...</option>
                    {TARGET_LANGUAGE_OPTIONS
                      .filter(o => o.code !== currentAnalysis.language.source)
                      .map(o => (
                        <option key={o.code} value={o.code}>{o.name}</option>
                      ))
                    }
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-graphite" />
                </div>
              ) : (
                <span className="text-sm font-medium text-encre">
                  {currentAnalysis.language.target_name}
                </span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-graphite uppercase tracking-wide">País</p>
            <p className="mt-1 text-sm font-medium text-encre">
              {currentAnalysis.country.origin_name}
            </p>
          </div>
          <div>
            <p className="text-xs text-graphite uppercase tracking-wide">Extensión</p>
            <p className="mt-1 text-sm font-medium text-encre">
              {currentAnalysis.document_metrics.pages}{" "}
              {currentAnalysis.document_metrics.pages === 1 ? "página" : "páginas"}
            </p>
          </div>
        </div>

        {/* Price for this doc */}
        <div className="mt-4 flex items-center justify-between rounded-lg bg-cream/60 px-4 py-2.5">
          <span className="text-sm text-graphite">Precio</span>
          <span className="text-lg font-bold text-bleu">
            {currentDoc.quote.basePrice.toFixed(2)}€
          </span>
        </div>
      </div>

      {/* Previous documents (if any) */}
      {previousDocs.length > 0 && (
        <div className="rounded-xl border border-bleu/10 bg-card p-4 shadow-paper">
          <p className="text-xs text-graphite uppercase tracking-wide mb-3">
            Documentos anteriores ({previousDocs.length})
          </p>
          <div className="space-y-2">
            {previousDocs.map((doc) => {
              const DocIcon =
                CATEGORY_ICON_MAP[doc.analysis.document_type.category] || File;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg bg-cream/40 px-3 py-2"
                >
                  <DocIcon className="h-4 w-4 text-bleu shrink-0" />
                  <span className="flex-1 text-sm text-encre truncate">
                    {doc.analysis.document_type.specific_type_es}
                  </span>
                  <span className="text-sm font-medium text-bleu shrink-0">
                    {doc.quote.basePrice.toFixed(2)}€
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-cream pt-3">
            <span className="text-sm font-medium text-encre">
              Total ({documents.length} documentos)
            </span>
            <span className="text-lg font-bold text-bleu">
              {totalBase.toFixed(2)}€
            </span>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onAddAnother}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-bleu/30 px-5 py-3.5 text-sm font-medium text-bleu hover:border-bleu/50 hover:bg-bleu/5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Añadir otro documento
        </button>
        <button
          onClick={onViewQuote}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-bleu px-5 py-3.5 text-sm font-semibold text-cream shadow-md hover:bg-bleu-dark transition-colors"
        >
          Ver presupuesto
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
