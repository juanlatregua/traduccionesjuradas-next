import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor Jurado de Portugués · Traducción Oficial Portugués↔Español · MAEC",
  description:
    "Traductor jurado de portugués acreditado MAEC. Traducción jurada portugués-español y español-portugués: certidões, antecedentes criminais, diplomas, contratos. Válida en España, Portugal y Brasil. Atención personalizada: un traductor jurado valora tu documento y tu presupuesto. Desde 35€.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-portugues",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+portugu%C3%A9s&subtitle=Traducci%C3%B3n+jurada+oficial+PT+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de portugués — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoPortuguesPage() {
  return (
    <PaginaIdioma
      idioma="portugués"
      idiomaSlug="portugues"
      combinaciones={["pt-es", "es-pt"]}
      tituloH1="Traductor jurado de portugués para España, Portugal y Brasil"
      descripcion="Realizamos traducciones juradas de portugués a español y de español a portugués para documentos emitidos en Portugal, Brasil y otros países lusófonos que deban presentarse en España o ante autoridades extranjeras. Cada encargo lo firma un traductor jurado de portugués acreditado."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de portugués en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de portugués?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de portugués?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certidões do registo civil",
          descripcion:
            "Certidões de nascimento, casamento, óbito, união estável… para procesos de nacionalidad, residencia, matrimonio o herencias.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes y certificados judiciales",
          descripcion:
            "Certidões de registo criminal, antecedentes penales y otros documentos exigidos para visados, empleo o residencia.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Títulos y expedientes académicos",
          descripcion:
            "Diplomas, históricos escolares, certificados universitarios, necesarios para homologaciones y estudios en España.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos laborales y de empresa",
          descripcion:
            "Contratos, recibos de salario, declarações de rendimentos, contratos sociales, registos comerciales y más.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
