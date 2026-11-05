import type { Metadata } from "next";
import Link from "next/link";
import { MAIL_LINK, WHATSAPP_LINK } from "@/lib/contact";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { PAGE_PRICE_EUR, FR_DOC_2P_EUR, APOSTILLE_EXTRA_EUR } from "@/lib/pricing-engine/page-pricing";

const URL = "https://www.traduccionesjuradas.net/traduccion-jurada-frances-malaga";

export const metadata: Metadata = {
  title: "Traducción jurada en Málaga · Francés · Desde 30 € + IVA",
  description:
    "Traducción jurada francés↔español para Málaga y la Costa del Sol: extranjería, Registro Civil, notarías y Universidad de Málaga. Traductor jurado MAEC nº 3850, desde 30 € + IVA, entrega en 1 día hábil.",
  alternates: { canonical: URL },
};

const DONDE = [
  {
    titulo: "Extranjería",
    texto:
      "NIE, residencia, reagrupación familiar o arraigo en la Oficina de Extranjería de Málaga: actas de nacimiento, certificados de matrimonio y antecedentes penales franceses o del Magreb redactados en francés.",
  },
  {
    titulo: "Registro Civil y bodas",
    texto:
      "Expedientes matrimoniales, inscripción de nacimientos y nacionalidad en el Registro Civil de Málaga: acte de naissance, certificat de coutume, certificat de célibat.",
  },
  {
    titulo: "Notarías y compraventas",
    texto:
      "Poderes, actas notariales, escrituras y documentos de sociedad para comprar o vender una vivienda en Málaga y la Costa del Sol, o para herencias con bienes en España.",
  },
  {
    titulo: "Universidad y homologaciones",
    texto:
      "Diplômes, relevés de notes y programas de estudios para matricularte en la Universidad de Málaga o para homologar un título francés en España.",
  },
  {
    titulo: "Juzgados",
    texto:
      "Sentencias de divorcio, resoluciones judiciales y documentación para procedimientos en los juzgados de Málaga.",
  },
  {
    titulo: "Trabajo y empresa",
    texto:
      "Contrats de travail, fiches de paie, attestations y extraits Kbis para contratar, darte de alta o abrir una empresa en Málaga.",
  },
];

const PASOS = [
  { n: "1", titulo: "Sube el documento", texto: "Una foto o un PDF desde el móvil o el ordenador. No hace falta desplazarse." },
  { n: "2", titulo: "Precio cerrado al instante", texto: "Ves el precio final y el plazo antes de pagar, sin compromiso." },
  { n: "3", titulo: "Traducción jurada", texto: "La hace y la firma un traductor jurado de francés nombrado por el MAEC (nº 3850)." },
  { n: "4", titulo: "Entrega", texto: "En PDF con firma electrónica cualificada en 1 día hábil. Si te piden el papel, lo enviamos por mensajería." },
];

const FAQ = [
  {
    question: "¿Cuánto cuesta una traducción jurada de francés en Málaga?",
    answer: `Lo mismo que en el resto de España: ${PAGE_PRICE_EUR} € + IVA un documento de 1 página y ${FR_DOC_2P_EUR} € + IVA uno de 2 páginas, +${APOSTILLE_EXTRA_EUR} € si lleva apostilla. Contratos, poderes y textos largos, por palabra. Sube el documento y ves el precio cerrado al instante.`,
  },
  {
    question: "¿Tengo que ir a una oficina en Málaga?",
    answer:
      "No. Todo se hace online: subes el documento, pagas y recibes la traducción jurada en PDF firmado digitalmente. Si el organismo te pide la traducción en papel, te la enviamos por mensajería a tu domicilio.",
  },
  {
    question: "¿La aceptan en la Oficina de Extranjería y en el Registro Civil de Málaga?",
    answer:
      "Sí: una traducción jurada firmada por un traductor jurado nombrado por el Ministerio de Asuntos Exteriores tiene validez oficial ante cualquier administración española. Si el trámite se hace en papel, pide la versión impresa con firma y sello originales.",
  },
  {
    question: "¿Cuánto tarda?",
    answer:
      "1 día hábil para documentos de hasta 5 páginas. Si tienes cita en extranjería o en el Registro Civil muy pronto, dínoslo: se puede entregar en el día con un recargo del 40 %.",
  },
  {
    question: "¿Traducís también de español a francés?",
    answer:
      "Sí, en las dos direcciones: documentos españoles que tienes que presentar en Francia, Bélgica, Suiza, Canadá o un país francófono de África.",
  },
];

