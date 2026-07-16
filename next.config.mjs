const isDev = process.argv.indexOf('dev') !== -1
const isBuild = process.argv.indexOf('build') !== -1

if (!process.env.VELITE_STARTED && (isDev || isBuild)) {
  process.env.VELITE_STARTED = '1'
  const { build } = await import('velite')
  await build({ watch: isDev, clean: !isDev })
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    const noindexHeader = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow",
    };

    return [
      {
        source: "/area-cliente/:path*",
        headers: [noindexHeader],
      },
      {
        source: "/zona-traductor/:path*",
        headers: [noindexHeader],
      },
      {
        source: "/admin/:path*",
        headers: [noindexHeader],
      },
      {
        source: "/acceso",
        headers: [noindexHeader],
      },
      {
        source: "/q/:path*",
        headers: [noindexHeader],
      },
      {
        source: "/pedido/:path*",
        headers: [noindexHeader],
      },
      {
        // El service worker no debe quedarse pegado en caché: que cada visita
        // revalide para que una versión nueva se active sin esperas.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  async rewrites() {
    // Bloque /uge-ce/* delegado a un proyecto Vercel independiente
    // (repo: juanlatregua/traduccionesjuradas-uge, basePath /uge-ce).
    // El proxy se hace server-side: el usuario nunca ve la URL de Vercel.
    return [
      {
        source: "/uge-ce",
        destination: "https://traduccionesjuradas-uge.vercel.app/uge-ce",
      },
      {
        source: "/uge-ce/:path*",
        destination: "https://traduccionesjuradas-uge.vercel.app/uge-ce/:path*",
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          { type: "host", value: "www.traduccionesjuradas.net" },
          { type: "header", key: "x-forwarded-proto", value: "http" },
        ],
        destination: "https://www.traduccionesjuradas.net/:path*",
        permanent: true,
      },
      // ?modo=control era el atajo a la vista de control: ahora es la vista
      // Tabla de Pedidos (misma pantalla). OJO: Next conserva los query params
      // del origen en el destino, así que redirigir a /zona-traductor volvería a
      // traer ?modo=control y la regla reentraría en bucle. El salto pasa por
      // /control (que no tiene regla `has`) y allí el page component descarta
      // `modo` y reenvía a la vista Tabla. Un salto de más, cero bucles.
      {
        source: "/zona-traductor",
        has: [{ type: "query", key: "modo", value: "control" }],
        destination: "/zona-traductor/control",
        permanent: false,
      },
      // Consolidación: la Landing del pedido es la ÚNICA pantalla de detalle.
      // Workspace y Cockpit se retiran redirigiendo a ella (307 revertible). Cubre
      // los enlaces ya enviados en SMS/email a /workspace.
      {
        source: "/zona-traductor/workspace/:reference",
        destination: "/zona-traductor/pedido/:reference",
        permanent: false,
      },
      {
        source: "/zona-traductor/proyecto/:reference",
        destination: "/zona-traductor/pedido/:reference",
        permanent: false,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "traduccionesjuradas.net" }],
        destination: "https://www.traduccionesjuradas.net/:path*",
        permanent: true,
      },
      {
        source: "/:legacy((?!api/|_next/|blog/|traductor-jurado-frances(?:/)?$|traduccion-jurada-frances-malaga(?:/)?$).*(?:frances).*)",
        destination: "/traductor-jurado-frances",
        permanent: true,
      },
      // Trailing-slash redirect removed — skipTrailingSlashRedirect disabled,
      // Next.js now handles /page/ → /page automatically
      // Removed city pages → home
      { source: '/traductor-jurado/tenerife', destination: '/', permanent: true },
      { source: '/traductor-jurado/zaragoza', destination: '/', permanent: true },
      { source: '/traductor-jurado/figueres', destination: '/', permanent: true },
      { source: '/traductor-jurado/cartagena', destination: '/', permanent: true },
      { source: '/traductor-jurado/albacete', destination: '/', permanent: true },
      { source: '/traductor-jurado/pamplona', destination: '/', permanent: true },
      { source: '/traductor-jurado/denia', destination: '/', permanent: true },
      { source: '/traductor-jurado/altea', destination: '/', permanent: true },
      { source: '/traductor-jurado/gran-canaria', destination: '/', permanent: true },
      { source: '/traductor-jurado/puerto-de-la-cruz', destination: '/', permanent: true },
      { source: '/traductor-jurado/guadalajara', destination: '/', permanent: true },
      { source: '/traductor-jurado/palencia', destination: '/', permanent: true },
      { source: '/traductor-jurado/mataro', destination: '/', permanent: true },
      { source: '/traductor-jurado/santiago-de-compostela', destination: '/', permanent: true },
      { source: '/traductor-jurado/las-rozas', destination: '/', permanent: true },
      { source: '/traductor-jurado/getafe', destination: '/', permanent: true },
      { source: '/traductor-jurado/menorca', destination: '/', permanent: true },
      { source: '/traductor-jurado/calahorra', destination: '/', permanent: true },
      { source: '/traductor-jurado-japones', destination: '/', permanent: true },
      { source: '/traductor-jurado-japones/', destination: '/', permanent: true },
      // v2 Fase 1 (Bloque 1.4): el funnel viejo colapsa en la puerta.
      { source: '/start', destination: '/presupuesto-instantaneo', permanent: true },
      { source: '/upload', destination: '/presupuesto-instantaneo', permanent: true },
      { source: '/review', destination: '/presupuesto-instantaneo', permanent: true },
      { source: '/puerta', destination: '/presupuesto-instantaneo', permanent: true },
      {
        source: "/contacto/page/:page(\\d+)",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/inicio/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/agencia/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/categoria-producto/:path*",
        destination: "/",
        permanent: true,
      },
      // Legacy catch-all redirects removed — handled by middleware.ts
      // with proper allowlist (LANGUAGE_PILLARS) to avoid blocking
      // valid language pages like /traductor-jurado-ingles, etc.
      // ===============================
      // VESTIGIOS WP / CRAWL NOISE
      // ===============================
      {
        source: "/palabra",
        destination: "/",
        permanent: true,
      },
      {
        source: "/mapa-del-sitio",
        destination: "/sitemap.xml",
        permanent: true,
      },
      // /feed y /feed/ → 410 (RSS de WordPress muerto): se gestiona en
      // middleware.ts (isFeed → gone()). No redirigir a "/" (era ruido de equity).
      {
        source: "/wp-admin/admin-ajax.php",
        destination: "/",
        permanent: true,
      },
      // ===============================
      // VESTIGIOS INTERNOS
      // ===============================
      {
        source: "/documentos",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/documentos/:path*",
        destination: "/documentos-oficiales/:path*",
        permanent: true,
      },

      // ===============================
      // DOCUMENTOS (WordPress → Next)
      // ===============================
            {
        source: "/politica-de-envios",
        destination: "/proceso",
        permanent: true,
      },
      {
        source: "/traducciones-",
        destination: "/",
        permanent: true,
      },
      {
        source: "/shop/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/shop",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/civil/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/civil",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/ciudades-desde-donde-puedes-comprar-una-traduccion-jurada/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/documentos/traduccion-jurada-del-libro-de-familia/",
        destination: "/documentos-oficiales/certificados-registro-civil",
        permanent: true,
      },
      {
        source: "/category/idiomas/page/4/",
        destination: "/traductores-jurados",
        permanent: true,
      },
      {
        source: "/category/idiomas/page/4",
        destination: "/traductores-jurados",
        permanent: true,
      },
      {
        source: "/contacto/page/2/",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/contacto/page/2",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/contacto/page/4/",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/contacto/page/4",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/wp-content/uploads/2019/07/ORDEN-AEX-1971-2002.pdf",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/wp-content/uploads/2019/07/ORDEN-AEX-1971-2002.pdf/",
        destination: "/documentos-oficiales",
        permanent: true,
      },

      {
        source: "/traduccion-jurada-de-certificado-empadronamiento/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-certificado-empadronamiento",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-certificado-840/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-certificado-840",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-poder-notarial/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-registro-mercantil",
        destination: "/documentos-oficiales/documentos-mercantiles",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-registro-mercantil/",
        destination: "/documentos-oficiales/documentos-mercantiles",
        permanent: true,
      },
      // Sunset WP fase 2 — escritura-notarial (0 impr, unknown to Google, 0
      // referring) fusionada en documentos-juridicos (que ya cubre escrituras,
      // poderes, testamentos, capitulaciones). El slug se mantiene en
      // VALID_LEGACY_PATHS hasta verificar el 301 (trampa de orden del plan).
      {
        source: "/traduccion-jurada-de-escritura-notarial",
        destination: "/documentos-oficiales/documentos-juridicos",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-escritura-notarial/",
        destination: "/documentos-oficiales/documentos-juridicos",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-certificado-matrimonio/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-certificado-matrimonio",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/documentos/traduccion-jurada-de-certificado-de-seguridad-social/",
        destination: "/documentos-oficiales/documentos-laborales",
        permanent: true,
      },
      {
        source: "/documentos/traduccion-jurada-de-certificado-de-seguridad-social",
        destination: "/documentos-oficiales/documentos-laborales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-expediente-academico",
        destination: "/documentos-oficiales/documentos-academicos",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-expediente-academico/",
        destination: "/documentos-oficiales/documentos-academicos",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-del-libro-de-familia",
        destination: "/documentos-oficiales/certificados-registro-civil",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-del-libro-de-familia/",
        destination: "/documentos-oficiales/certificados-registro-civil",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-titulo-universitario",
        destination: "/documentos-oficiales/documentos-academicos",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-titulo-universitario/",
        destination: "/documentos-oficiales/documentos-academicos",
        permanent: true,
      },
      {
        source: "/traduccion-",
        destination: "/",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-certificado-pareja-de-hecho",
        destination: "/documentos-oficiales/certificados-registro-civil",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-certificado-pareja-de-hecho/",
        destination: "/documentos-oficiales/certificados-registro-civil",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-urgente",
        destination: "/presupuesto-instantaneo",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-urgente/",
        destination: "/presupuesto-instantaneo",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-licencia-de-conducir",
        destination: "/documentos-oficiales/documentos-laborales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-licencia-de-conducir/",
        destination: "/documentos-oficiales/documentos-laborales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-poder-notarial",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traducciones-",
        destination: "/",
        permanent: true,
      },
      {
        source: "/shop/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/shop",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      // ===============================
      // CATEGORÍAS WOOCOMMERCE
      // ===============================

      {
        source: "/categoria-producto/judicial/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/judicial",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/hacienda/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/hacienda",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/notarial/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/notarial",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/notarial/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/mercantil/",
        destination: "/documentos-oficiales/documentos-mercantiles",
        permanent: true,
      },
      {
        source: "/categoria-producto/mercantil",
        destination: "/documentos-oficiales/documentos-mercantiles",
        permanent: true,
      },
      {
        source: "/categoria-producto/civil/",
        destination: "/documentos-oficiales",
        permanent: true,
      },

      // ===============================
      // IDIOMAS ANTIGUOS (no son páginas de ciudad)
      // ===============================
      {
        source: "/traductor-jurado-griego",
        destination: "/traductores-jurados",
        permanent: true,
      },
      {
        source: "/traductor-jurado-griego/",
        destination: "/traductores-jurados",
        permanent: true,
      },
      {
        source: "/traductor-jurado-en-persa",
        destination: "/traductores-jurados",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-certificado-de-nacimiento",
        destination: "/documentos-oficiales/certificado-de-nacimiento",
        permanent: true,
      },
      // Ciudades antiguas: /traductor-jurado-{ciudad} → gestionadas por middleware
      // (redirige a /traductor-jurado/{ciudad} si existe, o a / si no)

      // ===============================
      // OTRAS PÁGINAS ANTIGUAS
      // ===============================
      {
        source: "/inicio/",
        destination: "/",
        permanent: true,
      },
      {
        source: "/inicio",
        destination: "/",
        permanent: true,
      },
      {
        source: "/author/traducciones-juradas/",
        destination: "/",
        permanent: true,
      },
      {
        source: "/agencia/",
        destination: "/",
        permanent: true,
      },
      {
        source: "/agencia",
        destination: "/",
        permanent: true,
      },
      {
        source: "/envios/",
        destination: "/proceso",
        permanent: true,
      },
      {
        source: "/envios",
        destination: "/proceso",
        permanent: true,
      },
      {
        source: "/ciudades-desde-donde-puedes-comprar-una-traduccion-jurada/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/precio-de-traduccion-jurada/",
        destination: "/precios-traduccion-jurada",
        permanent: true,
      },
      {
        source: "/precio-de-traduccion-jurada",
        destination: "/precios-traduccion-jurada",
        permanent: true,
      },
      {
        source: "/trabaja-con-nosotros/",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/trabaja-con-nosotros",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/aviso-legal-privacidad",
        destination: "/aviso-legal",
        permanent: true,
      },
      {
        source: "/documentos/traduccion-jurada-del-libro-de-familia/",
        destination: "/documentos-oficiales/certificados-registro-civil",
        permanent: true,
      },
      {
        source: "/category/idiomas/page/4/",
        destination: "/traductores-jurados",
        permanent: true,
      },
      {
        source: "/contacto/page/2/",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/contacto/page/4/",
        destination: "/contacto",
        permanent: true,
      },

      // (ORDEN-AEX-1971-2002.pdf ya tiene su 301 → /documentos-oficiales más
      // arriba, con y sin barra; duplicado redundante eliminado)

      // ===============================
      // PRESUPUESTO
      // ===============================

      {
        source: "/presupuesto",
        destination: "/presupuesto-instantaneo",
        permanent: true,
      },
      {
        source: "/solicitar-presupuesto/",
        destination: "/presupuesto-instantaneo",
        permanent: true,
      },
      {
        source: "/solicitar-presupuesto",
        destination: "/presupuesto-instantaneo",
        permanent: true,
      },

      // ===============================
      // LEGAL
      // ===============================

      {
        source: "/politica-de-privacidad/",
        destination: "/privacidad",
        permanent: true,
      },
      {
        source: "/politica-de-privacidad",
        destination: "/privacidad",
        permanent: true,
      },
      {
        source: "/carrito",
        destination: "/presupuesto-instantaneo",
        permanent: true,
      },
      {
        source: "/carrito/",
        destination: "/presupuesto-instantaneo",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
