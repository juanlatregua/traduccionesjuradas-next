/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async redirects() {
    return [
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
        source: "/categoria-producto/notarial/feed/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/civil/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/feed/",
        destination: "/",
        permanent: true,
      },
      {
        source: "/feed",
        destination: "/",
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
        source: "/contacto/page/2/",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/contacto/page/4/",
        destination: "/contacto",
        permanent: true,
      },
      {
        source: "/wp-content/uploads/2019/07/ORDEN-AEX-1971-2002.pdf",
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
        source: "/traducciones-juradas-baratas",
        destination: "/traducciones-juradas-baratas",
        permanent: true,
      },
      {
        source: "/traducciones-juradas-baratas/",
        destination: "/traducciones-juradas-baratas",
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
      {
        source: "/traduccion-jurada-de-poder-notarial",
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
        source: "/categoria-producto/hacienda/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/notarial/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/categoria-producto/notarial/feed/",
        destination: "/documentos-oficiales",
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
        source: "/feed/",
        destination: "/",
        permanent: true,
      },
      {
        source: "/feed",
        destination: "/",
        permanent: true,
      },
      {
        source: "/agencia/",
        destination: "/",
        permanent: true,
      },
      {
        source: "/envios/",
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

      // Endpoints WP legacy (poner 410/redirect al inicio)
      {
        source: "/wp-content/plugins/burst-statistics/endpoint.php",
        destination: "/",
        permanent: true,
      },
      {
        source: "/wp-json/",
        destination: "/",
        permanent: true,
      },
      {
        source: "/wp-admin/admin-ajax.php",
        destination: "/",
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
        source: "/traductor-jurado-calpe/",
        destination: "/documentos-oficiales",
        permanent: true,
      },
      {
        source: "/traductor-jurado-teruel/",
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

      // ===============================
      // LEGAL
      // ===============================

      {
        source: "/politica-de-privacidad/",
        destination: "/privacidad",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
