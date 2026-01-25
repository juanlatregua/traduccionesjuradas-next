/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async redirects() {
    return [
      // ===============================
      // DOCUMENTOS (WordPress → Next)
      // ===============================

      {
        source: "/traduccion-jurada-de-certificado-empadronamiento/",
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
        source: "/traduccion-jurada-certificado-matrimonio/",
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
