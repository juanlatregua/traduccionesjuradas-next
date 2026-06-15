import type { Metadata } from "next";
import Link from "next/link";
import { SchemaService } from "@/components/SchemaService";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { WHATSAPP_LINK } from "@/lib/contact";

export const metadata: Metadata = {
  title:
    "Traducci\u00F3n Jurada Antecedentes Penales \u00B7 Casier Judiciaire \u00B7 MAEC n\u00BA 3850",
  description:
    "Traducci\u00F3n jurada de antecedentes penales y casier judiciaire para extranjer\u00EDa, nacionalidad y visados. Traductor jurado oficial MAEC n\u00BA 3850. Franc\u00E9s, ingl\u00E9s, alem\u00E1n. Desde 42\u20AC, entrega en 24 h.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traduccion-jurada-antecedentes-penales",
  },
};

const FAQ_ITEMS = [
  {
    question: "\u00BFNecesito apostilla en el certificado de antecedentes penales?",
    answer:
      "Depende del pa\u00EDs. Los certificados de pa\u00EDses firmantes del Convenio de La Haya deben ir apostillados. Para pa\u00EDses no firmantes (como Marruecos hasta su adhesi\u00F3n), se requiere legalizaci\u00F3n consular.",
  },
  {
    question: "\u00BFSe traduce tambi\u00E9n la Apostilla de La Haya?",
    answer:
      "S\u00ED, la apostilla forma parte del documento y debe traducirse junto con el certificado de antecedentes penales.",
  },
  {
    question: "\u00BFCu\u00E1nto cuesta traducir antecedentes penales?",
    answer:
      "El precio habitual es de 40-55 \u20AC dependiendo del idioma. El casier judiciaire franc\u00E9s o marroqu\u00ED suele costar 40-45 \u20AC con entrega en 24h.",
  },
  {
    question: "\u00BFCu\u00E1nto tardan en caducar los antecedentes penales?",
    answer:
      "Generalmente el certificado debe tener menos de 3 o 6 meses de antig\u00FCedad, seg\u00FAn el tr\u00E1mite. Confirma siempre con la oficina que tramita tu expediente.",
  },
];

