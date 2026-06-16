import type { MetadataRoute } from "next";

// Rutas privadas que ningún bot debe rastrear.
const PRIVATE_PATHS = ["/area-cliente/", "/zona-traductor/", "/admin/", "/acceso", "/q/"];

// Bots de CITA / recuperación en vivo: cuando responden a un usuario buscan y
// CITAN la fuente. Les abrimos el sitio (estrategia AEO) para aparecer en las
// respuestas de ChatGPT, Perplexity y las AI Overviews de Google.
const CITATION_AI = ["ChatGPT-User", "OAI-SearchBot", "PerplexityBot", "Google-Extended"];

// Bots de puro ENTRENAMIENTO/scraping masivo: siguen bloqueados en todo el sitio
// salvo /uge-ce/ (no regalamos el catálogo/blog al entrenamiento).
const TRAINING_AI = [
  "GPTBot",
  "CCBot",
  "anthropic-ai",
  "ClaudeBot",
  "Bytespider",
  "Amazonbot",
  "FacebookBot",
  "Applebot-Extended",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.traduccionesjuradas.net";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
      // Bots de cita: mismo trato que un buscador normal (todo lo público).
      ...CITATION_AI.map((bot) => ({
        userAgent: bot,
        allow: "/",
        disallow: PRIVATE_PATHS,
      })),
      // Bots de entrenamiento: bloqueados salvo /uge-ce/.
      ...TRAINING_AI.map((bot) => ({
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
