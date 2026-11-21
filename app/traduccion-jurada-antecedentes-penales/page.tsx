import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  // Cara TRANSACCIONAL del par. La ficha /documentos-oficiales/antecedentes-penales
  // cubre la intención informacional (qué pide cada país, apostilla vs consular);
  // ambas indexan, pero solo esta apunta al término comercial para que Google no
  // tenga que repartir señales entre dos URLs casi idénticas.
  title:
    "Traducción jurada de antecedentes penales · Desde 42 € · 1 día hábil · MAEC nº 3850",
  description:
    "Encarga la traducción jurada de tus antecedentes penales o casier judiciaire: desde 42 €, francés en 1 día hábil (hasta 5 páginas) y PDF firmado digitalmente. Traductor jurado oficial MAEC nº 3850. Presupuesto al instante.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-antecedentes-penales",
  },
};

const FAQ_ITEMS = [
  {
    question: "¿Necesito apostilla en el certificado de antecedentes penales?",
    answer:
      "Depende del país. Los certificados de países firmantes del Convenio de La Haya deben ir apostillados. Para países no firmantes (como Marruecos hasta su adhesión), se requiere legalización consular.",
  },
  {
    question: "¿Se traduce también la Apostilla de La Haya?",
    answer:
      "Sí, la apostilla forma parte del documento y debe traducirse junto con el certificado de antecedentes penales.",
  },
  {
    question: "¿Cuánto cuesta traducir antecedentes penales?",
    answer:
      "El precio habitual es de 40-55 € dependiendo del idioma. El casier judiciaire francés o marroquí suele costar 40-45 €; en francés, hasta 5 páginas se entregan en 1 día hábil.",
  },
  {
    question: "¿Cuánto tardan en caducar los antecedentes penales?",
    answer:
      "Generalmente el certificado debe tener menos de 3 o 6 meses de antigüedad, según el trámite. Confirma siempre con la oficina que tramita tu expediente.",
  },
];

export default function TraduccionJuradaAntecedentesPenalesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-antecedentes-penales"
        serviceName="Traducción jurada de antecedentes penales"
        serviceDescription="Traducción jurada oficial de certificados de antecedentes penales y casier judiciaire para trámites de extranjería, nacionalidad y visados en España."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-antecedentes-penales"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Lingüísticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC nº 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-antecedentes-penales"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducción jurada antecedentes penales",
            url: "https://www.traduccionesjuradas.net/traduccion-jurada-antecedentes-penales",
          },
        ]}
      />
      <SchemaFAQ id="faq-antecedentes-penales" items={FAQ_ITEMS} />

      <div className="mb-6 rounded-2xl border border-bleu/30 bg-bleu/5 p-4 text-sm text-encre">
        <p className="font-semibold text-bleu">
          Regularización extraordinaria 2026: plazo de solicitud cerrado el 30 de junio de 2026
        </p>
        <p className="mt-1 text-sepia">
          Si tu expediente sigue en trámite (RD 316/2026), el certificado de
          antecedentes penales del país de origen es uno de los documentos
          centrales del expediente:{" "}
          <Link
            href="/regularizacion-2026"
            className="font-semibold text-bleu hover:underline"
          >
            ver guía completa →
          </Link>
        </p>
      </div>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Antecedentes penales
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Traducción jurada de antecedentes penales
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          El certificado de antecedentes penales («<strong>casier judiciaire</strong>»
          en francés) es uno de los documentos más solicitados en trámites de
          extranjería, nacionalidad, visados y reagrupación familiar en España.
          Realizamos la <strong>traducción jurada de antecedentes penales</strong> de
          cualquier país, firmada por traductor jurado oficial MAEC nº 3850.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Para qué trámites se pide la traducción de antecedentes penales?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Permisos de residencia inicial y renovaciones.</li>
          <li>Visados de larga duración, estudios y trabajo.</li>
          <li>Solicitudes de nacionalidad española o cartas de naturaleza.</li>
          <li>Reagrupación familiar y desplazamientos de menores.</li>
          <li>Puestos de trabajo sensibles (educación, sanidad, menores).</li>
          <li>Teletrabajo desde España para empresas extranjeras.</li>
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-cream bg-card p-5 text-sm text-encre shadow-sm">
        <h2 className="text-lg font-semibold text-encre">
          Precios y plazos orientativos
        </h2>
        <p className="mt-2 text-sepia">
          Precio para certificados de antecedentes penales (PDF o foto legible).
          Incluye firma y sello de traductor jurado.
        </p>
        <ul className="mt-3 space-y-2 text-sepia">
          <li>
            <strong>Casier judiciaire (francés):</strong> desde 40 € — 1 día hábil
          </li>
          <li>
            <strong>Criminal Record Certificate (inglés):</strong> desde 50 € —
            plazo en el presupuesto
          </li>
          <li>
            <strong>Führungszeugnis (alemán):</strong> desde 55 € — plazo en el presupuesto
          </li>
          <li>
            <strong>Antecedentes con apostilla:</strong> precio según extensión
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Tipos de documentos que traducimos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Casier judiciaire</strong> — Marruecos, Francia y países
            francófonos.
          </li>
          <li>
            <strong>Bulletin n° 3</strong> y extractos de antecedentes judiciales.
          </li>
          <li>
            <strong>Police Clearance Certificates</strong> — países anglosajos.
          </li>
          <li>
            <strong>Certificados de delitos de naturaleza sexual</strong> — cuando se
            exigen de forma separada.
          </li>
          <li>
            <strong>Certificados de buena conducta</strong> emitidos por autoridades
            policiales o judiciales.
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Apostilla y legalización
        </h2>
        <p>
          La mayoría de certificados de antecedentes penales extranjeros deben ir{" "}
          <strong>apostillados</strong> o legalizados antes de la traducción jurada.
          Nosotros traducimos el certificado y la apostilla conjuntamente.
        </p>
        <p>
          Si tu certificado procede de un país que no aplica la{" "}
          <Link
            href="/documentos-oficiales/apostilla-haya"
            className="text-bleu underline"
          >
            Apostilla de La Haya
          </Link>
          , puede requerir legalización consular previa.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          ¿Cómo enviarnos el documento?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Haz una foto clara o escaneo legible del certificado (y la apostilla, si la tiene).</li>
          <li>Comprueba que se leen el nombre completo, la fecha y todos los sellos.</li>
          <li>Indícanos para qué trámite lo necesitas (nacionalidad, residencia, visado, etc.).</li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          ¿Necesitas traducir tu certificado de antecedentes penales?
        </h2>
        <p className="mt-1 text-encre">
          Envíanos tu certificado en PDF o foto clara y te respondemos con un precio
          cerrado y un plazo estimado de entrega.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href="/presupuesto-instantaneo"
            className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
          >
            Solicitar presupuesto
          </Link>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
          >
            Consultar por WhatsApp
          </a>
        </div>
      </section>

      <p className="mt-6 text-xs text-sepia">
        Ver también:{" "}
        <Link
          href="/documentos-oficiales/antecedentes-penales"
          className="font-semibold text-bleu hover:underline"
        >
          Antecedentes penales (detalle)
        </Link>
        {" · "}
        <Link
          href="/marruecos"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos marroquíes
        </Link>
      </p>
    </main>
  );
}
