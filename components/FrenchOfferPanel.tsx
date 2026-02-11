"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Direction = "fr-es" | "es-fr";
type Scenario = "one-page" | "two-with-apostille" | "two-no-apostille" | "university-record" | "words";

type Quote = {
  title: string;
  price: number;
  deadline: string;
  summary: string;
  canPayDirect: boolean;
};

function euro(amount: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function getQuote(scenario: Scenario, pages: number, words: number): Quote {
  if (scenario === "one-page") {
    return {
      title: "Documento de 1 hoja",
      price: 40,
      deadline: "24 h",
      summary: "Precio cerrado para certificado breve.",
      canPayDirect: true,
    };
  }

  if (scenario === "two-with-apostille") {
    return {
      title: "Documento de 2 hojas con apostilla",
      price: 50,
      deadline: "24 h",
      summary: "Una hoja de documento + una hoja de apostilla.",
      canPayDirect: true,
    };
  }

  if (scenario === "two-no-apostille") {
    return {
      title: "Documento de 2 hojas sin apostilla",
      price: 60,
      deadline: "24-48 h",
      summary: "Recto/verso no cuenta como dos hojas.",
      canPayDirect: true,
    };
  }

  if (scenario === "university-record") {
    const normalizedPages = Math.max(1, pages);
    const total = normalizedPages * 35;
    return {
      title: "Expediente universitario",
      price: total,
      deadline: normalizedPages <= 2 ? "24 h" : "24-48 h",
      summary: `Tarifa cerrada de 35 EUR/pagina (${normalizedPages} paginas).`,
      canPayDirect: true,
    };
  }

  const normalizedWords = Math.max(1, words);
  const total = Math.round(normalizedWords * 0.08);
  return {
    title: "Documento de 3+ hojas",
    price: total,
    deadline: "Segun volumen",
    summary: `Calculo por palabra (0,08 EUR x ${normalizedWords} palabras).`,
    canPayDirect: false,
  };
}

export default function FrenchOfferPanel() {
  const [direction, setDirection] = useState<Direction>("fr-es");
  const [scenario, setScenario] = useState<Scenario>("one-page");
  const [pages, setPages] = useState(3);
  const [words, setWords] = useState(800);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quote = useMemo(() => getQuote(scenario, pages, words), [scenario, pages, words]);

  const payNow = async () => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: quote.price,
          currency: "eur",
          title: `Frances jurado - ${quote.title}`,
          source: "preset",
          langPair: direction,
          pagesLabel: quote.title,
          words: scenario === "words" ? words : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo iniciar el pago.");
      }
      window.location.assign(data.url);
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar el pago.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <section className="mt-10 rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 p-5 shadow-sm sm:p-6">
      <p className="inline-flex rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        Panel dinamico de oferta francesa
      </p>
      <h2 className="mt-3 text-xl font-semibold text-slate-900 sm:text-2xl">
        Selecciona tu caso y obtén precio orientativo al instante
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        Casos cerrados con pago directo y flujo guiado. Para documentos largos, cálculo por palabra y presupuesto confirmado.
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Combinacion</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="fr-es">Frances -> Espanol</option>
            <option value="es-fr">Espanol -> Frances</option>
          </select>
        </label>

        <label className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Tipo de encargo</span>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as Scenario)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="one-page">Documento de 1 hoja</option>
            <option value="two-with-apostille">Documento de 2 hojas (1 apostilla)</option>
            <option value="two-no-apostille">Documento de 2 hojas (sin apostilla)</option>
            <option value="university-record">Expediente universitario (35 EUR/pagina)</option>
            <option value="words">Documento 3+ hojas (0,08 EUR/palabra)</option>
          </select>
        </label>
      </div>

      {scenario === "university-record" && (
        <label className="mt-4 flex max-w-xs flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Numero de paginas</span>
          <input
            type="number"
            min={1}
            max={120}
            value={pages}
            onChange={(e) => setPages(Number(e.target.value) || 1)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      )}

      {scenario === "words" && (
        <label className="mt-4 flex max-w-xs flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Palabras estimadas</span>
          <input
            type="number"
            min={1}
            max={200000}
            value={words}
            onChange={(e) => setWords(Number(e.target.value) || 1)}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      )}

      <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Resultado</p>
        <p className="mt-1 text-2xl font-bold text-emerald-700">{euro(quote.price)}</p>
        <p className="mt-1 text-sm text-slate-700">{quote.title}</p>
        <p className="text-sm text-slate-700">Plazo orientativo: <span className="font-semibold">{quote.deadline}</span></p>
        <p className="mt-1 text-xs text-slate-500">{quote.summary}</p>
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {quote.canPayDirect ? (
          <button
            type="button"
            onClick={payNow}
            disabled={checkoutLoading}
            className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {checkoutLoading ? "Redirigiendo al pago..." : "Pagar y confirmar pedido"}
          </button>
        ) : (
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            Solicitar presupuesto confirmado
          </Link>
        )}
        <a
          href="/api/auth/signin/google?callbackUrl=/area-cliente"
          className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
        >
          Acceso con Google (opcional)
        </a>
      </div>

      <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-600">
          Ver ejemplos de casos reales
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Penales apostillado: 50 EUR.</li>
          <li>Certificado de nacimiento: 40 EUR.</li>
          <li>Kbis y Registro Mercantil: 45 EUR.</li>
          <li>Titulo universitario apostillado y legalizado: 55 EUR.</li>
          <li>Expediente universitario: 35 EUR/pagina.</li>
        </ul>
      </details>
    </section>
  );
}
