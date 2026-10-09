import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor Jurado de Alem\u00E1n \u00B7 Traducci\u00F3n Oficial Alem\u00E1n\u2194Espa\u00F1ol \u00B7 MAEC",
  description:
    "Traducci\u00F3n jurada de alem\u00E1n por traductor oficial MAEC. Documentos legales, certificados, t\u00EDtulos universitarios. Alem\u00E1n-espa\u00F1ol y espa\u00F1ol-alem\u00E1n. Alem\u00E1n a espa\u00F1ol: 30\u20AC + IVA por p\u00E1gina.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-aleman",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+alem%C3%A1n&subtitle=Traducci%C3%B3n+jurada+oficial+DE+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de alemán — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoAlemanPage() {
  return (
    <PaginaIdioma
      idioma="alemán"
      idiomaSlug="aleman"
      combinaciones={["de-es", "es-de"]}
      updated="2026-09-21"
      tituloH1="Traductor jurado de alemán para trámites en España y países de habla alemana"
      descripcion="Realizamos traducciones juradas de alemán a español y de español a alemán para presentar documentos ante administraciones públicas, universidades, notarías, juzgados y empresas en España, Alemania, Austria, Suiza y otros países germanoparlantes. Cada encargo lo firma un traductor jurado de alemán acreditado, sin plataformas intermediarias."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de alemán en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de alemán?",
          answer:
            "Traducción jurada de alemán a español: 30 € + IVA por página del original en certificados (Geburtsurkunde, Heiratsurkunde), actas, títulos, expedientes y antecedentes; 35 € + IVA por página si la página lleva tablas (notas, expedientes académicos, extractos bancarios); +5 € si está apostillado. Los contratos y textos largos se presupuestan por palabras, y de español a alemán un traductor jurado valora tu documento antes de cerrarte el presupuesto.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de alemán?",
          answer:
            "De alemán a español, 48 horas desde el pago. En otros documentos, el plazo lo confirma el traductor jurado en el presupuesto, normalmente el mismo día.",
        },
        {
          question: "¿Se necesita Apostilla para usar una traducción jurada en Alemania, Austria o Suiza?",
          answer:
            "Alemania, Austria y Suiza son firmantes del Convenio de la Haya, por lo que puede requerirse Apostilla. Para trámites dentro de España normalmente no es necesaria. Te orientamos según tu caso concreto.",
        },
        {
          question: "¿Qué documentos en alemán se traducen con más frecuencia?",
          answer:
            "Los más habituales son: Geburtsurkunde (certificado de nacimiento), Heiratsurkunde (matrimonio), Führungszeugnis (antecedentes penales), Abschlusszeugnis (título académico), Arbeitsvertrag y Gehaltsabrechnungen (documentos laborales).",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados del Registro Civil",
          descripcion:
            "Geburtsurkunde, Heiratsurkunde, Scheidungsurteil, Sterbeurkunde y otros certificados necesarios para extranjería, nacionalidad, matrimonio o herencias en España.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Certificados de antecedentes y buena conducta",
          descripcion:
            "Führungszeugnis y certificados equivalentes para oposiciones, permisos de residencia, empleo público o privado y otros trámites oficiales en España.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Títulos y expedientes académicos",
          descripcion:
            "Abschlusszeugnis, Diploma, Notenübersicht, Studienbescheinigung, certificados de formación profesional y universitaria necesarios para homologaciones, convalidaciones y estudios en España.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos laborales y mercantiles",
          descripcion:
            "Arbeitsvertrag, Arbeitszeugnis, Gehaltsabrechnungen, Handelsregisterauszug, Gesellschaftsverträge y otros documentos para trabajar, percibir pensiones, invertir u operar con sociedades en España y en países de habla alemana.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
