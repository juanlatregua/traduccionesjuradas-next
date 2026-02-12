"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type Direction = "fr-es" | "es-fr";
type Step = 1 | 2 | 3;

type DocOption = {
  id: string;
  label: string;
  keywords: string[];
  pricing: "fixed" | "per-page" | "per-word";
  fixedPrice?: number;
  pagePrice?: number;
  wordPrice?: number;
  deadline: string;
  samplePdf: string;
  payDirect: boolean;
};

type CartItem = {
  uid: string;
  docId: string;
  label: string;
  price: number;
  deadline: string;
  detail: string;
  samplePdf: string;
  payDirect: boolean;
};

const QUICK_FAQ = [
  {
    q: "¿Es valida para Extranjeria y tramites oficiales?",
    a: "Si. La traduccion jurada va firmada por traductor jurado acreditado y sirve para tramites oficiales.",
  },
  {
    q: "¿Se entrega en PDF o papel?",
    a: "Entrega base en PDF firmado digitalmente. Si necesitas papel, se puede enviar por mensajeria (+24 h).",
  },
  {
    q: "¿Puedo pagar al instante?",
    a: "Si. En casos cerrados y documentos por palabra con conteo validado puedes pagar al momento.",
  },
  {
    q: "¿Puedo seguir mi pedido?",
    a: "Si. Puedes registrarte con Google y acceder a tu area de cliente para seguimiento.",
  },
  {
    q: "¿Recto y verso cuentan como 2 hojas?",
    a: "No. Recto y verso se considera una sola hoja.",
  },
];

