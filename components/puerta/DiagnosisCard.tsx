"use client";

// components/puerta/DiagnosisCard.tsx — Tarjeta de diagnóstico de la puerta
// (v2 · Fase 1 · Bloque 1.2). Renderiza las 5 cosas del diagnóstico:
// tipo · ¿necesita jurada? · precio · plazo · validez.

import {
  FileText,
  ShieldCheck,
  Wallet,
  Clock,
  BadgeCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
} from "lucide-react";
import type { Diagnosis } from "@/lib/diagnosis";
import { estimateDeliveryDate, meetsDeadline } from "@/lib/diagnosis";
import { puertaT, type PuertaLang } from "@/lib/i18n/puerta";

// Confianza por debajo de este umbral → precio orientativo, no cerrado.
const CONFIDENCE_THRESHOLD = 0.7;

type Props = {
  diagnosis: Diagnosis;
  fileName: string;
  confidence: number;
  neededBy: Date | null;
  lang?: PuertaLang;
  onPickTargetLanguage: (lang: string, name: string) => void;
};

function formatDate(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 border-t border-bleu/10 py-4 first:border-t-0 first:pt-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bleu/10">
        <Icon className="h-4 w-4 text-bleu" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-graphite">
          {label}
        </p>
        <div className="mt-1 text-sm text-encre">{children}</div>
      </div>
    </div>
  );
}

export default function DiagnosisCard({
  diagnosis,
  fileName,
  confidence,
  neededBy,
  onPickTargetLanguage,
  lang = "es",
}: Props) {
  const t = puertaT[lang];
  const lowConfidence = confidence < CONFIDENCE_THRESHOLD;
  const { delivery } = diagnosis;
  const needsTargetLanguage = delivery.hours === null;

  const deliveryDate = delivery.hours
    ? estimateDeliveryDate(delivery.hours)
    : null;
  const onTime =
    delivery.hours && neededBy
      ? meetsDeadline(delivery.hours, neededBy)
      : null;

  return (
    <div className="rounded-xl border border-bleu/15 bg-card p-6 shadow-paper animate-fadeIn">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-bleu/10">
          <FileText className="h-5 w-5 text-bleu" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-baskerville text-xl text-encre">
            {diagnosis.type.label}
          </h3>
          <p className="mt-0.5 truncate text-xs text-graphite">{fileName}</p>
        </div>
      </div>

      <div className="mt-5">
        {/* 1 · ¿Necesita jurada? */}
        <Row icon={ShieldCheck} label={t.qSworn}>
          {diagnosis.sworn.statement}
        </Row>

        {/* 2 · Precio */}
        <Row icon={Wallet} label={t.qPrice}>
          {needsTargetLanguage ? (
            <p className="text-graphite">{t.pricePending}</p>
          ) : lowConfidence ? (
            <div>
              <p className="text-base font-semibold text-encre">
                {diagnosis.price.total.toFixed(2)} € {t.orientativoSuffix}
              </p>
              <p className="mt-1 flex items-start gap-1.5 text-xs text-or-dark">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-or" />
                {t.lowConfNote}
              </p>
            </div>
          ) : (
            <p>
              <span className="font-baskerville text-2xl font-bold text-bleu">
                {diagnosis.price.total.toFixed(2)} €
              </span>{" "}
              <span className="text-xs text-graphite">{t.ivaIncl}</span>
            </p>
          )}
        </Row>

        {/* 3 · Plazo */}
        <Row icon={Clock} label={t.qDelivery}>
          {needsTargetLanguage ? (
            <div>
              <p className="text-graphite">{t.spanishDocAsk}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {t.targetLanguages.map((tl) => (
                  <button
                    key={tl.code}
                    type="button"
                    onClick={() => onPickTargetLanguage(tl.code, tl.name)}
                    className="rounded-lg border border-bleu/20 px-3 py-1.5 text-xs font-medium text-bleu transition-colors hover:bg-bleu/5"
                  >
                    {tl.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="font-medium text-encre">{delivery.label}</p>
              {deliveryDate && (
                <p className="text-xs text-graphite">
                  {t.deliveryEstimated} {formatDate(deliveryDate, t.locale)} ({delivery.note})
                </p>
              )}
              {onTime === true && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-vert">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t.onTimeYes}
                </p>
              )}
              {onTime === false && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rouge">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {t.onTimeNo}
                </p>
              )}
            </div>
          )}
        </Row>

        {/* 4 · Validez */}
        <Row icon={BadgeCheck} label={t.qValidity}>
          <p>{diagnosis.validity.swornTranslation}</p>
          {diagnosis.validity.originalDocument && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-graphite">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-bleu" />
              {diagnosis.validity.originalDocument}
            </p>
          )}
        </Row>
      </div>
    </div>
  );
}
