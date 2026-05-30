// app/page.tsx — Home v2 "banco de utilidades" (ES). Cuerpo en <HomeV2 lang>,
// lang-aware y reutilizable (el FR vive en /traduction-assermentee con el mismo
// componente). Aquí se conservan metadata + datos estructurados (SEO).
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import HomeV2 from "@/components/HomeV2";

const HOME_FAQ_ITEMS = [
  {
    question: "¿Qué es una traducción jurada?",
    answer:
      "Una traducción jurada es una traducción realizada y firmada por un traductor jurado acreditado, que añade su sello y una declaración de veracidad. Tiene validez oficial ante administraciones, juzgados, notarías, universidades y otros organismos.",
  },
  {
    question: "¿Cuánto tarda una traducción jurada?",
    answer:
      "El plazo habitual para una traducción jurada sencilla es de 24 a 72 horas laborables. En el caso de documentos extensos o varios idiomas, el plazo se ajusta al volumen.",
  },
  {
    question: "¿La traducción jurada se entrega en papel o en PDF?",
    answer:
      "Cada vez más organismos aceptan la traducción jurada en PDF firmado digitalmente. Nosotros solemos entregar en PDF firmado y, si lo necesitas, también podemos enviarte el original en papel por mensajería.",
  },
  {
    question: "¿Cuánto cuesta una traducción jurada?",
    answer:
      "El precio depende del tipo de documento, el idioma, la extensión y la urgencia. Trabajamos con tarifas ajustadas y te indicamos siempre un precio cerrado antes de empezar.",
  },
  {
    question: "¿Hacéis traducciones juradas urgentes?",
    answer:
      "En muchos casos podemos ofrecer traducción jurada urgente, dependiendo del volumen y del idioma. Indícalo al pedir presupuesto para revisar la disponibilidad.",
  },
];

export const metadata: Metadata = {
  title: {
    absolute: "Traducción jurada oficial · 10 idiomas · validez en toda España",
  },
  description:
    "Traducción jurada oficial en 10 idiomas, 100% online. Sube tu documento y recibe presupuesto cerrado en 60 segundos. Entrega 24-72h. Traductores jurados acreditados por el MAEC. Desde 35€.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net",
    languages: {
      "es-ES": "https://www.traduccionesjuradas.net",
      "fr-FR": "https://www.traduccionesjuradas.net/traduction-assermentee",
    },
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="breadcrumbs-home"
        items={[{ name: "Inicio", url: "https://www.traduccionesjuradas.net/" }]}
      />
      <SchemaPerson id="schema-person-home" />
      <SchemaFAQ items={HOME_FAQ_ITEMS} id="schema-faq-home" />
      <SchemaHowTo
        id="schema-howto-home"
        name="Cómo pedir una traducción jurada online"
        description="Sube tu documento, recibe presupuesto cerrado al instante y paga online. Recibirás la traducción jurada firmada digitalmente por traductor jurado acreditado por el MAEC en 24-72 horas."
        steps={[
          {
            name: "Sube tu documento",
            text: "Arrastra el PDF o haz una foto con el móvil. Aceptamos PDF, JPG, PNG, HEIC y TIFF de hasta 20 MB.",
          },
          {
            name: "Recibe precio cerrado al instante",
            text: "Analizamos automáticamente el documento (idioma, tipo, extensión) y te mostramos el precio final, sin sorpresas.",
          },
          {
            name: "Paga y recibe tu traducción",
            text: "Pagas online con tarjeta o transferencia. Recibes en 24-72 horas la traducción jurada en PDF firmado digitalmente, válida ante administraciones y notarías de toda España.",
          },
        ]}
      />

      <HomeV2 lang="es" />
    </div>
  );
}
