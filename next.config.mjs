/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,

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
      {
        source: "/traductor-jurado-:slug((?!.*frances).*)",
        destination: "/",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-:slug((?!.*frances).*)",
        destination: "/",
        permanent: true,
      },
      {
        source: "/traductor-:slug((?!.*frances).*)",
        destination: "/",
        permanent: true,
      },
      {
        source: "/traducciones-:slug((?!.*frances).*)",
        destination: "/",
        permanent: true,
      },
      {
        source: "/",
        has: [{ type: "query", key: "action", value: "rest-nonce" }],
        destination: "/",
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
        source: "/traduccion-jurada-antecedentes-penales",
        destination: "/documentos-oficiales/antecedentes-penales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-antecedentes-penales/",
        destination: "/documentos-oficiales/antecedentes-penales",
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
        source: "/traduccion-jurada-de-escritura-notarial",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-escritura-notarial/",
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
        source: "/traduccion-jurada-de-estatutos-sociales",
        destination: "/documentos-oficiales/documentos-mercantiles",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-estatutos-sociales/",
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
        source: "/traduccion-jurada-permiso-de-conducir",
        destination: "/documentos-oficiales/documentos-laborales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-permiso-de-conducir/",
        destination: "/documentos-oficiales/documentos-laborales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-certificado-de-seguridad-social",
        destination: "/documentos-oficiales/documentos-laborales",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-de-certificado-de-seguridad-social/",
        destination: "/documentos-oficiales/documentos-laborales",
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
        destination: "/presupuesto",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-urgente/",
        destination: "/presupuesto",
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
        source: "/traduccion-jurada-sentencia-judicial",
        destination: "/documentos-oficiales/documentos-juridicos",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-sentencia-judicial/",
        destination: "/documentos-oficiales/documentos-juridicos",
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
      // PÁGINAS ANTIGUAS DETECTADAS (403 EN WP)
      // ===============================
      {
        source: "/traductor-jurado-barcelona",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-pontevedra",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-pontevedra/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-fuerteventura",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-fuerteventura/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-denia",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-denia/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-badalona",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-badalona/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-cuenca",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-cuenca/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-jerez",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-jerez/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-torrelodones",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-torrelodones/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-alcorcon",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-alcorcon/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
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
        source: "/traductor-jurado-madrid",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-madrid/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-zaragoza",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-zaragoza/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-altea",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-altea/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-sevilla",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-sevilla/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-alcobendas",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-alcobendas/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-fuengirola",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-fuengirola/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-getafe",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-getafe/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-moralzarzal",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-moralzarzal/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-pamplona",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-pamplona/",
        destination: "/documentos-oficiales",
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
      {
        source: "/traductor-jurado-tenerife",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-gran-canaria",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-puerto-de-la-cruz",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-guadalajara",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-tenerife/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-gran-canaria/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-puerto-de-la-cruz/",
        destination: "/documentos-oficiales",
        permanent: true,
      },

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
      // CIUDADES ANTIGUAS
      // ===============================

      {
        source: "/traductor-jurado-palma-de-mallorca/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-palma-de-mallorca",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-calpe/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-calpe",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-teruel/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-teruel",
        destination: "/documentos-oficiales",
        permanent: true,
      },

      // ===============================
      // PRESUPUESTO
      // ===============================

      {
        source: "/solicitar-presupuesto/",
        destination: "/presupuesto",
        permanent: true,
      },
      {
        source: "/solicitar-presupuesto",
        destination: "/presupuesto",
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
        destination: "/presupuesto",
        permanent: true,
      },
      {
        source: "/carrito/",
        destination: "/presupuesto",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
