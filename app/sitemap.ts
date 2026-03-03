import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.traduccionesjuradas.net";

  const routes = [
    "/",                          // home
    "/proceso",
    "/preguntas-frecuentes",
    "/precios-traduccion-jurada",
    "/presupuesto-instantaneo",
    "/traducciones-juradas-baratas",
    "/traduccion-jurada-online",
    "/traduccion-jurada-frances-malaga",
    "/traductores-jurados",
    "/contacto",
    "/marruecos",
    "/documentos-oficiales",
    "/documentos-oficiales/certificados-registro-civil",
    "/documentos-oficiales/certificado-de-nacimiento",
    "/documentos-oficiales/certificado-de-matrimonio",
    "/documentos-oficiales/antecedentes-penales",
    "/documentos-oficiales/documentos-academicos",
    "/documentos-oficiales/documentos-laborales",
    "/documentos-oficiales/documentos-juridicos",
    "/documentos-oficiales/documentos-mercantiles",
    "/documentos-oficiales/apostilla-haya",
    "/teletrabajo",
    "/traductor-jurado-frances",
    "/traductor-jurado-aleman",
    "/traductor-jurado-ingles",
    "/traductor-jurado-neerlandes",
    "/traductor-jurado-italiano",
    "/traductor-jurado-portugues",
    "/traductor-jurado-rumano",
    "/traductor-jurado-catalan",
    "/traductor-jurado-sueco",
    "/traductor-jurado-noruego",
    "/aviso-legal",
    "/privacidad",
    "/politica-de-cookies",
  ];

  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
