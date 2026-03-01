import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor jurado de alemán | Traducciones juradas alemán-español",
  description:
    "Traducciones juradas de alemán a español y de español a alemán realizadas por traductores jurados acreditados. Válidas para trámites en España, Alemania, Austria, Suiza y otros países germanoparlantes.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-aleman",
  },
};

export default function TraductorJuradoAlemanPage() {
  return (
    <PaginaIdioma
      idioma="alemán"
      idiomaSlug="aleman"
      combinaciones={["de-es", "es-de"]}
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
            "El precio orientativo de un certificado sencillo (Geburtsurkunde, Heiratsurkunde) parte de 42 € IVA incluido. Los documentos extensos se presupuestan por palabras (desde 0,08 €/palabra). Enviamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de alemán?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
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
