import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor jurado de italiano | Traducciones juradas italiano-español",
  description:
    "Traducciones juradas de italiano a español y de español a italiano realizadas por traductores jurados. Válidas para trámites en España, Italia y otros países de la UE.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-italiano",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+italiano&subtitle=Traducci%C3%B3n+jurada+oficial+IT+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de italiano — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoItalianoPage() {
  return (
    <PaginaIdioma
      idioma="italiano"
      idiomaSlug="italiano"
      combinaciones={["it-es", "es-it"]}
      tituloH1="Traductor jurado de italiano para trámites entre España e Italia"
      descripcion="Realizamos traducciones juradas de italiano a español y de español a italiano para documentos personales, académicos, laborales, notariales y mercantiles. Válidas ante administraciones, notarios, universidades y juzgados en España, Italia y otros países de la Unión Europea. Cada traducción la firma un traductor jurado de italiano, sin plataformas intermediarias."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de italiano en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de italiano?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de italiano?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados del stato civile",
          descripcion:
            "Certificato di nascita, matrimonio, morte, stato di famiglia, cittadinanza… para trámites de extranjería, nacionalidad, matrimonio o herencias en España o Italia.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes y certificados penales",
          descripcion:
            "Certificato del casellario giudiziale, certificato dei carichi pendenti y otros documentos necesarios para empleo, oposiciones o residencia.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Títulos y expedientes académicos",
          descripcion:
            "Diplomi, certificati di laurea, esiti d'esame, piani di studio… para homologaciones, convalidaciones y estudios en España o en otros países.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos laborales y mercantiles",
          descripcion:
            "Contratti di lavoro, buste paga, certificazioni INPS, visure camerali, statuti societari y otros documentos de empresa para trabajar o invertir entre España e Italia.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
