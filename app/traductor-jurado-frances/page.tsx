import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor Jurado de Franc\u00E9s \u00B7 Oficial MAEC n\u00BA 3850 \u00B7 Franc\u00E9s\u2194Espa\u00F1ol",
  description:
    "Traductor jurado de franc\u00E9s oficial (MAEC n\u00BA 3850). Traducci\u00F3n jurada franc\u00E9s-espa\u00F1ol y espa\u00F1ol-franc\u00E9s. Documentos legales, antecedentes penales, t\u00EDtulos acad\u00E9micos. Desde 35\u20AC.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-frances",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+franc%C3%A9s&subtitle=Traducci%C3%B3n+jurada+oficial+FR+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de francés — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoFrancesPage() {
  return (
    <PaginaIdioma
      idioma="francés"
      idiomaSlug="frances"
      combinaciones={["fr-es", "es-fr"]}
      tituloH1="Traducción jurada de francés para trámites oficiales en España y en países francófonos"
      descripcion="La traducción jurada de francés es el formato que te piden cuando un documento en francés debe presentarse ante una administración, notaría, universidad o juzgado en España, o cuando un documento español se utiliza en Francia y otros países francófonos. Precio cerrado, plazo estimado, validez oficial y tipos de documentos más frecuentes. Todas las traducciones las firma un traductor jurado de francés acreditado por el MAEC, con entrega en PDF firmado digitalmente."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de francés en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Cuánto cuesta traducir un certificado en francés?",
          answer:
            "Un certificado sencillo (nacimiento, matrimonio) parte de 42 € IVA incluido. Los documentos extensos se presupuestan por palabras (desde 0,08 €/palabra). Sube tu documento y recibe precio cerrado al instante.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de francés?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
        {
          question: "¿Necesito apostillar la traducción jurada de francés?",
          answer:
            "Depende del país de destino. Para Francia y otros países firmantes del Convenio de la Haya, se necesita Apostilla. Para trámites dentro de España normalmente no es necesaria. Te orientamos según tu caso concreto.",
        },
        {
          question: "¿Qué documentos franceses se traducen con más frecuencia?",
          answer:
            "Los más habituales son: acte de naissance (certificado de nacimiento), acte de mariage (matrimonio), extrait de casier judiciaire (antecedentes penales / Bulletin nº3), diplômes et relevés de notes (títulos académicos), contrats de travail y fiches de paie (documentos laborales).",
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
