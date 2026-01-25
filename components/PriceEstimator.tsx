"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type DocType = "certificado" | "academico" | "juridico" | "mercantil";
type Lang = "fr" | "de" | "en" | "it" | "pt" | "nl" | "ca" | "sv" | "no";

const LANG_LABEL: Record<Lang, string> = {
  fr: "Francés",
  de: "Alemán",
  en: "Inglés",
  it: "Italiano",
  pt: "Portugués",
  nl: "Neerlandés",
  ca: "Catalán",
  sv: "Sueco",
  no: "Noruego",
};

const DOC_LABEL: Record<DocType, string> = {
  certificado: "Certificado breve (Registro Civil, penales)",
  academico: "Académico (título, expediente)",
  juridico: "Jurídico / notarial",
  mercantil: "Mercantil / empresarial",
};

const BASE_PRICE: Record<DocType, number> = {
  certificado: 35,
  academico: 55,
  juridico: 65,
  mercantil: 70,
};

const LANG_MULTIPLIER: Record<Lang, number> = {
  fr: 1,
  de: 1.1,
  en: 1,
  it: 1,
  pt: 1,
  nl: 1.15,
  ca: 1,
  sv: 1.2,
  no: 1.2,
};

const PAGES_OPTIONS = [1, 2, 3, 4, 5, 6];

function calculateRange(doc: DocType, lang: Lang, pages: number) {
  const base = BASE_PRICE[doc] * LANG_MULTIPLIER[lang];
  const min = Math.round(base * pages);
  const max = Math.round(base * pages * 1.3);
  const days =
    doc === "certificado"
      ? "24-48 h laborales"
      : doc === "academico"
      ? "2-4 días laborales"
      : "2-5 días laborales";
  return { min, max, days };
}

export default function PriceEstimator() {
  const [doc, setDoc] = useState<DocType>("certificado");
  const [lang, setLang] = useState<Lang>("fr");
  const [pages, setPages] = useState<number>(1);

  const result = useMemo(() => calculateRange(doc, lang, pages), [doc, lang, pages]);

  return (
    <section className="mt-10 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6 text-sm text-slate-800">
      <h2 className="text-lg font-semibold text-emerald-900">
        Estimador orientativo de precio y plazo
      </h2>
      <p className="mt-1 text-slate-700">
        Selecciona idioma, tipo de documento y páginas para ver un rango aproximado.
        El presupuesto cerrado se confirma al revisar tus archivos.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Idioma
          </span>
          <select
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
          >
            {Object.entries(LANG_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Tipo de documento
          </span>
          <select
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            value={doc}
            onChange={(e) => setDoc(e.target.value as DocType)}
          >
            {Object.entries(DOC_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Nº de páginas
          </span>
          <select
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            value={pages}
            onChange={(e) => setPages(Number(e.target.value))}
          >
            {PAGES_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "página" : "páginas"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">
          Rango orientativo:{" "}
          <span className="font-semibold text-emerald-700">
            {result.min} € – {result.max} €
          </span>{" "}
          (incluye firma y sello de traductor jurado).
        </p>
        <p className="text-sm text-slate-700">
          Plazo estimado: <span className="font-semibold">{result.days}</span>{" "}
          dependiendo de volumen e idioma.
        </p>
        <p className="mt-2 text-[13px] text-slate-600">
          El precio exacto se confirma al ver tus documentos. Si necesitas entrega en papel
          o legalización/apostilla, indícalo al pedir presupuesto.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href="/presupuesto"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            Pedir presupuesto cerrado
          </Link>
          <Link
            href="/preguntas-frecuentes"
            className="font-semibold text-emerald-800 underline-offset-2 hover:underline"
          >
            Ver dudas frecuentes
          </Link>
        </div>
      </div>
    </section>
  );
}
