/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async redirects() {
    return [
      // Certificado de nacimiento (URL antigua → URL correcta)
      {
        source: "/traduccion-jurada-certificado-de-nacimiento",
        destination: "/documentos-oficiales/certificado-de-nacimiento",
        permanent: true,
      },
      {
        source: "/traduccion-jurada-certificado-de-nacimiento/",
        destination: "/documentos-oficiales/certificado-de-nacimiento",
        permanent: true,
      },

      // Título universitario (URL antigua → categoría académicos)
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
    ];
  },
};

export default nextConfig;
