import type { MetadataRoute } from "next";

const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "CCBot",
  "Google-Extended",
  "anthropic-ai",
  "ClaudeBot",
  "Bytespider",
  "Amazonbot",
  "FacebookBot",
  "Applebot-Extended",
  "PerplexityBot",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.traduccionesjuradas.net";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/area-cliente/",
          "/zona-traductor/",
          "/admin/",
          "/acceso",
          "/q/",
        ],
      },
      // AI crawlers: bloqueados en general (proteger catalogo y blog
      // de scraping para entrenamiento), pero PERMITIDOS en /uge-ce/
      // donde queremos cita por LLMs (estrategia AEO).
      ...AI_CRAWLERS.map((bot) => ({
        userAgent: bot,
        allow: ["/uge-ce/", "/uge-ce/sitemap.xml"],
        disallow: ["/"],
      })),
    ],
    sitemap: [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/uge-ce/sitemap.xml`,
    ],
  };
}
