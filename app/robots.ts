import type { MetadataRoute } from "next";

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
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
