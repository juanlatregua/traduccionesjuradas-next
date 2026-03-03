"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  DOCUMENT_CATEGORIES,
  getEstimatedPrice,
} from "@/lib/language-config";
import { getFixedPrice } from "@/lib/fixed-prices";
import { buildWhatsAppLinkFromText, getTrackedConsultaUrl } from "@/lib/contact";
import {
  getEstimatedDeliveryDate,
  formatDeliveryDate,
  formatDateForInput,
  isUrgent,
} from "@/lib/delivery-date";
import {
  useCarritoPresupuesto,
  type ItemCarrito,
} from "@/hooks/useCarritoPresupuesto";

type Props = {
  idioma: string;
  combinaciones: string[];
};

const IVA = 1.21;
const ULTIMO_PEDIDO_KEY = "tj-ultimo-pedido";
const ULTIMO_PEDIDO_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function getUltimoPedido(): { referencia: string; email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ULTIMO_PEDIDO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > ULTIMO_PEDIDO_TTL_MS) {
      localStorage.removeItem(ULTIMO_PEDIDO_KEY);
      return null;
    }
    return { referencia: parsed.referencia, email: parsed.email };
  } catch {
    return null;
  }
}

function guardarUltimoPedido(referencia: string, email: string) {
  try {
    localStorage.setItem(
      ULTIMO_PEDIDO_KEY,
      JSON.stringify({ referencia, email, timestamp: Date.now() })
    );
  } catch {}
}

function borrarUltimoPedido() {
  try {
    localStorage.removeItem(ULTIMO_PEDIDO_KEY);
  } catch {}
}

