"use client";

import { useEffect, useState } from "react";

type AccuracyData = {
  ok: boolean;
  totalSamples: number;
  accurateCount: number;
  accuracyRate: number;
  avgPriceDeltaPct: number;
  byExtractionMethod: Record<string, { samples: number; accuracyRate: number }>;
  byDocumentType: Record<string, { samples: number; accuracyRate: number }>;
  byConfidenceBand: {
    high_085_plus: { samples: number; accuracyRate: number };
    medium_070_084: { samples: number; accuracyRate: number };
    low_below_070: { samples: number; accuracyRate: number };
  };
};

function accuracyColor(rate: number) {
  if (rate >= 80) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
  if (rate >= 60) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
  return "text-red-400 border-red-500/30 bg-red-500/10";
}

export default function EstimationAccuracyCard() {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders/estimation-accuracy")
      .then((res) => res.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error || "Error desconocido");
        setData(json);
      })
      .catch((err) => setError(err?.message || "No se pudo cargar"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Precision del estimador
        </p>
        <p className="mt-3 text-sm text-slate-500">Cargando datos...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-red-500/30 bg-red-500/5 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-red-300">
          Precision del estimador
        </p>
        <p className="mt-3 text-sm text-red-400">{error}</p>
      </section>
    );
  }

  if (!data || data.totalSamples === 0) {
    return (
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Precision del estimador
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Sin datos suficientes. Los datos se acumularan a medida que se procesen pedidos con estimacion automatica.
        </p>
      </section>
    );
  }

  const colorClass = accuracyColor(data.accuracyRate);

  const docTypeEntries = Object.entries(data.byDocumentType)
    .filter(([, v]) => v.samples >= 2)
    .sort((a, b) => b[1].samples - a[1].samples);

  return (
    <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        Precision del estimador
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className={`rounded-2xl border p-4 text-center ${colorClass}`}>
          <p className="text-3xl font-bold">{data.accuracyRate}%</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Precision global
          </p>
        </div>
        <div className="text-sm text-slate-300">
          <p>
            <span className="font-semibold text-white">{data.accurateCount}</span> de{" "}
            <span className="font-semibold text-white">{data.totalSamples}</span> estimaciones
            dentro del 10% del precio final.
          </p>
          <p className="mt-1 text-slate-400">
            Desviacion media: {data.avgPriceDeltaPct}%
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {(["high_085_plus", "medium_070_084", "low_below_070"] as const).map((band) => {
          const info = data.byConfidenceBand[band];
          const label =
            band === "high_085_plus"
              ? "Confianza alta (>=0.85)"
              : band === "medium_070_084"
                ? "Confianza media (0.70-0.84)"
                : "Confianza baja (<0.70)";
          return (
            <div
              key={band}
              className="rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-300"
            >
              <p className="font-semibold text-slate-200">{label}</p>
              <p className="mt-1">
                {info.samples} muestras · {info.accuracyRate}% precision
              </p>
            </div>
          );
        })}
      </div>

      {data.totalSamples > 20 && docTypeEntries.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Por tipo de documento
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {docTypeEntries.map(([docType, stats]) => (
              <span
                key={docType}
                className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accuracyColor(stats.accuracyRate)}`}
              >
                {docType}: {stats.accuracyRate}% ({stats.samples})
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
