// lib/search/site-index.ts — Índice del buscador del sitio.
//
// SOLO se importa en server components (layout, /buscar). Construye un índice
// "lean" (título · ruta · grupo · keywords) que se pasa como prop al header
// cliente; así NO se envía al bundle el array completo de CIUDADES (pesado).

import { posts } from "@/content";
import { CIUDADES } from "@/src/data/ciudades";
import type { SearchEntry } from "./match";

const LANGUAGES: Array<[string, string]> = [
  ["frances", "francés"],
  ["aleman", "alemán"],
  ["ingles", "inglés"],
  ["portugues", "portugués"],
  ["italiano", "italiano"],
  ["neerlandes", "neerlandés"],
  ["catalan", "catalán"],
  ["rumano", "rumano"],
  ["sueco", "sueco"],
  ["noruego", "noruego"],
];

const DOCS: Array<[string, string, string]> = [
  ["certificados-registro-civil", "Certificados del Registro Civil", "nacimiento matrimonio defunción"],
  ["certificado-de-nacimiento", "Certificado de nacimiento", "acta partida nacimiento"],
  ["certificado-de-matrimonio", "Certificado de matrimonio", "acta boda"],
  ["antecedentes-penales", "Antecedentes penales", "casier judiciaire criminal record penales"],
  ["documentos-academicos", "Documentos académicos", "título expediente notas diploma bachillerato universidad"],
  ["documentos-juridicos", "Documentos jurídicos", "sentencia poder contrato escritura"],
  ["documentos-laborales", "Documentos laborales", "nómina contrato trabajo vida laboral seguridad social"],
  ["documentos-mercantiles", "Documentos mercantiles y empresariales", "estatutos sociedad registro mercantil empresa"],
  ["apostilla-haya", "Apostilla de La Haya", "apostille legalización"],
];

const REGULARIZACION: Array<[string, string]> = [
  ["marruecos", "Marruecos"],
  ["senegal", "Senegal"],
  ["costa-de-marfil", "Costa de Marfil"],
  ["mali", "Mali"],
  ["guinea", "Guinea-Conakry"],
  ["camerun", "Camerún"],
];

const CURATED: SearchEntry[] = [
  { title: "Presupuesto instantáneo", path: "/presupuesto-instantaneo", group: "Empezar", keywords: "subir documento precio cotizar cuánto cuesta analizar" },
  { title: "Cómo funciona", path: "/proceso", group: "Información", keywords: "proceso pasos cómo trabajamos" },
  { title: "Precios de traducción jurada", path: "/precios-traduccion-jurada", group: "Información", keywords: "tarifas coste cuánto cuesta precio por palabra" },
  { title: "Preguntas frecuentes", path: "/preguntas-frecuentes", group: "Información", keywords: "faq dudas ayuda" },
  { title: "Blog", path: "/blog", group: "Información", keywords: "guías artículos" },
  { title: "Cómo escanear bien un documento", path: "/como-escanear-bien", group: "Información", keywords: "escaneo foto calidad móvil" },
  { title: "Todos los idiomas", path: "/traductores-jurados", group: "Idiomas", keywords: "idiomas listado traductores jurados" },
  { title: "Documentos oficiales", path: "/documentos-oficiales", group: "Documentos", keywords: "tipos de documento listado" },
  { title: "Documentos para teletrabajar en España", path: "/teletrabajo", group: "Documentos", keywords: "teletrabajo nómada digital UGE-CE autorización" },
  { title: "Traducción jurada online", path: "/traduccion-jurada-online", group: "Información", keywords: "online a distancia internet" },
  { title: "Traducciones juradas baratas", path: "/traducciones-juradas-baratas", group: "Información", keywords: "barato económico precio bajo" },
  { title: "Traducción jurada de escritura notarial", path: "/documentos-oficiales/documentos-juridicos", group: "Documentos", keywords: "notario escritura poder compraventa" },
  { title: "Traducción jurada de sentencia judicial", path: "/traduccion-jurada-sentencia-judicial", group: "Documentos", keywords: "sentencia juzgado divorcio" },
  { title: "Traducción jurada de permiso de conducir", path: "/traduccion-jurada-permiso-de-conducir", group: "Documentos", keywords: "carnet conducir canje dgt" },
  { title: "Traducción jurada de estatutos sociales", path: "/traduccion-jurada-de-estatutos-sociales", group: "Documentos", keywords: "estatutos sociedad empresa mercantil" },
  { title: "Traducción jurada de certificado de Seguridad Social", path: "/traduccion-jurada-de-certificado-de-seguridad-social", group: "Documentos", keywords: "seguridad social vida laboral" },
  { title: "Regularización extraordinaria 2026", path: "/regularizacion-2026", group: "Regularización 2026", keywords: "arraigo extraordinario 25 euros plazo 30 junio" },
  { title: "Área cliente", path: "/area-cliente", group: "Tu cuenta", keywords: "consultar pedido seguimiento estado" },
  { title: "Consultar mi pedido", path: "/consulta-pedido", group: "Tu cuenta", keywords: "estado pedido referencia buscar" },
  { title: "Zona traductor", path: "/zona-traductor", group: "Tu cuenta", keywords: "staff colaborador acceso bandeja" },
];

function buildIndex(): SearchEntry[] {
  const entries: SearchEntry[] = [...CURATED];

  for (const [slug, name] of LANGUAGES) {
    entries.push({
      title: `Traductor jurado de ${name}`,
      path: `/traductor-jurado-${slug}`,
      group: "Idiomas",
      keywords: `traducción jurada ${name}`,
    });
  }

  for (const [slug, title, keywords] of DOCS) {
    entries.push({
      title,
      path: `/documentos-oficiales/${slug}`,
      group: "Documentos",
      keywords,
    });
  }

  for (const [slug, name] of REGULARIZACION) {
    entries.push({
      title: `Regularización 2026 · ${name}`,
      path: `/regularizacion-2026/${slug}`,
      group: "Regularización 2026",
      keywords: `arraigo ${name} antecedentes penales francófono`,
    });
  }

  for (const ciudad of CIUDADES) {
    entries.push({
      title: `Traducción jurada en ${ciudad.nombre}`,
      path: `/traductor-jurado/${ciudad.slug}`,
      group: "Ciudades",
      keywords: `${ciudad.provincia} ${ciudad.comunidad} traductor jurado`,
    });
  }

  for (const post of posts) {
    if (!post.published) continue;
    entries.push({
      title: post.title,
      path: `/blog/${post.slugAsParams}`,
      group: "Blog",
      keywords: post.description || "",
    });
  }

  return entries;
}

export const SITE_SEARCH_INDEX: SearchEntry[] = buildIndex();