export default function EstimadorCarrito({
  idioma,
  combinaciones,
}: Props) {
  const { items, añadir, eliminar, vaciar, total } =
    useCarritoPresupuesto();

  // Selector state
  const [combinacion, setCombinacion] = useState(combinaciones[0] || "");
  const [tipoSeleccionado, setTipoSeleccionado] = useState("");
  const [palabras, setPalabras] = useState<number>(0);
  const [archivoNombre, setArchivoNombre] = useState("");

  // File upload + extraction state
  const [archivo, setArchivo] = useState<File | null>(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [palabrasExtraidas, setPalabrasExtraidas] = useState<number | null>(null);
  const [errorExtraccion, setErrorExtraccion] = useState("");
  const [usandoPrecioFijo, setUsandoPrecioFijo] = useState(false);

  // Contact form state (inline in carrito)
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [fechaLimite, setFechaLimite] = useState(() =>
    formatDateForInput(getEstimatedDeliveryDate())
  );
  const [notas, setNotas] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [loading, setLoading] = useState(false);

  // Post-envío: pedido creado (se recupera de localStorage si existe)
  const [pedidoCreado, setPedidoCreado] = useState<{
    referencia: string;
    email: string;
  } | null>(null);
  const [errorEnvio, setErrorEnvio] = useState("");

  // Recuperar pedido reciente de localStorage al montar
  useEffect(() => {
    const ultimo = getUltimoPedido();
    if (ultimo) setPedidoCreado(ultimo);
  }, []);

  const selectorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const precioFijo = getFixedPrice(combinacion, tipoSeleccionado);
  const estimated = getEstimatedPrice(combinacion, palabras);
  const tipoLabel =
    DOCUMENT_CATEGORIES.find((c) => c.id === tipoSeleccionado)?.label || "";

  const fechaEntregaEstimada = useMemo(() => getEstimatedDeliveryDate(), []);
  const esUrgente = fechaLimite ? isUrgent(fechaLimite, fechaEntregaEstimada) : false;

  // Determine which price to show (IVA incluido)
  const precioMostrado = usandoPrecioFijo && precioFijo !== null
    ? Math.round(precioFijo * IVA * 100) / 100
    : palabrasExtraidas !== null
      ? Math.round(estimated.total * IVA * 100) / 100
      : palabras > 0
        ? Math.round(estimated.total * IVA * 100) / 100
        : null;

  async function handleSubirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivo(file);
    setArchivoNombre(file.name);
    setPalabrasExtraidas(null);
    setErrorExtraccion("");
    setUsandoPrecioFijo(false);

    // Auto-extract words
    setExtrayendo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("lang", combinacion);
      fd.append("urgency", "normal");
      const res = await fetch("/api/estimador", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.ok && data.words > 0) {
        setPalabrasExtraidas(data.words);
        setPalabras(data.words);
      } else {
        setErrorExtraccion(
          "No hemos podido extraer las palabras automáticamente. Puedes indicarlas manualmente o enviar el documento tal cual."
        );
      }
    } catch {
      setErrorExtraccion(
        "Error al analizar el archivo. Puedes indicar las palabras manualmente."
      );
    } finally {
      setExtrayendo(false);
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSeleccionarPrecioFijo() {
    setUsandoPrecioFijo(true);
    setPalabrasExtraidas(null);
    setArchivo(null);
    setArchivoNombre("");
    setErrorExtraccion("");
  }

  function handleAñadir() {
    if (!tipoSeleccionado) return;

    if (usandoPrecioFijo && precioFijo !== null) {
      añadir({
        tipo: tipoSeleccionado,
        tipoLabel,
        combinacion,
        palabras: 0,
        precioEstimado: Math.round(precioFijo * IVA * 100) / 100,
        archivoNombre: archivoNombre || undefined,
        precioFijo: true,
      });
    } else if (palabrasExtraidas !== null || palabras > 0) {
      añadir({
        tipo: tipoSeleccionado,
        tipoLabel,
        combinacion,
        palabras,
        precioEstimado: Math.round(estimated.total * IVA * 100) / 100,
        archivoNombre: archivoNombre || undefined,
      });
    } else {
      // Sin precio: el traductor lo cotiza manualmente
      añadir({
        tipo: tipoSeleccionado,
        tipoLabel,
        combinacion,
        palabras: 0,
        precioEstimado: 0,
        archivoNombre: archivoNombre || undefined,
        sinPrecio: true,
      });
    }

    // Reset selector
    setTipoSeleccionado("");
    setPalabras(0);
    setArchivoNombre("");
    setArchivo(null);
    setPalabrasExtraidas(null);
    setErrorExtraccion("");
    setUsandoPrecioFijo(false);
  }

  function scrollAlSelector() {
    selectorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildResumenCarrito(
    referencia: string,
    carritoItems: ItemCarrito[],
    carritoTotal: number,
  ) {
    const lineas = carritoItems.map((it, i) =>
      it.sinPrecio
        ? `${i + 1}. ${it.tipoLabel} (${it.combinacion.toUpperCase()}) - precio a confirmar`
        : `${i + 1}. ${it.tipoLabel} (${it.combinacion.toUpperCase()}) ~${it.precioEstimado.toFixed(2)}€`
    );
    let msg = `Hola, he solicitado presupuesto (ref. ${referencia}) para:\n${lineas.join("\n")}`;
    if (carritoTotal > 0) msg += `\nTotal estimado: ~${carritoTotal.toFixed(2)}€ (IVA incl.)`;
    msg += `\n\nMi solicitud: ${getTrackedConsultaUrl(referencia)}`;
    msg += `\n\n¿Me podéis confirmar precio y plazo?`;
    return msg;
  }

  async function handleSolicitar(e: React.FormEvent) {
    e.preventDefault();
    setErrorEnvio("");

    if (!aceptaPrivacidad) {
      setErrorEnvio("Debes aceptar la política de privacidad para continuar.");
      return;
    }

    if (items.length === 0) {
      setErrorEnvio("Añade al menos un documento al presupuesto.");
      return;
    }

    setLoading(true);

    try {
      // Auto-add urgente note if deadline is before estimated delivery
      let notasFinales = notas;
      if (esUrgente && fechaLimite) {
        const urgNote = `URGENTE: cliente solicita entrega antes del ${fechaLimite}.`;
        notasFinales = notasFinales ? `${urgNote} ${notasFinales}` : urgNote;
      }

      const payload = {
        documentos: items.map((it) => ({
          tipo: it.tipo,
          tipoLabel: it.tipoLabel,
          combinacion: it.combinacion,
          palabras: it.palabras,
          precioEstimado: it.precioEstimado,
          archivoNombre: it.archivoNombre || undefined,
          sinPrecio: it.sinPrecio || undefined,
          precioFijo: it.precioFijo || undefined,
        })),
        contacto: {
          email,
          telefono: telefono || undefined,
          fechaLimite: fechaLimite || undefined,
          notas: notasFinales || undefined,
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

      const ref = data.referencia || "";
      setPedidoCreado({ referencia: ref, email });
      guardarUltimoPedido(ref, email);
      vaciar();
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Error al enviar la solicitud";
      setErrorEnvio(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleNuevoPresupuesto() {
    setPedidoCreado(null);
    borrarUltimoPedido();
    vaciar();
    setEmail("");
    setTelefono("");
    setFechaLimite(formatDateForInput(getEstimatedDeliveryDate()));
    setNotas("");
    setAceptaPrivacidad(false);
    setErrorEnvio("");
    scrollAlSelector();
  }

  return (
    <div className="mt-8 space-y-6">
      {/* A) SELECTOR DE DOCUMENTO */}
      <section
        ref={selectorRef}
        className="rounded-2xl border border-cream bg-card p-4 shadow-sm sm:p-6"
      >
        <h2 className="text-lg font-semibold text-encre">
          Estima tu presupuesto en segundos
        </h2>
        <p className="mt-1 text-xs text-graphite">
          Precio cerrado · el precio final se confirma
          tras revisión del traductor
        </p>

        {/* Combinación */}
        <div className="mt-4">
          <label
            htmlFor="combinacion"
            className="block text-sm font-medium text-sepia"
          >
            Combinación de idiomas
          </label>
          <select
            id="combinacion"
            value={combinacion}
            onChange={(e) => {
              setCombinacion(e.target.value);
              setUsandoPrecioFijo(false);
              setPalabrasExtraidas(null);
            }}
            className="mt-1 w-full rounded-xl border border-cream px-3 py-2 text-sm sm:w-auto"
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
          <p className="text-sm font-medium text-sepia">
            Tipo de documento
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {DOCUMENT_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setTipoSeleccionado(cat.id);
                  setUsandoPrecioFijo(false);
                  setPalabrasExtraidas(null);
                  setErrorExtraccion("");
                }}
                className={`rounded-2xl border px-3 py-2 text-left text-xs transition-colors ${
                  tipoSeleccionado === cat.id
                    ? "border-bleu bg-cream font-semibold text-bleu"
                    : "border-cream bg-parchment text-sepia hover:border-cream"
                }`}
              >
                <span className="block font-medium">{cat.label}</span>
                <span className="mt-0.5 block text-[11px] text-graphite">
                  {cat.examples}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Precio fijo disponible */}
        {tipoSeleccionado && precioFijo !== null && (
          <div className="mt-4 rounded-2xl border border-cream bg-cream p-4">
            <p className="text-sm font-semibold text-bleu">
              Documento estándar (~1 hoja):{" "}
              <span className="text-lg">{(Math.round(precioFijo * IVA * 100) / 100).toFixed(2)} €</span>
            </p>
            <p className="mt-1 text-xs text-sepia">
              Precio cerrado para certificados, antecedentes y títulos de una hoja.
              Recto/verso no cuenta como dos hojas.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSeleccionarPrecioFijo}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm ${
                  usandoPrecioFijo
                    ? "bg-bleu text-white"
                    : "border border-bleu/30 bg-card text-bleu hover:bg-cream"
                }`}
              >
                Usar precio cerrado ({(Math.round(precioFijo * IVA * 100) / 100).toFixed(2)} €)
              </button>
            </div>
            <p className="mt-2 text-xs text-graphite">
              ¿Tu documento tiene más de 1 hoja o es atípico?
              Sube el archivo más abajo para un presupuesto personalizado.
            </p>
          </div>
        )}

        {/* Subida de archivo (principal) */}
        {tipoSeleccionado && !usandoPrecioFijo && (
          <div className="mt-4 rounded-2xl border border-cream bg-parchment p-4">
            <p className="text-sm font-medium text-sepia">
              {precioFijo !== null
                ? "Sube tu documento para presupuesto personalizado"
                : "Sube tu documento para calcular el precio"}
            </p>
            <p className="mt-1 text-xs text-graphite">
              PDF, DOCX, JPG o PNG. Analizamos el documento y te damos precio estimado al instante.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png"
              onChange={handleSubirArchivo}
              className="mt-2 block text-xs text-sepia file:mr-3 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-sepia"
            />

            {extrayendo && (
              <p className="mt-2 text-sm text-bleu">
                Analizando documento...
              </p>
            )}

            {palabrasExtraidas !== null && (
              <div className="mt-3 rounded-xl border border-cream bg-cream p-3">
                <p className="text-sm text-sepia">
                  {archivoNombre} · {palabrasExtraidas} palabras detectadas
                </p>
                <p className="mt-1">
                  <span className="text-graphite">Precio estimado: </span>
                  <span className="text-lg font-bold text-bleu">
                    {(Math.round(estimated.total * IVA * 100) / 100).toFixed(2)} €
                  </span>
                  <span className="ml-1 text-xs text-graphite">IVA incl.</span>
                </p>
              </div>
            )}

            {errorExtraccion && (
              <p className="mt-2 text-xs text-amber-700">
                {errorExtraccion}
              </p>
            )}

            {/* Entrada manual de palabras (colapsable) */}
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-sepia hover:text-encre">
                ¿Sabes las palabras? Introdúcelas manualmente
              </summary>
              <div className="mt-2 flex items-end gap-3">
                <div>
                  <label
                    htmlFor="palabras-manual"
                    className="block text-xs font-medium text-sepia"
                  >
                    Palabras aproximadas
                  </label>
                  <input
                    id="palabras-manual"
                    type="number"
                    min={1}
                    max={100000}
                    value={palabras || ""}
                    placeholder="0"
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPalabras(v > 0 ? v : 0);
                      setPalabrasExtraidas(null);
                    }}
                    className="mt-1 w-28 rounded-xl border border-cream px-3 py-2 text-sm"
                  />
                </div>
                {palabras > 0 && (
                  <div className="text-sm">
                    <span className="text-graphite">Precio estimado: </span>
                    <span className="text-lg font-bold text-bleu">
                      {(Math.round(estimated.total * IVA * 100) / 100).toFixed(2)} €
                    </span>
                    <span className="ml-1 text-xs text-graphite">IVA incl.</span>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Precio mostrado (resumen) */}
        {tipoSeleccionado && precioMostrado !== null && precioMostrado > 0 && (
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-sm text-graphite">Total estimado:</span>
            <span className="text-xl font-bold text-bleu">
              {precioMostrado.toFixed(2)} €
            </span>
            {usandoPrecioFijo && (
              <span className="text-xs text-bleu">(precio cerrado)</span>
            )}
          </div>
        )}

        {/* Botón añadir */}
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleAñadir}
            disabled={!tipoSeleccionado}
            className="rounded-2xl bg-bleu px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Añadir al presupuesto
          </button>
          {tipoSeleccionado && !usandoPrecioFijo && !palabrasExtraidas && precioFijo === null && (
            <button
              type="button"
              onClick={handleAñadir}
              className="rounded-2xl border border-cream px-4 py-2 text-sm font-medium text-sepia hover:bg-cream"
            >
              Añadir sin precio (lo cotizamos nosotros)
            </button>
          )}
        </div>
      </section>

      {/* B) CARRITO + SOLICITUD / CONFIRMACIÓN */}
      {(items.length > 0 || pedidoCreado) && (
        <section className="rounded-2xl border border-cream bg-card p-4 shadow-sm sm:p-6">
          {pedidoCreado ? (
            /* ── PANEL DE CONFIRMACIÓN ── */
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-xl text-bleu">
                  ✓
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-encre">
                    Solicitud{" "}
                    {pedidoCreado.referencia && (
                      <span className="text-bleu">{pedidoCreado.referencia}</span>
                    )}{" "}
                    recibida
                  </h2>
                  <p className="mt-1 text-sm text-sepia">
                    Hemos recibido tu solicitud. Te enviaremos el presupuesto
                    definitivo por email a{" "}
                    <span className="font-medium">{pedidoCreado.email}</span>.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/consulta?ref=${encodeURIComponent(pedidoCreado.referencia)}&email=${encodeURIComponent(pedidoCreado.email)}`}
                  className="rounded-2xl bg-bleu px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-bleu-dark"
                >
                  Ver mi solicitud
                </Link>
                <a
                  href={buildWhatsAppLinkFromText(
                    buildResumenCarrito(pedidoCreado.referencia, items, total)
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-2xl border border-bleu/30 bg-cream px-4 py-2 text-sm font-semibold text-bleu hover:bg-cream"
                >
                  Escribir por WhatsApp
                </a>
              </div>

              <button
                type="button"
                onClick={handleNuevoPresupuesto}
                className="mt-2 text-sm font-medium text-graphite hover:text-bleu hover:underline"
              >
                Solicitar otro presupuesto
              </button>
            </div>
          ) : (
            /* ── CARRITO + FORMULARIO INLINE ── */
            <>
              <h2 className="text-lg font-semibold text-encre">
                Tu presupuesto ({items.length}{" "}
                {items.length === 1 ? "documento" : "documentos"})
              </h2>

              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-cream text-xs text-graphite">
                      <th className="pb-2 pr-2">#</th>
                      <th className="pb-2 pr-2">Tipo</th>
                      <th className="pb-2 pr-2">Comb.</th>
                      <th className="pb-2 pr-2 text-right">~Precio</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr
                        key={it.id}
                        className="border-b border-cream text-sepia"
                      >
                        <td className="py-2 pr-2 text-xs text-graphite">
                          {idx + 1}
                        </td>
                        <td className="py-2 pr-2">
                          {it.tipoLabel}
                          {it.archivoNombre && (
                            <span className="ml-1 text-[11px] text-graphite">
                              {it.archivoNombre}
                            </span>
                          )}
                          {it.precioFijo && (
                            <span className="ml-1 text-[11px] text-bleu">
                              precio cerrado
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-2 text-xs">
                          {it.combinacion.toUpperCase()}
                        </td>
                        <td className="py-2 pr-2 text-right font-medium">
                          {it.sinPrecio
                            ? "A confirmar"
                            : `${it.precioEstimado.toFixed(2)} €`}
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => eliminar(it.id)}
                            className="rounded-lg border border-cream px-2 py-0.5 text-[11px] text-sepia hover:bg-cream"
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
                <p className="text-xs text-graphite">
                  IVA incluido · precio final tras revisión del traductor
                </p>
                <p className="text-lg font-bold text-bleu">
                  {total > 0 ? `~${total.toFixed(2)} €` : "Precio a confirmar"}
                </p>
              </div>

              {/* Formulario inline: email + privacidad + opcionales */}
              <form onSubmit={handleSolicitar} className="mt-5 space-y-4 border-t border-cream pt-5 text-sm">
                <div>
                  <label
                    htmlFor="carrito-email"
                    className="block font-medium text-sepia"
                  >
                    Email *
                  </label>
                  <input
                    id="carrito-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-cream px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs text-sepia">
                  <input
                    id="carrito-privacidad"
                    type="checkbox"
                    checked={aceptaPrivacidad}
                    onChange={(e) => setAceptaPrivacidad(e.target.checked)}
                    className="h-4 w-4 rounded border-cream"
                  />
                  <label htmlFor="carrito-privacidad">
                    Acepto la{" "}
                    <Link
                      href="/privacidad"
                      className="text-bleu hover:underline"
                    >
                      política de privacidad
                    </Link>{" "}
                    y el tratamiento de mis datos para responder a mi solicitud.
                  </label>
                </div>

                {/* Campos opcionales colapsables */}
                <details>
                  <summary className="cursor-pointer text-xs font-medium text-sepia hover:text-encre">
                    Teléfono, fecha de entrega, notas (opcional)
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <label
                        htmlFor="carrito-tel"
                        className="block font-medium text-sepia"
                      >
                        Teléfono / WhatsApp
                      </label>
                      <input
                        id="carrito-tel"
                        type="tel"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-cream px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="carrito-fecha"
                        className="block font-medium text-sepia"
                      >
                        Fecha de entrega deseada
                      </label>
                      <input
                        id="carrito-fecha"
                        type="date"
                        value={fechaLimite}
                        onChange={(e) => setFechaLimite(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-cream px-3 py-2 text-sm"
                      />
                      <p className="mt-1 text-xs text-graphite">
                        Entrega estándar estimada:{" "}
                        <span className="font-medium">
                          {formatDeliveryDate(fechaEntregaEstimada)}
                        </span>
                      </p>
                      {esUrgente && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Fecha anterior a la entrega estándar. Marcaremos tu solicitud como urgente
                          para confirmar disponibilidad (sin coste adicional).
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="carrito-notas"
                        className="block font-medium text-sepia"
                      >
                        Notas
                      </label>
                      <textarea
                        id="carrito-notas"
                        rows={2}
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-cream px-3 py-2 text-sm"
                        placeholder="Indica tu trámite, plazos o cualquier detalle relevante"
                      />
                    </div>
                  </div>
                </details>

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

                {/* Error inline */}
                {errorEnvio && (
                  <p className="text-sm text-red-600">{errorEnvio}</p>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-2xl bg-bleu px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? "Enviando..." : "Solicitar presupuesto"}
                  </button>
                  <button
                    type="button"
                    onClick={scrollAlSelector}
                    className="text-sm font-medium text-bleu hover:underline"
                  >
                    + Añadir otro documento
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}
