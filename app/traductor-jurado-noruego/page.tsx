import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor jurado de noruego | Traducciones juradas noruego-español",
  description:
    "Traducciones juradas de noruego a español y de español a noruego para trámites en España y Noruega. Traductores jurados oficiales.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-noruego",
  },
};

export default function TraductorJuradoNoruegoPage() {
  return (
    <PaginaIdioma
      idioma="noruego"
      idiomaSlug="noruego"
      precioPorPalabra={0.14}
      combinaciones={["no-es", "es-no"]}
      tituloH1="Traductor jurado de noruego para trámites entre España y Noruega"
      descripcion="Realizamos traducciones juradas de noruego a español y de español a noruego para documentación civil, académica, laboral, judicial y de empresa. Cada traducción la firma un traductor jurado de noruego, sin plataformas intermediarias, para que tus documentos sean aceptados en España y en Noruega ante administraciones, notarías, universidades y juzgados."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de noruego en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de noruego?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de noruego?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados civiles",
          descripcion:
            "Fødselsattest, vigselsattest, documentos de estado civil, certificados familiares y otros certificados necesarios para matrimonio, nacionalidad, residencia o herencias.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes y certificados oficiales",
          descripcion:
            "Extractos de antecedentes, certificados policiales y otros documentos exigidos para empleo, residencia, trabajo cualificado o trámites de extranjería.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Estudios y cualificaciones",
          descripcion:
            "Títulos, certificados de estudios, historiales académicos y cualificaciones profesionales para homologaciones, reconocimiento de títulos o acceso a estudios en España.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos laborales y de empresa",
          descripcion:
            "Contratos de trabajo, nóminas, certificados de empleo, informes de ingresos, documentos mercantiles y societarios para operar o invertir entre España y Noruega.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
