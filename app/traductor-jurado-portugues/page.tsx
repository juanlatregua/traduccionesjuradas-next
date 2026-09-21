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
      updated="2026-09-21"
      tituloH1="Traductor jurado de portugués para España, Portugal y Brasil"
      descripcion="Realizamos traducciones juradas de portugués a español y de español a portugués para certidões, antecedentes penales, diplomas y contratos emitidos en Portugal, Brasil u otros países lusófonos que deban presentarse ante administraciones, notarías, universidades o juzgados en España. El mismo traductor jurado acreditado por el MAEC firma la traducción, sea cual sea el origen del documento."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de portugués en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿Es lo mismo traducir un documento de Portugal que uno de Brasil?",
          answer:
            "El portugués europeo y el portugués de Brasil comparten idioma oficial, así que un traductor jurado de portugués acreditado por el MAEC puede traducir documentos de ambos orígenes. Lo que cambia es el tipo de documento y su legalización: Portugal, como Estado miembro de la UE, se beneficia además del Reglamento (UE) 2016/1191 para determinados documentos públicos (ver más abajo), mientras que los documentos brasileños siguen la vía general del Convenio de la Haya.",
        },
        {
          question: "¿Cómo se traduce el certificado de antecedentes penales (certidão de registo criminal / antecedentes criminais)?",
          answer:
            "El certidão de registo criminal portugués y el atestado de antecedentes criminais brasileño se traducen de forma jurada, con firma y sello del traductor jurado, y se presentan junto con el original o su copia legalizada, según exija el organismo español (extranjería, nacionalidad, oposiciones). Comprueba siempre con el organismo el plazo de vigencia que le exige al certificado.",
        },
        {
          question: "¿Traducen la certidão de nascimento (certificado de nacimiento)?",
          answer:
            "Sí, es uno de los documentos más habituales: la certidão de nascimento portuguesa y la certidão de nascimento brasileña (emitida por el cartório) se traducen para procesos de nacionalidad, residencia, matrimonio o herencias en España.",
        },
        {
          question: "¿Necesito apostillar un documento portugués o brasileño para usarlo en España?",
          answer:
            "Portugal y Brasil son parte del Convenio de La Haya de 1961 sobre la Apostilla (Portugal desde 1969, Brasil desde 2016), según la tabla de estados de la HCCH: https://www.hcch.net/en/instruments/conventions/status-table/?cid=41. Eso significa que, en general, un documento público de esos países se legaliza con Apostilla antes de traducirlo, salvo que el trámite en España no la exija. Se apostilla el documento original, no la traducción.",
        },
        {
          question: "¿Puedo evitar la Apostilla en documentos portugueses gracias al Reglamento europeo?",
          answer:
            "El Reglamento (UE) 2016/1191, en vigor desde el 16 de febrero de 2019, exime de Apostilla y de legalización a determinados documentos públicos (entre ellos, certificados de nacimiento, matrimonio o antecedentes penales) cuando se presentan de un Estado miembro de la UE a otro, incluido Portugal↔España. Verifica el alcance exacto en el texto oficial: https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:32016R1191. Este reglamento no aplica a documentos brasileños, que no son de un Estado miembro de la UE.",
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
            "Certidão de nascimento, certidão de casamento, certidão de óbito, união estável… para procesos de nacionalidad, residencia, matrimonio o herencias.",
          enlace: "/documentos-oficiales/certificados-registro-civil",
        },
        {
          titulo: "Antecedentes y certificados judiciales",
          descripcion:
            "Certidão de registo criminal (Portugal), antecedentes criminais (Brasil) y otros documentos exigidos para visados, empleo o residencia.",
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
            "Contratos, recibos de salario, declarações de rendimentos, contratos sociais, registos comerciales y más.",
          enlace: "/documentos-oficiales/documentos-laborales",
        },
        {
          titulo: "Apostilla de La Haya: qué es y cuándo la necesitas",
          descripcion:
            "Guía general sobre la Apostilla, con las fuentes oficiales para comprobar si tu documento portugués o brasileño la necesita.",
          enlace: "/blog/apostilla-haya-que-es",
        },
      ]}
    />
  );
}
