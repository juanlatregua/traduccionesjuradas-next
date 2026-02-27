import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor jurado de inglés | Traducciones juradas inglés-español",
  description:
    "Traducciones juradas de inglés a español y de español a inglés realizadas por traductores jurados acreditados. Válidas para trámites en España, Reino Unido, Irlanda, Estados Unidos y otros países anglófonos.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-ingles",
  },
};

export default function TraductorJuradoInglesPage() {
  return (
    <PaginaIdioma
      idioma="inglés"
      idiomaSlug="ingles"
      combinaciones={["en-es", "es-en"]}
      tituloH1="Traductor jurado de inglés para trámites en España y en el extranjero"
      descripcion="Realizamos traducciones juradas de inglés a español y de español a inglés para presentar documentos ante administraciones, universidades, notarías, juzgados y empresas en España, Reino Unido, Irlanda, Estados Unidos y otros países anglófonos. Cada encargo lo firma un traductor jurado de inglés acreditado, sin plataformas intermediarias."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de inglés en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de inglés?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de inglés?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados del registro civil",
          descripcion:
            "Birth certificates, marriage certificates, divorce decrees, death certificates y otros documentos necesarios para extranjería, nacionalidad, matrimonio o herencias.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Certificados de antecedentes y buena conducta",
          descripcion:
            "ACRO, DBS, Police Certificates, FBI Background Checks y otros certificados exigidos para visados, permisos de residencia, oposiciones o empleo en España.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Títulos y expedientes académicos",
          descripcion:
            "Diplomas, transcripts, degree certificates, academic records, certificados de estudios y otros documentos necesarios para homologaciones, másteres u oposiciones en España.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos laborales y mercantiles",
          descripcion:
            "Employment contracts, payslips, reference letters, company certificates, articles of association, powers of attorney y otra documentación para trabajar, invertir o abrir negocio en España.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
