import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor jurado de catalán | Traducciones juradas catalán-español",
  description:
    "Traducciones juradas de catalán a español y de español a catalán realizadas por traductores jurados. Válidas para trámites en Cataluña, Valencia, Baleares y el resto de España.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-catalan",
  },
};

export default function TraductorJuradoCatalanPage() {
  return (
    <PaginaIdioma
      idioma="catalán"
      idiomaSlug="catalan"
      precioPorPalabra={0.10}
      combinaciones={["ca-es", "es-ca"]}
      tituloH1="Traductor jurado de catalán para trámites en toda España"
      descripcion="Realizamos traducciones juradas de catalán a español y de español a catalán para documentos emitidos en Cataluña, Comunidad Valenciana, Islas Baleares y otras administraciones que usen el catalán como lengua de trabajo."
      faqItems={[
        {
          question: "¿Cuándo necesito una traducción jurada de catalán?",
          answer:
            "Cuando un documento emitido en catalán debe presentarse ante una administración estatal o en otro país que no acepta el catalán como lengua oficial, se requiere traducción jurada al castellano o al idioma de destino.",
        },
        {
          question: "¿Cuánto cuesta una traducción jurada de catalán?",
          answer:
            "El precio depende del tipo de documento, su extensión y la urgencia. Confirmamos presupuesto cerrado tras revisar el archivo.",
        },
        {
          question: "¿En cuánto tiempo se entrega una traducción jurada de catalán?",
          answer:
            "Los certificados sencillos suelen resolverse en 24-72 horas laborables, y los expedientes extensos requieren más plazo según volumen.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificados civiles y administrativos",
          descripcion:
            "Certificats de naixement, matrimoni, defunció, empadronament, convivència, etc.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Títulos y expedientes académicos",
          descripcion:
            "Títols universitaris, certificats de notes, expedients acadèmics, certificats de capacitació, etc.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Documentos judiciales y notariales",
          descripcion:
            "Sentències, decrets, escriptures, poders notarials i altres documents que han de presentar-se en altres territoris.",
          enlace: "/documentos-oficiales/documentos-juridicos",
        },
        {
          titulo: "Documentos laborales y de empresa",
          descripcion:
            "Contractes, nòmines, certificats d'empresa, estatuts socials i altres documents per a tràmits a escala estatal o internacional.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
      ]}
    />
  );
}
