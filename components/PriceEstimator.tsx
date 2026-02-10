"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type DocType = "certificado" | "academico" | "juridico" | "mercantil";
type Lang = "fr" | "de" | "en" | "it" | "pt" | "nl" | "ca" | "sv" | "no";
type EstimateMode = "pages" | "words";
type Urgency = "normal" | "urgente24";

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
  certificado: 40,
  academico: 50,
  juridico: 50,
  mercantil: 50,
};

const LANG_MULTIPLIER: Record<Lang, number> = {
  fr: 1, // 40 €/página
  de: 1.25, // ~50 €/página
  en: 1.25,
  it: 1.25,
  pt: 1.25,
  nl: 1.25,
  ca: 1.25,
  sv: 1.25,
  no: 1.25,
};

const PAGES_OPTIONS = [1, 2, 3, 4, 5, 6];

function getWordRate(lang: Lang) {
  // Regla comercial acordada:
  // frances -> espanol: 0.08 EUR/palabra
  // resto de idiomas -> espanol: 0.14 EUR/palabra
  return lang === "fr" ? 0.08 : 0.14;
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function calculateEstimate(
  mode: EstimateMode,
  doc: DocType,
  lang: Lang,
  pages: number,
  words: number,
  urgency: Urgency
) {
  const basePerPage = Math.round(BASE_PRICE[doc] * LANG_MULTIPLIER[lang]);
  const wordRate = getWordRate(lang);

  const pagesSubtotal = pages * basePerPage;
  const wordsSubtotal = Math.round(words * wordRate);
  const baseSubtotal = mode === "pages" ? pagesSubtotal : Math.max(basePerPage, wordsSubtotal);

  const urgencyMultiplier = urgency === "urgente24" ? 1.25 : 1;
  const total = Math.round(baseSubtotal * urgencyMultiplier);

  const normalDays = doc === "certificado" ? "24-48 h laborales" : "48-72 h laborales";
  const days = urgency === "urgente24" ? "24 h (segun disponibilidad)" : normalDays;

  return {
    basePerPage,
    wordRate,
    subtotal: baseSubtotal,
    total,
    urgencyPct: urgency === "urgente24" ? 25 : 0,
    days,
  };
}

export default function PriceEstimator() {
  const [mode, setMode] = useState<EstimateMode>("pages");
  const [doc, setDoc] = useState<DocType>("certificado");
  const [lang, setLang] = useState<Lang>("fr");
  const [pages, setPages] = useState<number>(1);
  const [words, setWords] = useState<number>(250);
  const [urgency, setUrgency] = useState<Urgency>("normal");
  const [sampleText, setSampleText] = useState("");

  const result = useMemo(
    () => calculateEstimate(mode, doc, lang, pages, words, urgency),
    [mode, doc, lang, pages, words, urgency]
  );

  const syncWordsFromText = (value: string) => {
    setSampleText(value);
    setWords(clampInt(countWords(value), 1, 20000));
  };

  return (
    <section className="mt-10 rounded-3xl border border-emerald-100 bg-emerald-50/70 p-6 text-sm text-slate-800">
      <h2 className="text-lg font-semibold text-emerald-900">
        Estimador orientativo de precio y plazo
      </h2>
      <p className="mt-1 text-slate-700">
        Selecciona idioma, tipo de documento y volumen para ver un precio aproximado.
        El precio cerrado se confirma al revisar tus archivos.
      </p>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Modo de calculo
        </p>
        <div className="mt-2 inline-flex rounded-2xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setMode("pages")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
              mode === "pages" ? "bg-emerald-600 text-white" : "text-slate-700"
            }`}
          >
            Por paginas
          </button>
          <button
            type="button"
            onClick={() => setMode("words")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
              mode === "words" ? "bg-emerald-600 text-white" : "text-slate-700"
            }`}
          >
            Por palabras
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
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
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {mode === "pages" ? (
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              N de paginas
            </span>
            <select
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              value={pages}
              onChange={(e) => setPages(Number(e.target.value))}
            >
              {PAGES_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "pagina" : "paginas"}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Numero de palabras
            </span>
            <input
              type="number"
              min={1}
              max={20000}
              value={words}
              onChange={(e) => setWords(clampInt(Number(e.target.value), 1, 20000))}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            />
          </label>
        )}

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Plazo
          </span>
          <select
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as Urgency)}
          >
            <option value="normal">Normal</option>
            <option value="urgente24">Urgente 24 h (+25%)</option>
          </select>
        </label>
      </div>

      {mode === "words" && (
        <label className="mt-4 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Pegar texto (contador rapido)
          </span>
          <textarea
            rows={4}
            value={sampleText}
            onChange={(e) => syncWordsFromText(e.target.value)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            placeholder="Pega aqui una muestra de texto para contar palabras automaticamente."
          />
          <p className="text-xs text-slate-600">
            Detectadas: <strong>{countWords(sampleText)}</strong> palabras en la muestra.
          </p>
        </label>
      )}

      <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm text-slate-700">Estimacion orientativa:</p>
        <p className="mt-1 text-xl font-bold text-emerald-700">{result.total} EUR</p>
        <p className="mt-1 text-xs text-slate-600">
          Base: {result.subtotal} EUR
          {result.urgencyPct > 0 ? ` + urgencia ${result.urgencyPct}%` : ""}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Referencia: {result.basePerPage} EUR/pagina o {result.wordRate.toFixed(3)} EUR/palabra.
        </p>
        <p className="text-sm text-slate-700">
          Plazo estimado: <span className="font-semibold">{result.days}</span>{" "}
          según idioma y volumen.
        </p>
        <p className="mt-2 text-[13px] text-slate-600">
          Es una simulacion orientativa. El precio exacto se confirma al revisar
          documento, formato final, urgencia real y posibles requisitos de envio en papel.
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
