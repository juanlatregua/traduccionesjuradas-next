"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  DOCUMENT_CATEGORIES,
  getEstimatedPrice,
} from "@/lib/language-config";
import { buildWhatsAppLinkFromText } from "@/lib/contact";
import {
  useCarritoPresupuesto,
  type ItemCarrito,
} from "@/hooks/useCarritoPresupuesto";

type Props = {
  idioma: string;
  precioPorPalabra: number;
  combinaciones: string[];
};

type ToastState = { type: "success" | "error"; message: string } | null;

export default function EstimadorCarrito({
  idioma,
  precioPorPalabra,
  combinaciones,
}: Props) {
  const { items, añadir, eliminar, vaciar, total } =
    useCarritoPresupuesto();

  // Selector state
  const [combinacion, setCombinacion] = useState(combinaciones[0] || "");
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [palabras, setPalabras] = useState<number>(250);
  const [archivoNombre, setArchivoNombre] = useState("");

  // Contact form state
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");
  const [notas, setNotas] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const selectorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const estimated = getEstimatedPrice(combinacion, palabras);
  const tipoLabel =
    DOCUMENT_CATEGORIES.find((c) => c.id === tipoSeleccionado)?.label || "";

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivoNombre(file.name);

    // Count words from text-based files
    const reader = new FileReader();
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const count = text.trim().split(/\s+/).filter(Boolean).length;
        if (count > 0) setPalabras(count);
      };
      reader.readAsText(file);
    } else {
      // For PDF/DOCX we can't easily count in the browser without heavy libs.
      // Keep the filename, user enters words manually.
      // TODO: add client-side PDF text extraction if needed
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAñadir() {
    if (!tipoSeleccionado || palabras < 1) return;
    añadir({
      tipo: tipoSeleccionado,
      tipoLabel,
      combinacion,
      palabras,
      precioEstimado: estimated.total,
      archivoNombre: archivoNombre || undefined,
    });
    setTipoSeleccionado("");
    setPalabras(250);
    setArchivoNombre("");
  }

  function scrollAlSelector() {
    selectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildResumenCarrito(carritoItems: ItemCarrito[], carritoTotal: number, emailCliente: string) {
    const lineas = carritoItems.map(
      (it, i) =>
        `${i + 1}. ${it.tipoLabel} (${it.combinacion.toUpperCase()}) ~${it.palabras} pal. ~${it.precioEstimado.toFixed(2)}€`
    );
    return `Hola, quiero presupuesto para:\n${lineas.join("\n")}\nTotal estimado: ~${carritoTotal.toFixed(2)}€\nEmail: ${emailCliente}`;
  }

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    setToast(null);

    if (!aceptaPrivacidad) {
      setToast({
        type: "error",
        message: "Debes aceptar la política de privacidad para continuar.",
      });
      return;
    }

    if (items.length === 0) {
      setToast({
        type: "error",
        message: "Añade al menos un documento al presupuesto.",
      });
      return;
    }

    setLoading(true);

    try {
      const payload = {
        documentos: items.map((it) => ({
          tipo: it.tipo,
          tipoLabel: it.tipoLabel,
          combinacion: it.combinacion,
          palabras: it.palabras,
          precioEstimado: it.precioEstimado,
          archivoNombre: it.archivoNombre || undefined,
        })),
        contacto: {
          email,
          telefono: telefono || undefined,
          fechaLimite: fechaLimite || undefined,
          notas: notas || undefined,
        },
        metadata: {
          idioma,
          paginaOrigen: typeof window !== "undefined" ? window.location.pathname : "",
          timestamp: new Date().toISOString(),
        },
        website, // honeypot
      };

      const res = await fetch("/api/presupuesto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al enviar la solicitud");
      }

      setToast({
        type: "success",
        message: data.referencia
          ? `Solicitud recibida (${data.referencia}). Te responderemos en menos de 2 horas laborables.`
          : "Solicitud recibida. Te responderemos en menos de 2 horas laborables.",
      });

      vaciar();
      setEmail("");
      setTelefono("");
      setFechaLimite("");
      setNotas("");
      setAceptaPrivacidad(false);

      setTimeout(() => setToast(null), 6000);
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Error al enviar la solicitud";
      setToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed inset-x-0 top-20 z-[200] mx-auto w-[90%] max-w-md rounded-2xl px-4 py-3 text-sm shadow-lg ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p>{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="ml-2 text-xs font-semibold underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* A) SELECTOR DE DOCUMENTO */}
      <section
        ref={selectorRef}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">
          Estima tu presupuesto en segundos
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Precio orientativo · ~{precioPorPalabra.toFixed(2)} €/palabra · IVA
          exento
        </p>

        {/* Combinación */}
        <div className="mt-4">
          <label
            htmlFor="combinacion"
            className="block text-sm font-medium text-slate-700"
          >
            Combinación de idiomas
          </label>
          <select
            id="combinacion"
            value={combinacion}
            onChange={(e) => setCombinacion(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm sm:w-auto"
          >
            {combinaciones.map((c) => (
              <option key={c} value={c}>
                {c.toUpperCase().replace("-", " → ")}
              </option>
            ))}
          </select>
        </div>

        {/* Tipo de documento grid */}
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">
            Tipo de documento
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DOCUMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTipoSeleccionado(cat.id)}
                className={`rounded-2xl border px-3 py-2 text-left text-xs transition-colors ${
                  tipoSeleccionado === cat.id
                    ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-800"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
                }`}
              >
                <span className="block font-medium">{cat.label}</span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {cat.examples}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Palabras + archivo + precio */}
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="palabras"
              className="block text-sm font-medium text-slate-700"
            >
              Palabras aproximadas
            </label>
            <input
              id="palabras"
              type="number"
              min={1}
              max={100000}
              value={palabras}
              onChange={(e) => setPalabras(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-28 rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">
              O sube un archivo
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt"
              onChange={handleFileUpload}
              className="mt-1 block text-xs text-slate-600"
            />
            {archivoNombre && (
              <p className="mt-1 text-xs text-slate-500">
                {archivoNombre}
              </p>
            )}
          </div>
          <div className="text-sm">
            <span className="text-slate-500">Precio estimado: </span>
            <span className="text-lg font-bold text-emerald-700">
              {estimated.total.toFixed(2)} €
            </span>
          </div>
        </div>

        {/* Botón añadir */}
        <button
          type="button"
          onClick={handleAñadir}
          disabled={!tipoSeleccionado || palabras < 1}
          className="mt-4 rounded-2xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Añadir al presupuesto
        </button>
      </section>

      {/* B) LISTA DEL CARRITO */}
      {items.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Tu presupuesto ({items.length}{" "}
            {items.length === 1 ? "documento" : "documentos"})
          </h2>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2 pr-2">Tipo</th>
                  <th className="pb-2 pr-2">Comb.</th>
                  <th className="pb-2 pr-2 text-right">~Palabras</th>
                  <th className="pb-2 pr-2 text-right">~Precio</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr
                    key={it.id}
                    className="border-b border-slate-100 text-slate-700"
                  >
                    <td className="py-2 pr-2 text-xs text-slate-400">
                      {idx + 1}
                    </td>
                    <td className="py-2 pr-2">
                      {it.tipoLabel}
                      {it.archivoNombre && (
                        <span className="ml-1 text-[11px] text-slate-400">
                          {it.archivoNombre}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-xs">
                      {it.combinacion.toUpperCase()}
                    </td>
                    <td className="py-2 pr-2 text-right">{it.palabras}</td>
                    <td className="py-2 pr-2 text-right font-medium">
                      {it.precioEstimado.toFixed(2)} €
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => eliminar(it.id)}
                        className="rounded-lg border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100"
                      >
                        x
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-xs text-slate-500">
              IVA exento · precio final tras revisión del traductor
            </p>
            <p className="text-lg font-bold text-emerald-700">
              ~{total.toFixed(2)} €
            </p>
          </div>

          <button
            type="button"
            onClick={scrollAlSelector}
            className="mt-3 text-sm font-medium text-emerald-700 hover:underline"
          >
            + Añadir otro documento
          </button>
        </section>
      )}

      {/* C) FORMULARIO DE CONTACTO Y ENVÍO */}
      {items.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Datos de contacto y envío
          </h2>

          <form onSubmit={handleEnviar} className="mt-4 space-y-4 text-sm">
            <div>
              <label
                htmlFor="carrito-email"
                className="block font-medium text-slate-700"
              >
                Email *
              </label>
              <input
                id="carrito-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="carrito-tel"
                  className="block font-medium text-slate-700"
                >
                  Teléfono / WhatsApp (opcional)
                </label>
                <input
                  id="carrito-tel"
                  type="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="carrito-fecha"
                  className="block font-medium text-slate-700"
                >
                  ¿Fecha límite? (opcional)
                </label>
                <input
                  id="carrito-fecha"
                  type="date"
                  value={fechaLimite}
                  onChange={(e) => setFechaLimite(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="carrito-notas"
                className="block font-medium text-slate-700"
              >
                Notas (opcional)
              </label>
              <textarea
                id="carrito-notas"
                rows={2}
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Indica tu trámite, plazos o cualquier detalle relevante"
              />
            </div>

            {/* Honeypot */}
            <div className="hidden">
              <label htmlFor="carrito-website">No rellenar</label>
              <input
                id="carrito-website"
                name="website"
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                autoComplete="off"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-600">
              <input
                id="carrito-privacidad"
                type="checkbox"
                checked={aceptaPrivacidad}
                onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <label htmlFor="carrito-privacidad">
                Acepto la{" "}
                <Link
                  href="/privacidad"
                  className="text-emerald-700 hover:underline"
                >
                  política de privacidad
                </Link>{" "}
                y el tratamiento de mis datos para responder a mi solicitud.
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Enviando..." : "Enviar para revisión"}
              </button>

              <a
                href={buildWhatsAppLinkFromText(
                  buildResumenCarrito(items, total, email)
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-100"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
