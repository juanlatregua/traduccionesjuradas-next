import type { Metadata } from "next";
import PaginaIdioma from "@/components/PaginaIdioma";

export const metadata: Metadata = {
  title: "Traductor Jurado de Neerlandés · Traducción Oficial Holandés↔Español · MAEC",
  description:
    "Traductor jurado de neerlandés (holandés) acreditado MAEC. Traducción jurada neerlandés-español y español-neerlandés: geboorteakte, strafblad, diploma's, contracten. Válida en España, Países Bajos y Bélgica. Atención personalizada: un traductor jurado valora tu documento y tu presupuesto. Desde 50 €.",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/traductor-jurado-neerlandes",
  },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Traductor+jurado+de+neerland%C3%A9s&subtitle=Traducci%C3%B3n+jurada+oficial+NL+%E2%86%94+ES",
        width: 1200,
        height: 630,
        alt: "Traductor jurado de neerlandés — TraduccionesJuradas.net",
      },
    ],
  },
};

export default function TraductorJuradoNeerlandesPage() {
  return (
    <PaginaIdioma
      idioma="neerlandés"
      idiomaSlug="neerlandes"
      combinaciones={["nl-es", "es-nl"]}
      tituloH1="Traductor jurado de neerlandés para España, Países Bajos y Bélgica"
      descripcion="Realizamos traducciones juradas de neerlandés a español y de español a neerlandés para trámites en España y en países como Países Bajos y Bélgica: empleo, residencia, estudios, empresas y herencias. Tu documento va directo al traductor jurado de neerlandés por nuestra red directa — con su nombre y nº oficial en el presupuesto, sin plataformas intermediarias."
      faqItems={[
        {
          question: "¿Qué validez tiene una traducción jurada de neerlandés en España?",
          answer:
            "Tiene validez oficial si la firma un traductor jurado nombrado por el MAEC y se entrega con firma y sello conforme a los requisitos del trámite.",
        },
        {
          question: "¿La traducción jurada de neerlandés vale en Bélgica y en Países Bajos?",
          answer:
            "Para presentar documentos españoles en Bélgica o Países Bajos suele exigirse traductor habilitado en destino: en nuestra red contamos con jurados con doble credencial (MAEC en España y Wbtv neerlandesa, 'beëdigd vertaler'), de modo que la misma traducción sirve a ambos lados. Para documentos neerlandeses o belgas presentados en España basta el jurado MAEC.",
        },
        {
          question: "¿Cómo conseguir una traducción jurada de neerlandés?",
          answer:
            "Sube el documento por la web o WhatsApp: lo ve directamente el traductor jurado de neerlandés de nuestra red, pone precio cerrado y recibes el presupuesto con su nombre y su número oficial. Al pagar, esa misma persona firma y sella tu traducción y la recibes en PDF con firma digital o en papel por mensajería.",
        },
        {
          question: "¿Traducen certificados de nacimiento neerlandeses (geboorteakte)?",
          answer:
            "Sí, es uno de los documentos más habituales: geboorteakte, huwelijksakte y VOG para extranjería, matrimonio o nacionalidad en España. Los certificados sencillos suelen entregarse en 24-72 horas laborables.",
        },
        {
          question: "¿Hacen traducción jurídica de neerlandés?",
          answer:
            "Sí: contratos, escrituras, sentencias, estatutos y documentación societaria neerlandesa o belga, traducidos por jurados con experiencia jurídica. Si el documento debe surtir efectos oficiales, la entrega es jurada con firma y sello.",
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
        {
          titulo: "Neerlandés para Bélgica: Flandes y Bruselas",
          descripcion:
            "Actas belgas, uittreksel strafregister, diplomas flamencos y documentos notariales en neerlandés, con lo que exige cada trámite entre Bélgica y España.",
          enlace: "/traduccion-jurada-neerlandes-belgica",
        },
        {
          titulo: "Guía: documentos de Países Bajos y Bélgica",
          descripcion:
            "Apostilla en el rechtbank o vía LegalWeb, el VOG en papel, el Reglamento UE 2016/1191 y los precios de cada documento, explicados paso a paso.",
          enlace: "/blog/documentos-neerlandeses-espana",
        },
        {
          titulo: "Así trabajamos: red directa de traductores jurados",
          descripcion:
            "Tu documento va directo al jurado de neerlandés, con su nombre y nº oficial en tu presupuesto — sin cadenas de agencias. Conoce cómo funciona la red.",
          enlace: "/red-de-traductores-jurados",
        },
      ]}
    />
  );
}
