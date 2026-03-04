import type { MetadataRoute } from "next";
import { posts } from "@/content";

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

function getChangeFrequency(route: string): ChangeFreq {
  // Home and key service pages: weekly
  if (
    route === "/" ||
    route === "/presupuesto-instantaneo" ||
    route === "/precios-traduccion-jurada"
  ) {
    return "weekly";
  }

  // Legal pages: yearly
  if (
    route === "/privacidad" ||
    route === "/aviso-legal" ||
    route === "/politica-de-cookies"
  ) {
    return "yearly";
  }

  // Everything else (documentos-oficiales/*, traductor-jurado-*, proceso, traductores-jurados, contacto, etc.): monthly
  return "monthly";
}

function getPriority(route: string): number {
  // Home
  if (route === "/") {
    return 1.0;
  }

  // Service pages
  if (
    route === "/presupuesto-instantaneo" ||
    route === "/precios-traduccion-jurada" ||
    route === "/documentos-oficiales"
  ) {
    return 0.9;
  }

  // Blog pages
  if (route.startsWith("/blog")) {
    return 0.7;
  }

  // Document sub-pages and language pages
  if (route.startsWith("/documentos-oficiales/") || route.startsWith("/traductor-jurado-")) {
    return 0.8;
  }

  // Info pages
  if (
    route === "/proceso" ||
    route === "/traductores-jurados" ||
    route === "/acreditacion" ||
    route === "/contacto"
  ) {
    return 0.7;
  }

  // Legal pages
  if (
    route === "/privacidad" ||
    route === "/aviso-legal" ||
    route === "/politica-de-cookies"
  ) {
    return 0.3;
  }

  // Everything else (traducciones-juradas-baratas, traduccion-jurada-online, etc.)
  return 0.7;
}

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
    "/acreditacion",
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

  const staticEntries = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: getChangeFrequency(route),
    priority: getPriority(route),
  }));

  const blogEntries = posts
    .filter((p) => p.published)
    .map((post) => ({
      url: `${baseUrl}/blog/${post.slugAsParams}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly" as ChangeFreq,
      priority: 0.7,
    }));

  return [...staticEntries, blogEntries.length > 0 ? {
    url: `${baseUrl}/blog`,
    lastModified: now,
    changeFrequency: "weekly" as ChangeFreq,
    priority: 0.8,
  } : null, ...blogEntries].filter(Boolean) as MetadataRoute.Sitemap;
}
