import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor jurado de francés oficial | Precio y entrega 24-72h",
  description:
    "Traducción jurada de francés para extranjería, estudios, notaría y empresa. Traductor jurado acreditado por MAEC, presupuesto cerrado y entrega online en PDF firmado.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
  },
};

export default function TraductorJuradoFrancesPage() {
  return (
    <PaginaIdioma
      idioma="francés"
      idiomaSlug="frances"
      combinaciones={["fr-es", "es-fr"]}
      tituloH1="Traducción jurada de francés para trámites oficiales en España y en países francófonos"
      descripcion="La traducción jurada de francés es el formato que te piden cuando un documento en francés debe presentarse ante una administración, notaría, universidad o juzgado en España, o cuando un documento español se utiliza en Francia y otros países francófonos. Precio orientativo, plazo estimado, validez oficial y tipos de documentos más frecuentes. Todas las traducciones las firma un traductor jurado de francés acreditado por el MAEC, con entrega en PDF firmado digitalmente."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de francés en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta traducir un certificado en francés?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de francés?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados del Registro Civil",
          descripcion:
            "Actes de naissance, mariage, divorce, décès, certificats de célibat, certificats de coutume y otros documentos del état civil necesarios para extranjería, nacionalidad o herencias.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes penales y buena conducta",
          descripcion:
            "Extrait de casier judiciaire, certificats de bonne conduite u otros documentos exigidos para visados, permisos de residencia, oposiciones o empleo en España.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Títulos y expedientes académicos",
          descripcion:
            "Diplômes, relevés de notes, attestations de réussite, programas de estudios, certificados de escolaridad y otros documentos necesarios para homologaciones, estudios universitarios y oposiciones.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos mercantiles y laborales",
          descripcion:
            "Contrats de travail, fiches de paie, attestations de salaire, statuts de société, extraits Kbis, procès-verbaux y otros documentos necesarios para trabajar o invertir en España.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
