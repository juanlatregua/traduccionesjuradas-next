import type { MetadataRoute } from "next";

// Rutas privadas: nunca indexar/rastrear (clientes, staff, tokens de pago).
const PRIVATE = ["/area-cliente/", "/zona-traductor/", "/admin/", "/acceso", "/q/"];

// Bots de RESPUESTA / retrieval: citan el contenido en respuestas de IA y traen
// visibilidad (AEO). Se les abre TODO el público — queremos que encuentren y
// citen las páginas de idioma y el blog (francés es la prioridad).
const ANSWER_BOTS = [
  "PerplexityBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended", // Gemini / AI Overviews
  "ChatGPT-User", // navegación en vivo de ChatGPT
  "OAI-SearchBot",
];

// Scrapers de ENTRENAMIENTO puro: bulk-scrape sin tráfico de vuelta. Se siguen
// restringiendo (solo /uge-ce/, donde sí queremos cita por LLMs).
const TRAINING_SCRAPERS = [
  "GPTBot",
  "CCBot",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "FacebookBot",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://www.traduccionesjuradas.net";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE,
      },
      // Bots de respuesta: mismo acceso que un buscador → todo el público,
      // solo bloqueadas las rutas privadas (AEO abierta).
      ...ANSWER_BOTS.map((bot) => ({
        userAgent: bot,
        allow: "/",
        disallow: PRIVATE,
      })),
      // Scrapers de entrenamiento: solo /uge-ce/.
      ...TRAINING_SCRAPERS.map((bot) => ({
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
