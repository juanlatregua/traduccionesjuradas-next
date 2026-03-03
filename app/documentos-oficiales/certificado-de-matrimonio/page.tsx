import Link from "next/link";
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";

export const metadata: Metadata = {
  title: "Traducción jurada certificado de matrimonio | Desde 40-75 €",
  description:
    "Desde 40-75 € para traducir certificados de matrimonio. Entrega en PDF firmado, plazos rápidos según idioma. Incluye apostilla si aplica.",
};

export default function CertificadoMatrimonioPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12 text-sm text-sepia">
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://traduccionesjuradas.net/documentos-oficiales" },
          { name: "Certificado de matrimonio", url: "https://traduccionesjuradas.net/documentos-oficiales/certificado-de-matrimonio" },
        ]}
      />
      <SchemaFAQ
        items={[
          {
            question: "¿Debo traducir también la apostilla?",
            answer: "Sí, si el certificado lleva Apostilla de La Haya, debe traducirse junto con el certificado.",
          },
          {
            question: "¿Sirve la traducción jurada en PDF?",
            answer: "Normalmente sí; si el organismo pide papel, podemos enviarlo por mensajería.",
          },
          {
            question: "¿Plazos orientativos?",
            answer: "Español→Inglés 2 días, Español→Francés 1 día, Portugués apostillado→Español 2 días, Francés apostillado→Español 1 día.",
          },
          {
            question: "¿Cómo envío el certificado?",
            answer: "Adjunta PDF o foto clara desde el formulario de presupuesto o envíalo a hola@traduccionesjuradas.net. Revisamos sellos y apostilla antes de confirmar el precio.",
          },
        ]}
      />

      <header className="max-w-3xl space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Certificado de matrimonio
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de certificado de matrimonio
        </h1>
        <p>
          Traducción jurada de certificados de matrimonio para trámites en España y en el extranjero. Entrega en PDF firmado y sellado; si necesitas copia en papel, la enviamos por mensajería.
        </p>
        <div className="flex flex-wrap gap-3 text-xs text-graphite">
          <span>Respuesta en &lt; 30 minutos en horario 09:00-19:00 CET</span>
          <span className="h-1 w-1 rounded-full bg-graphite/30" />
          <span>Entrega online; envío en papel opcional</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Subir documento y pedir precio
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Certificado%20de%20matrimonio%20-%20Presupuesto"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Enviar por email
          </a>
        </div>
      </header>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-encre">Precios y plazos</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { pair: "Español → Inglés", price: "50 €", plazo: "2 días" },
            { pair: "Español → Francés", price: "45 €", plazo: "1 día" },
            { pair: "Portugués (apostillado) → Español", price: "75 €", plazo: "2 días" },
            { pair: "Francés (apostillado) → Español", price: "40 €", plazo: "1 día" },
          ].map((item) => (
            <div key={item.pair} className="rounded-xl border border-cream bg-parchment px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
                {item.pair}
              </p>
              <p className="text-base font-semibold text-encre">{item.price}</p>
              <p className="text-xs text-sepia">Plazo estimado: {item.plazo}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-graphite">
          Precios para 1 página estándar. Confirmamos importe y plazo al revisar el PDF/imagen y la apostilla o legalización, si aplica.
        </p>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold text-encre">Cómo funciona</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>Adjunta el certificado de matrimonio (y apostilla, si la tiene) en PDF o foto clara.</li>
          <li>Te respondemos con precio cerrado y plazo estimado.</li>
          <li>Tras confirmar, entregamos la traducción jurada en PDF firmado; en papel si lo necesitas.</li>
        </ol>
      </section>
    </main>
  );
}
