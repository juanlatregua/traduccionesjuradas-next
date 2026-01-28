// app/presupuesto/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";

type ToastState =
  | { type: "success" | "error"; message: string }
  | null;

export default function PresupuestoPage() {
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
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const MAX_FILE_SIZE_MB = 15;
  const ACCEPTED_MIMES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target as any;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    addFiles(selected);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const addFiles = (incoming: File[]) => {
    const validated: File[] = [];

    for (const file of incoming) {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_FILE_SIZE_MB) {
        setToast({
          type: "error",
          message: `El archivo ${file.name} supera ${MAX_FILE_SIZE_MB} MB.`,
        });
        continue;
      }

      if (
        file.type &&
        !ACCEPTED_MIMES.includes(file.type) &&
        !file.name.toLowerCase().endsWith(".pdf") // fallback por si el navegador no da mime
      ) {
        setToast({
          type: "error",
          message: `Formato no permitido: ${file.name}. Usa PDF, JPG, PNG o WEBP.`,
        });
        continue;
      }

      validated.push(file);
    }

    if (validated.length > 0) {
      setFiles((prev) => [...prev, ...validated]);
    }
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

      setToast({
        type: "success",
        message:
          "Hemos recibido tu solicitud con los documentos. Te responderemos por email en breve.",
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
    <main className="relative mx-auto max-w-3xl px-4 py-12">
      {/* TOAST */}
      {toast && (
        <div
          className={`fixed inset-x-0 top-4 mx-auto w-[90%] max-w-md rounded-2xl px-4 py-3 text-sm shadow-lg ${
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
        Solicitar presupuesto
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Adjunta tu documento (PDF o foto) y te enviaremos un presupuesto por
        email.
      </p>

      <form
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="mt-6 space-y-4 text-sm"
      >
        <div>
          <label className="block text-slate-700" htmlFor="nombre">
            Nombre y apellidos
          </label>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            value={form.nombre}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-slate-700" htmlFor="idiomaOrigen">
              Idioma de origen
            </label>
            <input
              id="idiomaOrigen"
              name="idiomaOrigen"
              type="text"
              placeholder="Por ejemplo: francés"
              value={form.idiomaOrigen}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-700" htmlFor="idiomaDestino">
              Idioma de destino
            </label>
            <input
              id="idiomaDestino"
              name="idiomaDestino"
              type="text"
              placeholder="Por ejemplo: español"
              value={form.idiomaDestino}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
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

        <div>
          <label className="block text-slate-700" htmlFor="plazo">
            Plazo aproximado
          </label>
          <input
            id="plazo"
            name="plazo"
            type="text"
            placeholder="Normal, urgente, fecha límite…"
            value={form.plazo}
            onChange={handleChange}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {/* ADJUNTOS */}
        {/* ADJUNTOS */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-slate-800 font-semibold" htmlFor="files">
            Adjuntar documentos (PDF o fotos)
          </label>
          <p className="mt-1 text-xs text-slate-600">
            Arrastra y suelta o selecciona archivos. Formatos permitidos: PDF, JPG, PNG o WEBP. Máx. {MAX_FILE_SIZE_MB} MB por archivo.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const dropped = Array.from(e.dataTransfer.files || []);
              addFiles(dropped);
            }}
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs transition ${
              isDragging ? "border-emerald-400 bg-white" : "border-slate-300 bg-white/80"
            }`}
            onClick={() => document.getElementById("files")?.click()}
          >
            <span className="text-base">📄⬆️</span>
            <p className="mt-2 font-semibold text-slate-800">
              Arrastra tus archivos aquí o haz clic para buscarlos
            </p>
            <p className="mt-1 text-slate-500">
              Preferible: PDF nítido o foto completa con sellos visibles.
            </p>
            <input
              id="files"
              name="files"
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFilesChange}
              className="hidden"
            />
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <ul className="list-disc space-y-1 rounded-xl bg-white px-3 py-3 text-xs text-slate-700">
              <li>Foto completa, sin recortes ni sombras.</li>
              <li>Que se lean sellos y márgenes.</li>
              <li>Si hay varias páginas, súbelas todas.</li>
              <li>Formato preferido: PDF; también JPG/PNG.</li>
            </ul>
            <div className="rounded-xl bg-emerald-50 px-3 py-3 text-xs text-emerald-800">
              <p className="font-semibold">Seguridad de envío</p>
              <p className="mt-1">
                Los archivos se envían cifrados (HTTPS) y solo se usan para preparar tu
                presupuesto. Si lo prefieres, puedes enviarlos por email o WeTransfer
                indicando tu nombre.
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <ul className="mt-4 space-y-2">
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

        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded-2xl bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>
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

      {/* Testimonios */}
      <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-700">
              Opiniones verificadas
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Clientes que ya tradujeron con nosotros
            </h2>
            <p className="text-xs text-slate-500">
              Basado en reseñas reales de Google.
            </p>
          </div>
          <div className="hidden items-center gap-1 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:flex">
            <span>⭐️⭐️⭐️⭐️⭐️</span>
            <span>5.0</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            {
              nombre: "Gabriella Calderón",
              servicio: "Traducción jurada de portugués",
              texto:
                "Encargué la traducción de unos documentos desde Brasil y el servicio fue rápido y eficiente. ¡Los recomiendo!",
              rating: 5,
              ciudad: "Brasil → España",
            },
            {
              nombre: "Nazarith Rodríguez",
              servicio: "Traducción jurada de inglés",
              texto:
                "Totalmente recomendables, amables y cumplen su trabajo a tiempo.",
              rating: 5,
              ciudad: "",
            },
            {
              nombre: "Jacob Malka",
              servicio: "Traducción jurada de inglés",
              texto:
                "Excelente servicio de traducción. Muy profesional y siempre puntual. Precios competitivos. Muy recomendable.",
              rating: 5,
              ciudad: "",
            },
            {
              nombre: "Carmina Martín",
              servicio: "Traducción jurada de francés",
              texto:
                "Muy contenta con su trabajo. Envío rápido, precio aceptable, profesionales en los que se puede confiar. Totalmente recomendables.",
              rating: 5,
              ciudad: "",
            },
          ].map((item, idx) => (
            <article
              key={item.nombre + idx}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-900">{item.nombre}</div>
                <span className="text-xs text-emerald-700">
                  {"⭐️".repeat(item.rating)}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.servicio}</p>
              <p className="mt-2 leading-relaxed">{item.texto}</p>
              {item.ciudad && (
                <p className="mt-2 text-xs text-slate-500">{item.ciudad}</p>
              )}
            </article>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-500">
          Puedes pedir referencias o ver más reseñas completas en Google; te las enviaremos con el presupuesto si lo necesitas.
        </p>
      </section>
    </main>
  );
}
