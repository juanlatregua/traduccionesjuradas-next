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
  if (rate >= 80) return "text-[#1F6B45] border-[#BFE0CC] bg-[#EEF7F1]";
  if (rate >= 60) return "text-[#7A5A10] border-[#E9D8A6] bg-[#FFF8E6]";
  return "text-[#A12B2B] border-[#F0C9C9] bg-[#FDF2F2]";
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
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-[#D5DAE1] bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-graphite">
          Precision del estimador
        </p>
        <p className="mt-3 text-sm text-graphite">Cargando datos...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-[#F0C9C9] bg-[#FDF2F2] p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#A12B2B]">
          Precision del estimador
        </p>
        <p className="mt-3 text-sm text-[#A12B2B]">{error}</p>
      </section>
    );
  }

  if (!data || data.totalSamples === 0) {
    return (
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-[#D5DAE1] bg-white p-6 shadow-xl sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-graphite">
          Precision del estimador
        </p>
        <p className="mt-3 text-sm text-graphite">
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
    <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-[#D5DAE1] bg-white p-6 shadow-xl sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">
        Precision del estimador
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className={`rounded-2xl border p-4 text-center ${colorClass}`}>
          <p className="text-3xl font-bold">{data.accuracyRate}%</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
            Precision global
          </p>
        </div>
        <div className="text-sm text-[#1F2933]">
          <p>
            <span className="font-semibold text-[#1A2E4A]">{data.accurateCount}</span> de{" "}
            <span className="font-semibold text-[#1A2E4A]">{data.totalSamples}</span> estimaciones
            dentro del 10% del precio final.
          </p>
          <p className="mt-1 text-graphite">
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
              className="rounded-xl border border-[#D5DAE1] bg-[#F6F7F9] px-3 py-2 text-xs text-[#1F2933]"
            >
              <p className="font-semibold text-[#1F2933]">{label}</p>
              <p className="mt-1">
                {info.samples} muestras · {info.accuracyRate}% precision
              </p>
            </div>
          );
        })}
      </div>

      {data.totalSamples > 20 && docTypeEntries.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-graphite">
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
