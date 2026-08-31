import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor Jurado de Inglés · Traducción Oficial Inglés↔Español · MAEC",
  description:
    "Traductor jurado de inglés acreditado MAEC. Traducción jurada inglés-español y español-inglés: birth certificates, degrees, criminal records, contracts. Válida en España, UK, Irlanda, EE.UU. Atención personalizada: un traductor jurado valora tu documento y tu presupuesto. Desde 35€.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-ingles",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+ingl%C3%A9s&subtitle=Traducci%C3%B3n+jurada+oficial+EN+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de inglés — TraduccionesJuradas.net",
      },
    ],
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
            "Un certificado sencillo (birth certificate, marriage certificate) parte de 42 € IVA incluido. Los documentos extensos se presupuestan por palabras (desde 0,08 €/palabra). Sube tu documento y un traductor jurado lo valora personalmente antes de cerrarte el presupuesto.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de inglés?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
        {
          question: "¿Sirve una traducción jurada de inglés para trámites en Reino Unido o Estados Unidos?",
          answer:
            "La traducción jurada española es válida para trámites en España. Para presentar documentos en Reino Unido o EE.UU., se requiere una certified translation conforme a los requisitos del país. Te orientamos según el trámite concreto.",
        },
        {
          question: "¿Qué documentos en inglés se traducen con más frecuencia?",
          answer:
            "Los más habituales son: birth certificates, marriage certificates, police certificates (DBS, ACRO, FBI), diplomas and transcripts, employment contracts, payslips y powers of attorney.",
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
