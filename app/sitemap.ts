import type { MetadataRoute } from "next";
import { posts } from "@/content";
import { CIUDADES } from "@/src/data/ciudades";

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

/**
 * Fechas reales de última modificación por ruta (basadas en historial git).
 * Actualizar manualmente cuando se modifique el contenido de una página.
 */
const LAST_MODIFIED: Record<string, string> = {
  "/":                                              "2026-03-04",
  "/proceso":                                       "2026-03-01",
  "/preguntas-frecuentes":                          "2026-03-01",
  "/precios-traduccion-jurada":                     "2026-03-04",
  "/presupuesto-instantaneo":                       "2026-03-04",
  "/traducciones-juradas-baratas":                  "2026-01-17",
  "/traduccion-jurada-online":                      "2026-02-08",
  "/traduccion-jurada-frances-malaga":              "2026-02-15",
  "/traductores-jurados":                           "2026-03-04",
  "/acreditacion":                                  "2026-03-04",
  "/contacto":                                      "2026-01-29",
  "/marruecos":                                     "2026-03-04",
  "/documentos-oficiales":                          "2026-03-04",
  "/documentos-oficiales/certificados-registro-civil": "2026-01-30",
  "/documentos-oficiales/certificado-de-nacimiento":   "2026-03-04",
  "/documentos-oficiales/certificado-de-matrimonio":   "2026-02-08",
  "/documentos-oficiales/antecedentes-penales":        "2026-01-30",
  "/documentos-oficiales/documentos-academicos":       "2026-01-30",
  "/documentos-oficiales/documentos-laborales":        "2026-03-04",
  "/documentos-oficiales/documentos-juridicos":        "2026-03-04",
  "/documentos-oficiales/documentos-mercantiles":      "2026-03-04",
  "/documentos-oficiales/apostilla-haya":              "2026-03-04",
  "/traduccion-jurada-permiso-de-conducir":          "2026-03-10",
  "/traduccion-jurada-antecedentes-penales":         "2026-03-10",
  "/traduccion-jurada-sentencia-judicial":           "2026-03-10",
  "/traduccion-jurada-de-escritura-notarial":        "2026-03-10",
  "/traduccion-jurada-de-estatutos-sociales":        "2026-03-10",
  "/traduccion-jurada-de-certificado-de-seguridad-social": "2026-03-10",
  "/teletrabajo":                                   "2026-03-04",
  "/traductor-jurado-frances":                      "2026-03-04",
  "/traductor-jurado-aleman":                       "2026-03-03",
  "/traductor-jurado-ingles":                       "2026-03-03",
  "/traductor-jurado-neerlandes":                   "2026-03-03",
  "/traductor-jurado-italiano":                     "2026-03-03",
  "/traductor-jurado-portugues":                    "2026-03-03",
  "/traductor-jurado-rumano":                       "2026-03-03",
  "/traductor-jurado-catalan":                      "2026-03-03",
  "/traductor-jurado-sueco":                        "2026-03-03",
  "/traductor-jurado-noruego":                      "2026-03-03",
  "/aviso-legal":                                   "2026-01-28",
  "/privacidad":                                    "2026-01-28",
  "/politica-de-cookies":                           "2026-01-28",
};

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://www.traduccionesjuradas.net";

  const routes = Object.keys(LAST_MODIFIED);

  const staticEntries = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(LAST_MODIFIED[route]),
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

  const blogIndex = blogEntries.length > 0 ? {
    url: `${baseUrl}/blog`,
    lastModified: new Date(blogEntries[0].lastModified),
    changeFrequency: "weekly" as ChangeFreq,
    priority: 0.8,
  } : null;

  const citiesLastModified = new Date("2026-03-04");
  const cityEntries = CIUDADES.map((ciudad) => ({
    url: `${baseUrl}/traductor-jurado/${ciudad.slug}`,
    lastModified: citiesLastModified,
    changeFrequency: "monthly" as ChangeFreq,
    priority: 0.7,
  }));

  return [...staticEntries, ...cityEntries, blogIndex, ...blogEntries].filter(Boolean) as MetadataRoute.Sitemap;
}
