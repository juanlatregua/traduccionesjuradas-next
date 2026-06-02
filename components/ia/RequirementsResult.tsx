"use client";

// components/ia/RequirementsResult.tsx — Renderiza la lectura del requerimiento.
// Encuadre YMYL: "esto es lo que TU CARTA dice", badges con grado (no sí/no),
// cita literal de la carta, disclaimers pegados a cada badge, banner permanente
// y enlace a la fuente HCCH. CTA → la puerta del idioma a subir los documentos.

import Link from "next/link";
import {
  ShieldAlert,
  FileText,
  Clock,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Info,
  ScrollText,
} from "lucide-react";
import { lectorT } from "@/lib/i18n/lector";
import { LOCALE_HOME, type Locale } from "@/lib/i18n/locales";
import { HCCH_TABLE } from "@/lib/legalization/hcch-table";
import type {
  RequirementsExtraction,
  SwornAssessment,
  RequirementLegalization,
} from "@/lib/ai/requirements";

const NEUTRAL = "border-cream bg-parchment text-sepia";
const WARN = "border-or/50 bg-or-light/50 text-or-dark";
const INFO = "border-bleu/20 bg-bleu/5 text-bleu";

export default function RequirementsResult({
  requirements: r,
  lang,
  onReset,
}: {
  requirements: RequirementsExtraction;
  lang: Locale;
  onReset: () => void;
}) {
  const t = lectorT[lang];
  const puertaHref = `${LOCALE_HOME[lang]}?from=lector`;

  const swornMeta: Record<SwornAssessment, { label: string; cls: string }> = {
    likely_required: { label: t.swornLikely, cls: WARN },
    possibly_required: { label: t.swornPossibly, cls: WARN },
    not_required: { label: t.swornNot, cls: NEUTRAL },
    unclear: { label: t.swornUnclear, cls: NEUTRAL },
  };
  const legMeta: Record<RequirementLegalization, { label: string; cls: string }> = {
    apostille: { label: t.legApostille, cls: INFO },
    consular: { label: t.legConsular, cls: INFO },
    "eu-exempt": { label: t.legEuExempt, cls: INFO },
    verify_with_authority: { label: t.legVerify, cls: NEUTRAL },
  };

  // Caso: el archivo no es una notificación sino el propio documento → puerta.
  if (!r.isRequirement) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-cream bg-card p-6 shadow-paper">
        <h2 className="font-baskerville text-xl font-bold text-encre">{t.notReqTitle}</h2>
        <p className="mt-2 text-sm text-sepia">{t.notReqBody}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={puertaHref}
            className="inline-flex items-center gap-2 rounded-xl bg-or px-5 py-2.5 text-sm font-semibold text-encre transition hover:bg-or-dark hover:text-white"
          >
            {t.ctaDiagnose}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-bleu/30 px-4 py-2.5 text-sm font-semibold text-bleu transition hover:bg-bleu/5"
          >
            <RefreshCw className="h-4 w-4" />
            {t.backCta}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Banner YMYL permanente */}
      <div className="flex items-start gap-2.5 rounded-xl border border-or/40 bg-or-light/30 px-4 py-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-or-dark" />
        <p className="text-xs leading-relaxed text-sepia">{t.bannerYmyl}</p>
      </div>

      {/* Resumen */}
      <div className="rounded-2xl border border-cream bg-card p-6 shadow-paper">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">{t.summaryEyebrow}</p>
        <p className="mt-2 font-baskerville text-lg leading-snug text-encre">{r.summary}</p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-sepia">
          {r.procedure?.context && (
            <span>
              <span className="font-semibold text-encre">{t.procedureLabel}:</span> {r.procedure.context}
            </span>
          )}
          {r.procedure?.requestingAuthority && (
            <span>
              <span className="font-semibold text-encre">{t.authorityLabel}:</span>{" "}
              {r.procedure.requestingAuthority}
            </span>
          )}
        </div>
      </div>

      {/* Documentos pedidos */}
      {r.documents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-baskerville text-lg font-bold text-encre">{t.docsHeading}</h3>
          {r.documents.map((d, i) => {
            const sworn = swornMeta[d.swornAssessment] || swornMeta.unclear;
            const leg = legMeta[d.legalization] || legMeta.verify_with_authority;
            return (
              <div key={i} className="rounded-2xl border border-cream bg-card p-5 shadow-paper">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bleu/10 text-bleu">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-encre">{d.label}</p>
                    {(d.languagePair?.source || d.languagePair?.target) && (
                      <p className="text-sm text-sepia">
                        {t.translationLabel}: {d.languagePair.source || "—"} →{" "}
                        {d.languagePair.target || "es"}
                        {d.quantity && d.quantity > 1 ? ` · ${d.quantity} ${t.copiesLabel}` : ""}
                      </p>
                    )}
                  </div>
                </div>

                {/* Badges */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${sworn.cls}`}>
                    {sworn.label}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${leg.cls}`}>
                    {leg.label}
                  </span>
                </div>

                {/* Cita literal de la carta */}
                {d.swornEvidence && (
                  <blockquote className="mt-3 border-l-2 border-or/50 bg-parchment px-3 py-2 text-xs italic text-sepia">
                    <span className="block not-italic font-semibold text-encre">{t.evidenceLabel}</span>
                    «{d.swornEvidence}»
                  </blockquote>
                )}

                {/* Nota de legalización + disclaimer inline */}
                {d.legalizationNote && <p className="mt-2 text-xs text-sepia">{d.legalizationNote}</p>}
                <p className="mt-2 flex items-center gap-1.5 text-xs text-graphite">
                  <Info className="h-3.5 w-3.5 shrink-0" />
                  {t.inlineDisclaimer}
                  <a
                    href={HCCH_TABLE.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-bleu underline underline-offset-2"
                  >
                    {t.verifyLinkHcch}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Plazo */}
      {r.deadlineLiteral && (
        <div className="flex items-start gap-2.5 rounded-xl border border-or/40 bg-or-light/30 px-4 py-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-or-dark" />
          <div className="text-sm text-sepia">
            <span className="font-semibold text-encre">{t.deadlineHeading}: </span>
            «{r.deadlineLiteral}». <span className="text-xs">{t.deadlineConfirm}</span>
          </div>
        </div>
      )}

      {/* Próximos pasos + CTA */}
      <div className="rounded-2xl border border-cream bg-card p-6 shadow-paper">
        {r.nextSteps.length > 0 && (
          <>
            <h3 className="font-baskerville text-lg font-bold text-encre">{t.nextStepsHeading}</h3>
            <ol className="mt-3 space-y-2">
              {r.nextSteps.map((s, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-sepia">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-bleu/10 text-xs font-semibold text-bleu">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </>
        )}
        <Link
          href={puertaHref}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-or px-5 py-3 text-sm font-semibold text-encre shadow-sm transition hover:bg-or-dark hover:text-white"
        >
          {t.ctaOrder}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Pie: fecha de vigencia + disclaimer legal + volver */}
      <div className="space-y-3 px-1">
        <p className="flex items-center gap-1.5 text-xs text-graphite">
          <ScrollText className="h-3.5 w-3.5 shrink-0" />
          {t.hcchReviewed} {r.hcchTableReviewedAt}.
        </p>
        <p className="text-xs leading-relaxed text-graphite">{t.footerDisclaimer}</p>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-xl border border-bleu/30 px-4 py-2 text-sm font-semibold text-bleu transition hover:bg-bleu/5"
        >
          <RefreshCw className="h-4 w-4" />
          {t.backCta}
        </button>
      </div>
    </div>
  );
}