export default function TraduccionJuradaAntecedentesPenalesPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaService
        id="service-antecedentes-penales"
        serviceName="Traducci\u00F3n jurada de antecedentes penales"
        serviceDescription="Traducci\u00F3n jurada oficial de certificados de antecedentes penales y casier judiciaire para tr\u00E1mites de extranjer\u00EDa, nacionalidad y visados en Espa\u00F1a."
        serviceUrl="https://www.traduccionesjuradas.net/traduccion-jurada-antecedentes-penales"
        brand={{ "@type": "Brand", name: "HBTJ Consultores Ling\u00FC\u00EDsticos" }}
        provider={{
          "@type": "Person",
          name: "Juan Silva Moreno",
          jobTitle: "Traductor Jurado Oficial MAEC n\u00BA 3850",
        }}
      />
      <SchemaBreadcrumbs
        id="breadcrumbs-antecedentes-penales"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          {
            name: "Traducci\u00F3n jurada antecedentes penales",
            url: "https://www.traduccionesjuradas.net/traduccion-jurada-antecedentes-penales",
          },
        ]}
      />
      <SchemaFAQ id="faq-antecedentes-penales" items={FAQ_ITEMS} />

      <div className="mb-6 rounded-2xl border border-bleu/30 bg-bleu/5 p-4 text-sm text-encre">
        <p className="font-semibold text-bleu">
          Regularización extraordinaria 2026 abierta hasta el 30 de junio
        </p>
        <p className="mt-1 text-sepia">
          Si tramitas la regularización (RD 316/2026), el certificado de
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
          Traducci\u00F3n jurada de antecedentes penales
        </h1>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          El certificado de antecedentes penales (\u00AB<strong>casier judiciaire</strong>\u00BB
          en franc\u00E9s) es uno de los documentos m\u00E1s solicitados en tr\u00E1mites de
          extranjer\u00EDa, nacionalidad, visados y reagrupaci\u00F3n familiar en Espa\u00F1a.
          Realizamos la <strong>traducci\u00F3n jurada de antecedentes penales</strong> de
          cualquier pa\u00EDs, firmada por traductor jurado oficial MAEC n\u00BA 3850.
        </p>
      </header>

      <section className="mt-8 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFPara qu\u00E9 tr\u00E1mites se pide la traducci\u00F3n de antecedentes penales?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Permisos de residencia inicial y renovaciones.</li>
          <li>Visados de larga duraci\u00F3n, estudios y trabajo.</li>
          <li>Solicitudes de nacionalidad espa\u00F1ola o cartas de naturaleza.</li>
          <li>Reagrupaci\u00F3n familiar y desplazamientos de menores.</li>
          <li>Puestos de trabajo sensibles (educaci\u00F3n, sanidad, menores).</li>
          <li>Teletrabajo desde Espa\u00F1a para empresas extranjeras.</li>
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
            <strong>Casier judiciaire (franc\u00E9s):</strong> desde 40 \u20AC \u2014 24h
          </li>
          <li>
            <strong>Criminal Record Certificate (ingl\u00E9s):</strong> desde 50 \u20AC \u2014
            24-48h
          </li>
          <li>
            <strong>F\u00FChrungszeugnis (alem\u00E1n):</strong> desde 55 \u20AC \u2014 48h
          </li>
          <li>
            <strong>Antecedentes con apostilla:</strong> precio seg\u00FAn extensi\u00F3n
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          Tipos de documentos que traducimos
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Casier judiciaire</strong> \u2014 Marruecos, Francia y pa\u00EDses
            franc\u00F3fonos.
          </li>
          <li>
            <strong>Bulletin n\u00B0 3</strong> y extractos de antecedentes judiciales.
          </li>
          <li>
            <strong>Police Clearance Certificates</strong> \u2014 pa\u00EDses anglosajos.
          </li>
          <li>
            <strong>Certificados de delitos de naturaleza sexual</strong> \u2014 cuando se
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
          Apostilla y legalizaci\u00F3n
        </h2>
        <p>
          La mayor\u00EDa de certificados de antecedentes penales extranjeros deben ir{" "}
          <strong>apostillados</strong> o legalizados antes de la traducci\u00F3n jurada.
          Nosotros traducimos el certificado y la apostilla conjuntamente.
        </p>
        <p>
          Si tu certificado procede de un pa\u00EDs que no aplica la{" "}
          <Link
            href="/documentos-oficiales/apostilla-haya"
            className="text-bleu underline"
          >
            Apostilla de La Haya
          </Link>
          , puede requerir legalizaci\u00F3n consular previa.
        </p>
      </section>

      <section className="mt-10 space-y-4 text-sm text-sepia">
        <h2 className="text-lg font-semibold text-encre">
          \u00BFC\u00F3mo enviarnos el documento?
        </h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Haz una foto clara o escaneo legible del certificado (y la apostilla, si la tiene).</li>
          <li>Comprueba que se leen el nombre completo, la fecha y todos los sellos.</li>
          <li>Ind\u00EDcanos para qu\u00E9 tr\u00E1mite lo necesitas (nacionalidad, residencia, visado, etc.).</li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-cream bg-cream p-6 text-sm">
        <h2 className="text-lg font-semibold text-bleu">
          \u00BFNecesitas traducir tu certificado de antecedentes penales?
        </h2>
        <p className="mt-1 text-encre">
          Env\u00EDanos tu certificado en PDF o foto clara y te respondemos con un precio
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
        Ver tambi\u00E9n:{" "}
        <Link
          href="/documentos-oficiales/antecedentes-penales"
          className="font-semibold text-bleu hover:underline"
        >
          Antecedentes penales (detalle)
        </Link>
        {" \u00B7 "}
        <Link
          href="/marruecos"
          className="font-semibold text-bleu hover:underline"
        >
          Documentos marroqu\u00EDes
        </Link>
      </p>
    </main>
  );
}