export default function TraduccionJuradaFrancesMalagaPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:py-12 text-encre">
      <SchemaBreadcrumbs
        id="breadcrumbs-traduccion-jurada-frances-malaga"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Traductor jurado de francés", url: "https://www.traduccionesjuradas.net/traductor-jurado-frances" },
          { name: "Málaga", url: URL },
        ]}
      />
      <SchemaFAQ id="faq-traduccion-jurada-frances-malaga" items={FAQ} />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">Málaga · Traducción jurada</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Traducción jurada en Málaga, francés ↔ español
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Traducciones juradas para clientes de <strong>Málaga</strong> y de toda la Costa del Sol: extranjería,
          Registro Civil, notarías, Universidad de Málaga y juzgados. Gestión online, validez oficial y entrega en PDF
          firmado digitalmente. Si necesitas copia en papel, la enviamos por mensajería.
        </p>
        <p className="mt-2 text-xs text-sepia">
          Precios, plazos y documentos en detalle en la página del{" "}
          <Link href="/traductor-jurado-frances" className="font-semibold text-bleu hover:underline">
            traductor jurado de francés
          </Link>
          .
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 font-semibold text-white hover:bg-bleu-dark"
          >
            Pedir presupuesto
          </Link>
          <a
            href={WHATSAPP_LINK}
            className="rounded-2xl border border-cream px-4 py-2 font-medium text-encre hover:bg-cream"
          >
            Enviar por WhatsApp
          </a>
          <a href={MAIL_LINK} className="text-xs font-medium text-bleu underline-offset-2 hover:underline">
            Enviar por email
          </a>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Dónde te la piden en Málaga</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DONDE.map((d) => (
            <article key={d.titulo} className="rounded-2xl border border-cream bg-card p-4">
              <h3 className="text-base font-semibold">{d.titulo}</h3>
              <p className="mt-1 text-sm text-sepia">{d.texto}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold">Precio</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sepia">
            <li>Documento de 1 página: {PAGE_PRICE_EUR} € + IVA.</li>
            <li>
              Documento de 2 páginas: {FR_DOC_2P_EUR} € + IVA (+{APOSTILLE_EXTRA_EUR} € si lleva apostilla).
            </li>
            <li>Contratos y documentos extensos: por palabra.</li>
          </ul>
        </article>
        <article className="rounded-2xl border border-cream bg-card p-4">
          <h2 className="text-base font-semibold">Plazo</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-sepia">
            <li>1 día hábil hasta 5 páginas.</li>
            <li>En el día, con recargo del 40 %, si tienes cita muy pronto.</li>
            <li>Papel por mensajería si el trámite es presencial.</li>
          </ul>
        </article>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Cómo funciona</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((p) => (
            <li key={p.n} className="rounded-2xl border border-cream bg-card p-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bleu text-sm font-bold text-white">
                {p.n}
              </span>
              <h3 className="mt-3 text-base font-semibold">{p.titulo}</h3>
              <p className="mt-1 text-sm text-sepia">{p.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10 rounded-3xl border border-cream bg-parchment p-6">
        <h2 className="text-xl font-semibold">Málaga, la Costa del Sol y toda España</h2>
        <p className="mt-2 text-sm text-sepia">
          Atendemos a diario a particulares, despachos y empresas de Málaga, Marbella, Fuengirola, Benalmádena,
          Torremolinos, Estepona, Nerja y el resto de la provincia, y también trámites de otras provincias y de
          destinos francófonos. Documentos de Francia, Bélgica, Suiza, Marruecos, Argelia, Túnez, Senegal o Costa de
          Marfil redactados en francés.
        </p>
        <p className="mt-2 text-sm text-sepia">
          ¿Otro idioma? Mira la página de{" "}
          <Link href="/traductor-jurado/malaga" className="font-semibold text-bleu hover:underline">
            traductor jurado en Málaga
          </Link>
          .
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Preguntas frecuentes</h2>
        <div className="mt-4 space-y-3">
          {FAQ.map((qa) => (
            <details key={qa.question} className="rounded-2xl border border-cream bg-card p-4">
              <summary className="cursor-pointer text-sm font-semibold">{qa.question}</summary>
              <p className="mt-2 text-sm leading-relaxed text-sepia">{qa.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