const DOC_OPTIONS: DocOption[] = [
  {
    id: "penales-apostillado",
    label: "Certificado de penales apostillado",
    keywords: ["penales", "apostilla", "casier", "bulletin"],
    pricing: "fixed",
    fixedPrice: 50,
    deadline: "24 h",
    samplePdf: "/recursos/extrait-de-la-fiche-anthropometrique-avec-apostille.pdf",
    payDirect: true,
  },
  {
    id: "nacimiento",
    label: "Certificado de nacimiento",
    keywords: ["nacimiento", "naissance", "registro civil"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificado-literal-de-nacimiento.pdf",
    payDirect: true,
  },
  {
    id: "medios-economicos",
    label: "Certificado de medios economicos",
    keywords: ["medios", "saldo", "bancario", "certificado"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificat-de-solde-maroc-certificado-de-saldo-bancario-marruecos.pdf",
    payDirect: true,
  },
  {
    id: "kbis",
    label: "Kbis",
    keywords: ["kbis", "mercantil", "empresa", "registro"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/kbis-france.pdf",
    payDirect: true,
  },
  {
    id: "registro-mercantil",
    label: "Registro Mercantil",
    keywords: ["registro", "mercantil", "empresa"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/ejemplo-mercantil.pdf",
    payDirect: true,
  },
  {
    id: "delf-dalf",
    label: "Titulo DELF/DALF",
    keywords: ["delf", "dalf", "titulo", "idioma"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/ejemplo-academico.pdf",
    payDirect: true,
  },
  {
    id: "titulo-universitario",
    label: "Titulo universitario",
    keywords: ["titulo", "universitario", "diploma"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/ejemplo-academico.pdf",
    payDirect: true,
  },
  {
    id: "titulo-apostillado",
    label: "Titulo universitario apostillado",
    keywords: ["titulo", "apostilla", "universitario"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/ejemplo-academico.pdf",
    payDirect: true,
  },
  {
    id: "titulo-apostillado-legalizado",
    label: "Titulo universitario apostillado legalizado",
    keywords: ["titulo", "apostilla", "legalizado"],
    pricing: "fixed",
    fixedPrice: 55,
    deadline: "24-48 h",
    samplePdf: "/recursos/ejemplo-academico.pdf",
    payDirect: true,
  },
  {
    id: "expediente-universitario",
    label: "Expediente universitario",
    keywords: ["expediente", "notas", "universitario", "releve"],
    pricing: "per-page",
    pagePrice: 35,
    deadline: "Segun paginas",
    samplePdf: "/recursos/ejemplo-academico.pdf",
    payDirect: true,
  },
  {
    id: "nacimiento-apostillado",
    label: "Certificado de nacimiento apostillado",
    keywords: ["nacimiento", "apostilla", "registro civil"],
    pricing: "fixed",
    fixedPrice: 45,
    deadline: "24-48 h",
    samplePdf: "/recursos/certificado-literal-de-nacimiento.pdf",
    payDirect: true,
  },
  {
    id: "certificado-residencia-cnie",
    label: "Certificado de residencia (CNIE)",
    keywords: ["residencia", "cnie", "certificado", "frances"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificat-de-residence-pour-obtenir-le-CNIE.pdf",
    payDirect: true,
  },
  {
    id: "certificado-desplazamiento-em10",
    label: "Certificado de desplazamiento EM10",
    keywords: ["desplazamiento", "em10", "certificado"],
    pricing: "fixed",
    fixedPrice: 40,
    deadline: "24 h",
    samplePdf: "/recursos/certificat-de-detachement---certificado-de-desplazamiento-EM10.pdf",
    payDirect: true,
  },
  {
    id: "contrat-de-marriage",
    label: "Contrat de marriage",
    keywords: ["contrat", "marriage", "matrimonio", "notarial"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/contrat-de-marriage.pdf",
    payDirect: true,
  },
  {
    id: "bulletin-n3",
    label: "Bulletin n°3",
    keywords: ["bulletin", "n3", "penales"],
    pricing: "fixed",
    fixedPrice: 50,
    deadline: "24 h",
    samplePdf: "/recursos/bulletin-n3-madagascar.pdf",
    payDirect: true,
  },
  {
    id: "documento-3plus",
    label: "Documento 3+ hojas (contar palabras)",
    keywords: ["3 hojas", "palabras", "larga", "documento"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-juridico.pdf",
    payDirect: true,
  },
  {
    id: "estatutos",
    label: "Estatutos",
    keywords: ["estatutos", "sociedad", "empresa"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-mercantil.pdf",
    payDirect: true,
  },
  {
    id: "actas-notariales",
    label: "Actas notariales",
    keywords: ["actas", "notariales", "notaria"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-juridico.pdf",
    payDirect: true,
  },
  {
    id: "capitulaciones",
    label: "Capitulaciones matrimoniales",
    keywords: ["capitulaciones", "matrimoniales", "notarial"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/contrat-de-marriage.pdf",
    payDirect: true,
  },
  {
    id: "herencia",
    label: "Documentacion de herencia",
    keywords: ["herencia", "testamento", "sucesiones"],
    pricing: "per-word",
    wordPrice: 0.08,
    deadline: "Segun volumen",
    samplePdf: "/recursos/ejemplo-juridico.pdf",
    payDirect: true,
  },
];

function money(amount: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function estimatePrice(doc: DocOption, pages: number, words: number) {
  if (doc.pricing === "fixed") return doc.fixedPrice || 0;
  if (doc.pricing === "per-page") return (doc.pagePrice || 0) * Math.max(1, pages);
  return (doc.wordPrice || 0) * Math.max(1, words);
}

function estimateDetail(doc: DocOption, pages: number, words: number) {
  if (doc.pricing === "fixed") return "Precio cerrado.";
  if (doc.pricing === "per-page") return `${Math.max(1, pages)} paginas x ${money(doc.pagePrice || 0)}.`;
  return `${Math.max(1, words)} palabras x ${money(doc.wordPrice || 0)}.`;
}

export default function FrenchOfferPanel() {
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState<Direction>("fr-es");
  const [query, setQuery] = useState("");
  const [selectedDocId, setSelectedDocId] = useState<string>(DOC_OPTIONS[0].id);
  const [pages, setPages] = useState(3);
  const [words, setWords] = useState(1200);
  const [fileUpload, setFileUpload] = useState<File | null>(null);
  const [extractingWords, setExtractingWords] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeFaq, setActiveFaq] = useState(0);

  const selectedDoc = useMemo(
    () => DOC_OPTIONS.find((doc) => doc.id === selectedDocId) || DOC_OPTIONS[0],
    [selectedDocId]
  );

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return DOC_OPTIONS.slice(0, 8);
    return DOC_OPTIONS.filter((doc) => {
      const inLabel = doc.label.toLowerCase().includes(term);
      const inKeywords = doc.keywords.some((keyword) => keyword.toLowerCase().includes(term));
      return inLabel || inKeywords;
    }).slice(0, 8);
  }, [query]);

  const previewPrice = estimatePrice(selectedDoc, pages, words);
  const previewDetail = estimateDetail(selectedDoc, pages, words);
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const allPayDirect = cart.length > 0 && cart.every((item) => item.payDirect);
  const botContext = useMemo(() => {
    if (selectedDoc.pricing === "fixed") {
      return `Para "${selectedDoc.label}" tienes precio cerrado y puedes pagar al instante.`;
    }
    if (selectedDoc.pricing === "per-page") {
      return `Para "${selectedDoc.label}" calcula por paginas (35 EUR/pagina).`;
    }
    return `Para "${selectedDoc.label}" usa extractor PDF o palabras manuales (0,08 EUR/palabra).`;
  }, [selectedDoc]);

  const addToCart = () => {
    const item: CartItem = {
      uid: `${selectedDoc.id}-${Date.now()}`,
      docId: selectedDoc.id,
      label: selectedDoc.label,
      price: previewPrice,
      deadline: selectedDoc.deadline,
      detail: previewDetail,
      samplePdf: selectedDoc.samplePdf,
      payDirect: selectedDoc.payDirect,
    };
    setCart((prev) => [...prev, item]);
    setStep(2);
    setError(null);
    setNotice(null);
  };

  const removeItem = (uid: string) => {
    setCart((prev) => prev.filter((item) => item.uid !== uid));
  };

  const goCheckout = () => {
    if (cart.length === 0) {
      setError("Añade al menos un documento a la cesta.");
      return;
    }
    setStep(3);
    setError(null);
  };

  const extractWordsFromFile = async () => {
    if (selectedDoc.pricing !== "per-word") return;
    if (!fileUpload) {
      setError("Adjunta un PDF para extraer palabras.");
      return;
    }
    setExtractingWords(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", fileUpload);
      formData.append("lang", direction);
      formData.append("urgency", "normal");
      const res = await fetch("/api/estimador", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudieron extraer palabras.");
      }
      const extracted = Number(data.words || 0);
      if (!Number.isFinite(extracted) || extracted <= 0) {
        throw new Error("No se pudieron extraer palabras validas.");
      }
      setWords(extracted);
      setNotice(`Palabras extraidas: ${extracted}. Precio actualizado al instante.`);
    } catch (err: any) {
      setError(err?.message || "No se pudieron extraer palabras.");
    } finally {
      setExtractingWords(false);
    }
  };

  const payNow = async () => {
    if (!allPayDirect) return;
    setCheckoutLoading(true);
    setError(null);
    try {
      const labels = cart.map((item) => item.label).join(" + ").slice(0, 110);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: cartTotal,
          currency: "eur",
          title: `Pedido frances: ${labels}`,
          source: "preset",
          langPair: direction,
          pagesLabel: `${cart.length} documento(s)`,
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
        Contratacion autonoma en frances
      </p>
      <h2 className="mt-3 text-xl font-semibold text-slate-900 sm:text-2xl">
        Elige documento, añade a cesta y finaliza pedido
      </h2>
      <p className="mt-2 text-sm text-slate-700">
        Flujo guiado para contratar sin esperas. Puedes mezclar documentos de precio cerrado y por palabra en la misma cesta.
      </p>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`rounded-full px-3 py-1 ${step === 1 ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}
        >
          1. Seleccion
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={`rounded-full px-3 py-1 ${step === 2 ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}
        >
          2. Cesta
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          className={`rounded-full px-3 py-1 ${step === 3 ? "bg-emerald-600 text-white" : "bg-white text-slate-600"}`}
        >
          3. Pago y acceso
        </button>
      </div>

      <label className="mt-4 flex max-w-xs flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Combinacion</span>
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="fr-es">Frances a Espanol</option>
          <option value="es-fr">Espanol a Frances</option>
        </select>
      </label>

      {step === 1 && (
      <div className="mt-5 grid gap-4 md:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Documento (escribe y te proponemos opciones)
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ejemplo: penales, nacimiento, Kbis..."
                className="mt-2 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </label>

            <div className="mt-3 space-y-2">
              {matches.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setSelectedDocId(doc.id)}
                  className={`w-full rounded-2xl border px-3 py-2 text-left text-sm ${
                    selectedDoc.id === doc.id
                      ? "border-emerald-400 bg-emerald-50 text-slate-900"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {doc.label}
                </button>
              ))}
            </div>

            {selectedDoc.pricing === "per-page" && (
              <label className="mt-3 flex max-w-[220px] flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Paginas</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={pages}
                  onChange={(e) => setPages(Number(e.target.value) || 1)}
                  className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            )}

            {selectedDoc.pricing === "per-word" && (
              <div className="mt-3 space-y-3">
                <label className="flex max-w-[280px] flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Adjuntar PDF (extractor)</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setFileUpload(e.target.files?.[0] || null)}
                    className="block w-full text-xs file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700"
                  />
                </label>
                <button
                  type="button"
                  onClick={extractWordsFromFile}
                  disabled={extractingWords}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                >
                  {extractingWords ? "Extrayendo palabras..." : "Extraer palabras del PDF"}
                </button>
                <label className="flex max-w-[220px] flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Palabras (manual)</span>
                  <input
                    type="number"
                    min={1}
                    max={200000}
                    value={words}
                    onChange={(e) => setWords(Number(e.target.value) || 1)}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            )}

            <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Precio estimado</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">{money(previewPrice)}</p>
              <p className="text-xs text-slate-600">{previewDetail}</p>
              <p className="text-xs text-slate-600">Plazo: {selectedDoc.deadline}</p>
            </div>

            <button
              type="button"
              onClick={addToCart}
              className="mt-4 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Añadir a la cesta
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Vista previa documento</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
              <object
                data={selectedDoc.samplePdf}
                type="application/pdf"
                className="h-[220px] w-full"
                aria-label="Vista previa PDF"
              >
                <div className="flex h-[220px] items-center justify-center text-xs text-slate-500">
                  Vista previa no disponible
                </div>
              </object>
            </div>
            <a
              href={selectedDoc.samplePdf}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
            >
              Ver ejemplo en nueva pestaña
            </a>

            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Bot de confianza
              </p>
              <p className="mt-1 text-xs text-slate-600">Respuestas rapidas mientras preparas tu pedido.</p>
              <p className="mt-2 text-xs font-semibold text-emerald-800">{botContext}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_FAQ.map((item, idx) => (
                  <button
                    key={item.q}
                    type="button"
                    onClick={() => setActiveFaq(idx)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      activeFaq === idx ? "bg-emerald-600 text-white" : "bg-white text-slate-700 border border-slate-200"
                    }`}
                  >
                    {item.q}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-700">{QUICK_FAQ[activeFaq].a}</p>
              <Link
                href="/preguntas-frecuentes"
                className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
              >
                Ver FAQ completa
              </Link>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          {cart.length === 0 ? (
            <p className="text-sm text-slate-700">La cesta esta vacia. Añade un documento en el paso 1.</p>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item) => (
                  <div key={item.uid} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="text-xs text-slate-600">{item.detail}</p>
                      <p className="text-xs text-slate-600">Plazo: {item.deadline}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-700">{money(item.price)}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.uid)}
                        className="mt-1 text-xs font-semibold text-slate-500 hover:text-slate-700"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Subtotal</p>
                <p className="text-xl font-bold text-emerald-700">{money(cartTotal)}</p>
              </div>
            </>
          )}

          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              + Documentos
            </button>
            <button
              type="button"
              onClick={goCheckout}
              className="rounded-2xl bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
            >
              Finalizar pedido
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">
            Pedido preparado en dirección <span className="font-semibold">{direction === "fr-es" ? "Frances a Espanol" : "Espanol a Frances"}</span>.
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-700">{money(cartTotal)}</p>

          {allPayDirect ? (
            <button
              type="button"
              onClick={payNow}
              disabled={checkoutLoading || cart.length === 0}
              className="mt-3 rounded-2xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {checkoutLoading ? "Redirigiendo al pago..." : "Pagar y confirmar pedido"}
            </button>
          ) : (
            <Link
              href="/presupuesto"
              className="mt-3 inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Solicitar presupuesto confirmado
            </Link>
          )}

          <div className="mt-3 flex flex-wrap gap-3 text-sm">
            <a
              href="/api/auth/signin/google?callbackUrl=/area-cliente"
              className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Registrarme con Google para seguimiento
            </a>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-2xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Volver a cesta
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p className="mt-3 text-sm font-semibold text-emerald-700">{notice}</p>}
    </section>
  );
}
