import Link from "next/link";
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";

export const metadata: Metadata = {
  title: "Traducción jurada online desde 40-75 € | PDF firmado en 24-72h",
  description:
    "Adjunta tu documento y recibe la traducción jurada online en PDF firmado. Precios orientativos desde 40-75 € y respuesta en <30 minutos en horario. Entrega 24-72h según idioma.",
};

const LANG_COMBOS = [
  { pair: "Español ↔ Inglés", price: "50 €", plazo: "24-48 h" },
  { pair: "Español ↔ Francés", price: "45 €", plazo: "24 h" },
  { pair: "Español ↔ Alemán", price: "55 €", plazo: "48-72 h" },
  { pair: "Español ↔ Italiano", price: "50 €", plazo: "24-48 h" },
  { pair: "Español ↔ Portugués", price: "45 €", plazo: "24 h" },
];

export default function TraduccionJuradaOnlinePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12 text-sm text-slate-700">
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://traduccionesjuradas.net/" },
          { name: "Traducción jurada online", url: "https://traduccionesjuradas.net/traduccion-jurada-online" },
        ]}
      />
      <SchemaFAQ
        items={[
          {
            question: "¿Recibo la traducción jurada en PDF o en papel?",
            answer: "La entregamos en PDF firmado y sellado; si necesitas papel, podemos enviarlo por mensajería.",
          },
          {
            question: "¿Qué plazos orientativos manejan?",
            answer: "Según idioma y páginas: 24-72 h. Por ejemplo, inglés 24-48 h, francés 24 h, alemán 48-72 h.",
          },
          {
            question: "¿Puedo enviar foto en lugar de escaneo?",
            answer: "Sí, siempre que sea nítida y con sellos visibles. Si hace falta, pediremos un escaneo antes de entregar.",
          },
          {
            question: "¿Cómo pago?",
            answer: "Transferencia, tarjeta, Bizum o PayPal. Para urgentes solemos pedir el pago antes de empezar.",
          },
        ]}
      />
      <header className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
          Traducción jurada online
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Traducción jurada online con entrega en PDF firmado
        </h1>
        <p className="text-slate-700">
          Adjunta tu documento y recibe la traducción jurada en PDF firmado y sellado por el traductor jurado. Plazos rápidos (24-72 h) según idioma y páginas.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-slate-500">
          <span>Respuesta en &lt; 30 minutos en horario 09:00-19:00 CET</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Entrega online; envío en papel opcional</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto"
            className="rounded-2xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Subir documento y pedir precio
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Traducción%20jurada%20online"
            className="text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
          >
            O enviar por email
          </a>
        </div>
      </header>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Precios orientativos y plazos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {LANG_COMBOS.map((item) => (
            <div key={item.pair} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                {item.pair}
              </p>
              <p className="text-base font-semibold text-slate-900">{item.price}</p>
              <p className="text-xs text-slate-600">Plazo estimado: {item.plazo}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Precios para 1 página estándar. Confirmamos importe y plazo al revisar el PDF/imagen. Si tu documento tiene más páginas o incluye apostilla/legalización, te enviamos el precio exacto.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Cómo funciona</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Adjunta tu documento (PDF o foto clara) y elige idiomas.</li>
          <li>Te respondemos con precio cerrado y plazo estimado (normal/urgente).</li>
          <li>Tras confirmar, entregamos la traducción jurada en PDF firmado; en papel si lo necesitas.</li>
        </ol>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">¿Qué documentos traducimos online?</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Certificados del Registro Civil: nacimiento, matrimonio, defunción, fe de vida.</li>
          <li>Antecedentes penales y apostillas.</li>
          <li>Títulos y certificados académicos.</li>
          <li>Contratos, poderes notariales y documentos mercantiles.</li>
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <h2 className="text-lg font-semibold text-slate-900">Si tu idioma es francés</h2>
        <p className="mt-2 text-sm text-slate-700">
          Para trámites con documentación de Francia y otros países francófonos, revisa nuestra página específica de
          <Link href="/traductor-jurado-frances" className="font-semibold text-emerald-700 hover:underline"> traducción jurada de francés</Link>
          : incluye rangos de precio, plazos normales/urgentes y preguntas frecuentes.
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-900">Nota de privacidad</p>
        <p>
          Usamos tus archivos solo para preparar el presupuesto y la traducción. Se transmiten por HTTPS y se eliminan en 30 días o antes si lo pides. PDF firmado digitalmente por traductor jurado; envío en papel opcional.
        </p>
      </section>
    </main>
  );
}
