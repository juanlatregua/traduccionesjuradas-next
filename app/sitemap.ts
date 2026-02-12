import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.traduccionesjuradas.net";

  const routes = [
    "/",                          // home
    "/proceso",
    "/preguntas-frecuentes",
    "/precios-traduccion-jurada",
    "/traduccion-jurada-online",
    "/traducciones-juradas-baratas",
    "/documentos-oficiales",
    "/documentos-oficiales/certificados-registro-civil",
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
    "/traductor-jurado-catalan",
    "/traductor-jurado-sueco",
    "/traductor-jurado-noruego",
  ];

  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
