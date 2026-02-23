// app/presupuesto/page.tsx
"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type ToastState =
  | { type: "success" | "error"; message: string }
  | null;

export default function PresupuestoPage() {
  const LANGUAGE_OPTIONS = [
    "Español",
    "Inglés",
    "Francés",
    "Alemán",
    "Italiano",
    "Portugués",
    "Catalán",
    "Neerlandés",
    "Noruego",
    "Sueco",
    "Otro",
  ];

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    telefono: "",
    idiomaOrigen: "",
    idiomaDestino: "",
    tipoDocumento: "",
    plazo: "",
    aceptaPrivacidad: false,
    website: "", // honeypot
  });

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const handleChange = (
    e:
      | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      | React.ChangeEvent<HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as any;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    setFiles(selected);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setToast(null);

    if (!form.aceptaPrivacidad) {
      setToast({
        type: "error",
        message: "Debes aceptar la política de privacidad para continuar.",
      });
      return;
    }

    if (files.length === 0) {
      setToast({
        type: "error",
        message:
          "Te recomendamos adjuntar el documento (PDF o foto) para poder darte presupuesto sin reenvíos.",
      });
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();

      // Campos de texto
      Object.entries(form).forEach(([k, v]) => {
        fd.append(k, String(v));
      });

      // Adjuntos
      files.forEach((file) => {
        fd.append("files", file);
      });

      const res = await fetch("/api/presupuesto", {
        method: "POST",
        body: fd, // multipart automático
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al enviar el formulario");
      }

      const reference = typeof data.reference === "string" && data.reference.trim() ? data.reference.trim() : null;

      setToast({
        type: "success",
        message: reference
          ? `Hemos recibido tu solicitud (${reference}). Te responderemos por email en breve.`
          : "Hemos recibido tu solicitud con los documentos. Te responderemos por email en breve.",
      });

      // Reset form
      setForm({
        nombre: "",
        email: "",
        telefono: "",
        idiomaOrigen: "",
        idiomaDestino: "",
        tipoDocumento: "",
        plazo: "",
        aceptaPrivacidad: false,
        website: "",
      });
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      setTimeout(() => setToast(null), 5000);
    } catch (error: unknown) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[FORM] Error al enviar presupuesto:", error);
      }
      setToast({
        type: "error",
        message:
          "No se ha podido enviar tu solicitud en este momento. Inténtalo de nuevo o escríbenos por email.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative mx-auto max-w-3xl px-4 py-10 pb-24 sm:py-12 sm:pb-12">
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
            <span className="mt-0.5 text-lg">
              {toast.type === "success" ? "✅" : "⚠️"}
            </span>
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

      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Sube tu documento y calcula rápido
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Flujo simple: idioma, documento, archivos y envío. Te respondemos con precio y opciones de pago.
      </p>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pasos rápidos</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">1. Idiomas</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">2. Documento</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">3. Adjuntar</span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">4. Enviar</span>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Respuesta habitual en horario laboral: menos de 30 minutos.
        </p>
      </div>

      <form
        id="presupuesto-form"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="mt-6 space-y-4 text-sm"
      >
        <div>
          <label className="block text-slate-700" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={form.email}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-slate-700" htmlFor="idiomaOrigen">
              Idioma de origen
            </label>
            <select
              id="idiomaOrigen"
              name="idiomaOrigen"
              value={form.idiomaOrigen}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Selecciona idioma</option>
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={`origen-${lang}`} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-700" htmlFor="idiomaDestino">
              Idioma de destino
            </label>
            <select
              id="idiomaDestino"
              name="idiomaDestino"
              value={form.idiomaDestino}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Selecciona idioma</option>
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={`destino-${lang}`} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-700" htmlFor="tipoDocumento">
            Tipo de documento y número de páginas aproximado
          </label>
          <textarea
            id="tipoDocumento"
            name="tipoDocumento"
            required
            value={form.tipoDocumento}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            rows={3}
            placeholder="Certificado de nacimiento de 1 página, contrato de 5 páginas, etc."
          />
        </div>

        <details className="rounded-2xl border border-slate-200 bg-white p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
            Datos opcionales (nombre, teléfono, fecha límite)
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-slate-700" htmlFor="nombre">
                Nombre y apellidos
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                value={form.nombre}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-700" htmlFor="telefono">
                Teléfono
              </label>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                value={form.telefono}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-700" htmlFor="plazo">
                Fecha límite deseada
              </label>
              <input
                id="plazo"
                name="plazo"
                type="date"
                value={form.plazo}
                onChange={handleChange}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </details>

        {/* ADJUNTOS */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-slate-800 font-semibold" htmlFor="files">
            Adjuntar documentos (PDF o fotos)
          </label>
          <p className="mt-1 text-xs text-slate-600">
            Puedes adjuntar varios archivos. Recomendado: PDF, JPG o PNG.
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            Envío cifrado por HTTPS · Borramos los archivos 30 días después de la entrega (o antes si lo pides).
          </p>

          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFilesChange}
            className="mt-3 block w-full text-xs"
          />

          {files.length > 0 && (
            <ul className="mt-3 space-y-2">
              {files.map((f, idx) => (
                <li
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
                >
                  <span className="truncate">
                    {f.name}{" "}
                    <span className="text-slate-400">
                      ({Math.round(f.size / 1024)} KB)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="ml-3 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 🕵️‍♂️ HONEYPOT INVISIBLE */}
        <div className="hidden">
          <label htmlFor="website">No rellenar este campo</label>
          <input
            id="website"
            name="website"
            type="text"
            value={form.website}
            onChange={handleChange}
            autoComplete="off"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <input
            id="aceptaPrivacidad"
            name="aceptaPrivacidad"
            type="checkbox"
            checked={form.aceptaPrivacidad}
            onChange={handleChange}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span>
            Acepto la{" "}
            <Link href="/privacidad" className="text-emerald-700 hover:underline">
              política de privacidad
            </Link>{" "}
            y el tratamiento de mis datos para responder a mi solicitud.
          </span>
        </div>

        <div className="sticky bottom-3 z-10 sm:static">
          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 sm:mt-4 sm:w-auto sm:py-2"
          >
            {loading ? "Enviando..." : "Enviar solicitud"}
          </button>
        </div>
      </form>

      <p className="mt-6 text-xs text-slate-500">
        Si prefieres, también puedes enviar tus documentos por email a{" "}
        <a
          href="mailto:hola@traduccionesjuradas.net"
          className="text-emerald-700 hover:underline"
        >
          hola@traduccionesjuradas.net
        </a>
        .
      </p>

      {/* Mini FAQ */}
      <section className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
        <details>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
            Preguntas rápidas (actualizado enero 2026)
          </summary>
          <div className="mt-3 space-y-3">
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                ¿Vale la traducción en PDF o necesito papel?
              </summary>
              <p className="mt-2 text-sm text-slate-700">
                El PDF firmado digitalmente por el traductor jurado es válido para la mayoría de trámites.
                Si tu organismo pide papel, también podemos enviarlo por mensajería.
              </p>
            </details>
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                ¿Puedo mandar fotos en lugar de escaneo?
              </summary>
              <p className="mt-2 text-sm text-slate-700">
                Sí, siempre que sean nítidas, sin recortes y con sellos/márgenes visibles. Si hiciera falta,
                podemos pedir un escaneo mejor antes de entregar.
              </p>
            </details>
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                ¿Cómo se paga?
              </summary>
              <p className="mt-2 text-sm text-slate-700">
                Te enviaremos el presupuesto con las opciones de pago: transferencia, tarjeta, Bizum o PayPal.
                Para encargos urgentes solemos pedir el pago antes de empezar.
              </p>
            </details>
            <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                ¿Qué pasa con mis datos y documentos?
              </summary>
              <p className="mt-2 text-sm text-slate-700">
                Usamos tus archivos solo para preparar el presupuesto y la traducción. Viajan por HTTPS
                y se eliminan pasados 30 días desde la entrega, salvo obligación legal. Si quieres, puedes
                pedir el borrado inmediato tras recibir la traducción.
              </p>
            </details>
          </div>
        </details>
      </section>
    </main>
  );
}
