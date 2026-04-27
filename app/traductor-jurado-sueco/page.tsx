import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor Jurado de Sueco · Traducción Oficial Sueco↔Español · MAEC",
  description:
    "Traductor jurado de sueco acreditado MAEC. Traducción jurada sueco-español y español-sueco: personbevis, belastningsregister, betyg, anställningsavtal. Válida en España y Suecia. Precio cerrado al instante. Desde 35€.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-sueco",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+sueco&subtitle=Traducci%C3%B3n+jurada+oficial+SV+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de sueco — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoSuecoPage() {
  return (
    <PaginaIdioma
      idioma="sueco"
      idiomaSlug="sueco"
      combinaciones={["sv-es", "es-sv"]}
      tituloH1="Traductor jurado de sueco para trámites entre España y Suecia"
      descripcion="Realizamos traducciones juradas de sueco a español y de español a sueco válidas para administraciones públicas, notarías, universidades y empresas. Traductores jurados acreditados, con entrega en PDF firmado digitalmente."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de sueco en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de sueco?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de sueco?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados civiles",
          descripcion:
            "Personbevis, certificados de nacimiento, matrimonio, familia y otros documentos del registro civil sueco.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes y certificados de policía",
          descripcion:
            "Belastningsregister, extractos policiales y certificados de buena conducta necesarios para empleo o residencia.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Estudios y cualificaciones",
          descripcion:
            "Certificados escolares, títulos universitarios y profesionales para homologación, estudios o reconocimiento oficial.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Empleo y empresa",
          descripcion:
            "Contratos de trabajo, nóminas, certificados de empresa, documentos mercantiles y societarios suecos.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
