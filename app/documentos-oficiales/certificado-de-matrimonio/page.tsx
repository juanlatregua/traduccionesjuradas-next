import Link from "next/link";
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaProduct } from "@/components/SchemaProduct";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { RelatedDocuments } from "@/components/RelatedDocuments";
import { SchemaService } from "@/components/SchemaService";

export const metadata: Metadata = {
  title: "Traducción jurada certificado de matrimonio | Desde 40-75 €",
  description:
    "Desde 40-75 € para traducir certificados de matrimonio. Entrega en PDF firmado, plazos rápidos según idioma. Incluye apostilla si aplica.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-matrimonio" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traducci%C3%B3n+jurada+de+certificado+de+matrimonio&subtitle=Documentos+oficiales+%C2%B7+Desde+40-75+%E2%82%AC",
        width: 1200,
        height: 630,
        alt: "Traducción jurada de certificado de matrimonio — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function CertificadoMatrimonioPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12 text-sm text-sepia">
      <SchemaService
        id="service-matrimonio"
        serviceName="Traducción jurada de certificado de matrimonio"
        serviceDescription="Traducción jurada oficial de certificados de matrimonio y actas matrimoniales extranjeras para inscripción en el Registro Civil, notarías y trámites de extranjería en España."
        serviceUrl="https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-matrimonio"
      />
      <SchemaBreadcrumbs
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Documentos oficiales", url: "https://www.traduccionesjuradas.net/documentos-oficiales" },
          { name: "Certificado de matrimonio", url: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-matrimonio" },
        ]}
      />
      <SchemaProduct
        name="Traducción jurada de certificado de matrimonio"
        description="Traducción jurada oficial de certificados de matrimonio extranjeros. Entrega en PDF firmado en 24-48h."
        sku="tj-certificado-matrimonio"
        offers={[
          { price: "40", priceCurrency: "EUR", url: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-matrimonio" },
          { price: "75", priceCurrency: "EUR", url: "https://www.traduccionesjuradas.net/documentos-oficiales/certificado-de-matrimonio" },
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
            answer: "Adjunta PDF o foto clara desde el presupuesto instantáneo o envíalo a hola@traduccionesjuradas.net. Revisamos sellos y apostilla antes de confirmar el precio.",
          },
        ]}
      />
      <Breadcrumbs items={[
        { name: "Inicio", href: "/" },
        { name: "Documentos oficiales", href: "/documentos-oficiales" },
        { name: "Certificado de matrimonio", href: "/documentos-oficiales/certificado-de-matrimonio" },
      ]} />

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

      {/* USOS HABITUALES */}
      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Para qué trámites se pide la traducción del certificado de matrimonio?
        </h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Inscripción del matrimonio en el <strong>Registro Civil español</strong>.</li>
          <li>Expedientes de <strong>extranjería</strong>: residencia, reagrupación familiar, tarjeta de familiar de comunitario.</li>
          <li>Trámites de <strong>nacionalidad española</strong> por residencia o matrimonio.</li>
          <li>Compraventa de inmuebles en España (las notarías exigen acreditar el <strong>régimen económico matrimonial</strong>).</li>
          <li>Herencias y sucesiones internacionales.</li>
          <li>Trámites ante consulados y embajadas.</li>
        </ul>
        <p>
          En la mayoría de estos procedimientos se exige que el certificado
          sea reciente (normalmente menos de 3 o 6 meses) y, si procede,
          debidamente apostillado antes de la traducción jurada.
        </p>
      </section>

      {/* CTA INTERMEDIO */}
      <section className="mt-8 rounded-xl border border-bleu/20 bg-bleu/5 p-5 text-sm">
        <p className="font-semibold text-encre">¿Tienes un certificado de matrimonio para traducir?</p>
        <p className="mt-1 text-sepia">Sube tu documento y recibe precio cerrado al instante.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/presupuesto-instantaneo" className="rounded-xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu/90">
            Pedir presupuesto
          </Link>
          <a href="mailto:hola@traduccionesjuradas.net?subject=Certificado%20de%20matrimonio%20-%20Presupuesto" className="text-xs font-medium text-bleu hover:underline">
            Enviar por email
          </a>
        </div>
      </section>

      <section className="mt-8 space-y-3 text-sm text-sepia">
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

      {/* APOSTILLA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Certificado de matrimonio y Apostilla de La Haya
        </h2>
        <p>
          Si el certificado de matrimonio se va a presentar en España y procede de un país
          firmante del Convenio de La Haya, normalmente debe llevar la{" "}
          <Link href="/documentos-oficiales/apostilla-haya" className="text-bleu underline">
            Apostilla de La Haya
          </Link>
          . La traducción jurada debe incluir tanto el certificado como la página de la apostilla.
        </p>
        <p>
          Si el país emisor no aplica la apostilla, se utilizan otros sistemas de
          legalización (legalización consular, sellos ministeriales, etc.). Conviene
          confirmarlo siempre con la administración que tramita el expediente.
        </p>
      </section>

      {/* MARRUECOS Y FRANCIA */}
      <section className="mt-10 space-y-4 rounded-2xl border border-cream bg-parchment p-5 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Certificados de matrimonio de Marruecos y Francia
        </h2>
        <p>
          Trabajamos con frecuencia con certificados de matrimonio procedentes de{" "}
          <strong>Marruecos</strong> (<em>Acte de Mariage</em>) y <strong>Francia</strong>{" "}
          (<em>Extrait d&apos;Acte de Mariage</em>), que suelen necesitar apostilla cuando se
          presentan en España para inscripciones en el Registro Civil, operaciones
          inmobiliarias o trámites de extranjería.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>En Marruecos suelen exigirse certificados recientes (menos de 3 meses).</li>
          <li>La traducción jurada incluye el acta de matrimonio y la apostilla.</li>
        </ul>
      </section>

      {/* INFORMACIÓN PRÁCTICA */}
      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Información práctica sobre el certificado de matrimonio
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Vigencia</p>
            <p className="mt-1">Generalmente se pide un certificado con menos de <strong>3 a 6 meses</strong> de antigüedad, según el trámite y la administración.</p>
          </div>
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Dónde obtenerlo</p>
            <p className="mt-1"><strong>España:</strong> Registro Civil (presencial o Sede Judicial Electrónica). <strong>Francia:</strong> mairie donde se celebró el matrimonio. <strong>Marruecos:</strong> tribunal de familia o commune.</p>
          </div>
          <div className="rounded-xl border border-cream bg-parchment p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Formatos</p>
            <p className="mt-1"><strong>Acta literal</strong> (copia íntegra) o <strong>extracto</strong> (resumen). Para trámites en España, las notarías suelen preferir el acta literal.</p>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir tu certificado de matrimonio?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tu certificado (y la apostilla, si la tiene) en PDF o foto
          clara y te responderemos con un presupuesto cerrado y un plazo
          estimado de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href="mailto:hola@traduccionesjuradas.net?subject=Certificado%20de%20matrimonio%20-%20Presupuesto"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            O enviar directamente el documento por email
          </a>
        </div>
      </section>

      <RelatedDocuments currentSlug="certificado-de-matrimonio" />
    </main>
  );
}
