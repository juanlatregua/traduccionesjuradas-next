import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title:
    "Traductor jurado de neerlandés | Traducciones juradas neerlandés-español",
  description:
    "Traducciones juradas de neerlandés a español y de español a neerlandés realizadas por traductores jurados. Válidas para trámites en España, Países Bajos y Bélgica.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-neerlandes",
  },
};

export default function TraductorJuradoNeerlandesPage() {
  return (
    <PaginaIdioma
      idioma="neerlandés"
      idiomaSlug="neerlandes"
      precioPorPalabra={0.14}
      combinaciones={["nl-es", "es-nl"]}
      tituloH1="Traductor jurado de neerlandés para España, Países Bajos y Bélgica"
      descripcion="Realizamos traducciones juradas de neerlandés a español y de español a neerlandés para trámites en España y en países como Países Bajos y Bélgica: empleo, residencia, estudios, empresas y herencias. Cada traducción la firma un traductor jurado de neerlandés, sin plataformas intermediarias."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de neerlandés en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de neerlandés?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de neerlandés?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados del registro civil",
          descripcion:
            "Geboorteakte, huwelijksakte, echtscheidingsakte, overlijdensakte, etc. para trámites de extranjería, nacionalidad, matrimonio o herencias en España.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Títulos y documentos académicos",
          descripcion:
            "Diplomas, cijferlijsten, certificaten, estudios superiores y formación profesional necesarios para homologaciones o acceso a estudios en España.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos laborales",
          descripcion:
            "Arbeidscontract, loonstroken, werkgeversverklaring y otros documentos de trabajo para residir o trabajar en España o para acreditar experiencia profesional.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
        {
          titulo: "Documentos mercantiles y societarios",
          descripcion:
            "Uittreksel Kamer van Koophandel, statuten, jaarrekeningen y otros documentos de empresa para operar, invertir o abrir delegaciones en España.",
          enlace: "/documentos-oficiales/documentos-mercantiles",
        },
      ]}
    />
  );
}
