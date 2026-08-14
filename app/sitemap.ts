import type { MetadataRoute } from "next";
import { posts } from "@/content";
import { CIUDADES } from "@/src/data/ciudades";

type ChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

function getChangeFrequency(route: string): ChangeFreq {
  // Home and key service pages: weekly
  if (
    route === "/" ||
    route === "/presupuesto-instantaneo" ||
    route === "/precios-traduccion-jurada" ||
    route.startsWith("/regularizacion-2026")
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
    route === "/expediente" ||
    route === "/traduction-assermentee" ||
    route === "/sworn-translation" ||
    route === "/beglaubigte-uebersetzung" ||
    route === "/traducao-certificada" ||
    route === "/precios-traduccion-jurada" ||
    route === "/documentos-oficiales" ||
    route === "/regularizacion-2026"
  ) {
    return 0.9;
  }

  // Regularización 2026 sub-pages (time-bound, high value)
  if (route.startsWith("/regularizacion-2026/")) {
    return 0.85;
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
    route === "/red-de-traductores-jurados" ||
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
  "/":                                              "2026-04-29",
  "/proceso":                                       "2026-03-01",
  "/preguntas-frecuentes":                          "2026-03-01",
  "/como-escanear-bien":                             "2026-04-17",
  "/precios-traduccion-jurada":                     "2026-03-04",
  "/presupuesto-instantaneo":                       "2026-03-04",
  "/expediente":                                    "2026-05-29",
  "/traduction-assermentee":                        "2026-05-29",
  "/sworn-translation":                             "2026-05-30",
  "/beglaubigte-uebersetzung":                      "2026-05-30",
  "/traducao-certificada":                          "2026-05-30",
  "/fr/acheter-bien-immobilier-espagne":            "2026-05-29",
  "/fr/declaration-non-resident-espagne":           "2026-05-29",
  "/fr/diagnostic-fiscal":                          "2026-08-14",
  "/traducciones-juradas-baratas":                  "2026-07-22",
  "/traduccion-jurada-online":                      "2026-07-18",
  "/traduccion-jurada-frances-malaga":              "2026-02-15",
  "/traductores-jurados":                           "2026-04-29",
  "/red-de-traductores-jurados":                    "2026-08-14",
  "/acreditacion":                                  "2026-03-04",
  "/contacto":                                      "2026-01-29",
  "/marruecos":                                     "2026-07-18",
  "/documentos-oficiales":                          "2026-03-04",
  "/documentos-oficiales/certificados-registro-civil": "2026-01-30",
  "/documentos-oficiales/certificado-de-nacimiento":   "2026-03-04",
  "/documentos-oficiales/certificado-de-matrimonio":   "2026-02-08",
  "/documentos-oficiales/antecedentes-penales":        "2026-07-18",
  "/documentos-oficiales/documentos-academicos":       "2026-01-30",
  "/documentos-oficiales/documentos-laborales":        "2026-03-04",
  "/documentos-oficiales/documentos-juridicos":        "2026-03-04",
  "/documentos-oficiales/documentos-mercantiles":      "2026-03-04",
  "/documentos-oficiales/apostilla-haya":              "2026-03-04",
  "/traduccion-jurada-permiso-de-conducir":          "2026-03-10",
  "/traduccion-jurada-antecedentes-penales":         "2026-07-18",
  "/traduccion-jurada-sentencia-judicial":           "2026-03-10",
  "/traduccion-jurada-de-estatutos-sociales":        "2026-03-10",
  "/traduccion-jurada-de-certificado-de-seguridad-social": "2026-03-10",
  "/teletrabajo":                                   "2026-03-04",
  "/traductor-jurado-frances":                      "2026-07-18",
  "/traductor-jurado-aleman":                       "2026-07-18",
  "/traductor-jurado-ingles":                       "2026-07-18",
  "/traductor-jurado-neerlandes":                   "2026-08-14",
  "/traductor-jurado-italiano":                     "2026-07-18",
  "/traductor-jurado-portugues":                    "2026-07-18",
  "/traductor-jurado-rumano":                       "2026-07-18",
  "/traductor-jurado-catalan":                      "2026-07-18",
  "/traductor-jurado-sueco":                        "2026-07-18",
  "/traductor-jurado-noruego":                      "2026-07-18",
  "/aviso-legal":                                   "2026-01-28",
  "/privacidad":                                    "2026-01-28",
  "/politica-de-cookies":                           "2026-01-28",
  "/devoluciones":                                  "2026-04-27",
  "/regularizacion-2026":                           "2026-05-03",
  "/regularizacion-2026/marruecos":                 "2026-05-03",
  "/regularizacion-2026/senegal":                   "2026-05-03",
  "/regularizacion-2026/costa-de-marfil":           "2026-05-03",
  "/regularizacion-2026/mali":                      "2026-05-03",
  "/regularizacion-2026/guinea":                    "2026-05-03",
  "/regularizacion-2026/camerun":                   "2026-05-03",
  // Lector de requerimientos (utilidad flagship v2), slugs híbridos por idioma.
  "/que-traducciones-necesito":                     "2026-06-02",
  "/quelles-traductions-pour-ma-demarche":          "2026-06-02",
  "/official-letter-reader":                        "2026-06-02",
  "/behoerdenbrief-leser":                          "2026-06-02",
  "/leitor-de-notificacoes":                        "2026-06-02",
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
      lastModified: new Date(post.dateModified || post.date),
      changeFrequency: "monthly" as ChangeFreq,
      priority: 0.7,
    }));

  // El índice se fecha con el post MÁS RECIENTE, no con blogEntries[0]: la lista
  // no viene ordenada, así que el hub declaraba meses de antigüedad falsa y
  // Google lo recrawleaba menos de lo que toca (lastmod es señal de prioridad).
  const blogIndex = blogEntries.length > 0 ? {
    url: `${baseUrl}/blog`,
    lastModified: new Date(Math.max(...blogEntries.map((e) => e.lastModified.getTime()))),
    changeFrequency: "weekly" as ChangeFreq,
    priority: 0.8,
  } : null;

  // 18-jul-2026: title y meta description de las 34 ciudades pasaron a derivarse
  // del dato real de cada una. Sin tocar esta fecha, el sitemap le diría a Google
  // que no ha cambiado nada justo cuando se le pide que las revise.
  const citiesLastModified = new Date("2026-07-18");
  // La cola consolidada (noindex) NO va al sitemap; sí el hub /traductor-jurado.
  const cityEntries = [
    {
      url: `${baseUrl}/traductor-jurado`,
      lastModified: citiesLastModified,
      changeFrequency: "monthly" as ChangeFreq,
      priority: 0.8,
    },
    ...CIUDADES.filter((ciudad) => !ciudad.noindex).map((ciudad) => ({
      url: `${baseUrl}/traductor-jurado/${ciudad.slug}`,
      lastModified: citiesLastModified,
      changeFrequency: "monthly" as ChangeFreq,
      priority: 0.7,
    })),
  ];

  return [...staticEntries, ...cityEntries, blogIndex, ...blogEntries].filter(Boolean) as MetadataRoute.Sitemap;
}
