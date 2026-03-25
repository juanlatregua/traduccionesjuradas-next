import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title:
    "Traductor jurado de rumano | Traducción jurada rumano-español",
  description:
    "Traducción jurada oficial de rumano a español y español a rumano. Traductor jurado MAEC. Precio cerrado al instante, entrega en PDF firmado. Desde 35€.",
  alternates: {
    canonical:
      "https://www.traduccionesjuradas.net/traductor-jurado-rumano",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+rumano&subtitle=Traducci%C3%B3n+jurada+oficial+RO+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de rumano — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoRumanoPage() {
  return (
    <PaginaIdioma
      idioma="rumano"
      idiomaSlug="rumano"
      combinaciones={["ro-es", "es-ro"]}
      tituloH1="Traductor jurado de rumano — Traducción jurada oficial"
      descripcion="Traducción jurada de rumano a español y de español a rumano. Servicio oficial con traductor jurado nombrado por el Ministerio de Asuntos Exteriores. Precio cerrado al instante, entrega en PDF firmado digitalmente."
      faqItems={[
        {
          question: "¿Cuánto cuesta una traducción jurada de rumano?",
          answer:
            "El precio depende del tipo de documento y su extensión. La tarifa base es de 0,09 €/palabra, con un mínimo de 35 € por documento. Sube tu documento y obtén precio cerrado al instante.",
        },
        {
          question:
            "¿Cuánto tarda una traducción jurada de rumano a español?",
          answer:
            "El plazo estándar es de 3 a 5 días laborables, según la extensión del documento.",
        },
        {
          question:
            "¿Tiene validez oficial la traducción jurada de rumano?",
          answer:
            "Sí. Nuestras traducciones están firmadas por traductor jurado nombrado oficialmente por el Ministerio de Asuntos Exteriores de España. Son válidas para cualquier trámite administrativo, judicial o académico.",
        },
        {
          question:
            "¿Qué documentos rumanos traducís con más frecuencia?",
          answer:
            "Los más habituales son certificados de nacimiento (certificat de naștere), antecedentes penales (cazier judiciar), títulos universitarios (diplomă de licență) y certificados de matrimonio (certificat de căsătorie).",
        },
        {
          question:
            "¿Necesito apostillar el documento antes de traducirlo?",
          answer:
            "Depende del trámite. Como Rumanía y España son miembros de la UE, muchos documentos con apostilla de La Haya o certificación oficial son aceptados directamente. Podemos orientarte sobre tu caso concreto.",
        },
      ]}
      documentosHabituales={[
        {
          titulo: "Certificado de nacimiento (Certificat de naștere)",
          descripcion:
            "Traducción jurada del acta de nacimiento rumana para trámites de residencia, nacionalidad o registro civil en España.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Certificado de matrimonio (Certificat de căsătorie)",
          descripcion:
            "Traducción oficial del acta de matrimonio rumana, necesaria para inscripción en el Registro Civil español.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes penales (Cazier judiciar)",
          descripcion:
            "Traducción jurada del certificado de antecedentes penales de Rumanía, imprescindible para permisos de residencia y trabajo.",
          enlace: "/documentos-oficiales/antecedentes-penales",
        },
        {
          titulo: "Título universitario (Diplomă de licență)",
          descripcion:
            "Traducción jurada de títulos y diplomas rumanos para homologación y reconocimiento académico en España.",
          enlace: "/documentos-oficiales/documentos-academicos",
        },
        {
          titulo: "Certificado de defunción (Certificat de deces)",
          descripcion:
            "Traducción oficial del acta de defunción rumana para trámites hereditarios y registrales.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Permiso de conducir (Permis de conducere)",
          descripcion:
            "Traducción jurada del carnet de conducir rumano para canje o validación en España.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
      ]}
    />
  );
}
