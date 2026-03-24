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
      {
        source: "/:path*",
        has: [{ type: "host", value: "traduccionesjuradas.net" }],
        destination: "https://www.traduccionesjuradas.net/:path*",
        permanent: true,
      },
      {
        source: "/:legacy((?!api/|_next/|traductor-jurado-frances(?:/)?$).*(?:frances).*)",
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
      {
        source: "/feed",
        destination: "/",
        permanent: true,
      },
      {
        source: "/feed/",
        destination: "/",
        permanent: true,
      },
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

      // Endpoints WP legacy -> 410 gestionado por middleware
      {
        source: "/wp-content/uploads/2019/07/ORDEN-AEX-1971-2002.pdf",
        destination: "/documentos-oficiales",
        permanent: true,
      },

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
