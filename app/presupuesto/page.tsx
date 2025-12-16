// app/presupuesto/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";

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

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type, checked } = e.target as any;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
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

    setLoading(true);
    try {
      const res = await fetch("/api/presupuesto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al enviar el formulario");
      }

      setToast({
        type: "success",
        message: "Hemos recibido tu solicitud. Te responderemos por email en breve.",
      });

      // Limpiar formulario (pero dejamos email por comodidad si quieres)
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

      // Ocultar toast tras unos segundos
      setTimeout(() => {
        setToast(null);
      }, 5000);
    } catch (error) {
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
          className={`fixed inset-x-0 top-4 mx-auto w-[90%] max-w-md rounded-2xl px-4 py-3 text-sm shadow-lg transition-transform ${
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
        Rellena este formulario y te enviaremos un presupuesto detallado por email.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-sm">
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
        También puedes enviarnos directamente tus documentos por email a{" "}
        <a
          href="mailto:hola@traduccionesjuradas.net"
          className="text-emerald-700 hover:underline"
        >
          hola@traduccionesjuradas.net
        </a>{" "}
        o por WhatsApp.
      </p>
    </main>
  );
}
