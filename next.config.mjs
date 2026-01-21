/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async redirects() {
    // Helper: crea 2 redirects (con y sin / final)
    const both = (source, destination) => [
      { source, destination, permanent: true },
      { source: `${source}/`, destination, permanent: true },
    ];

    return [
      // =========================
      // 1) REDIRECCIONES IMPORTANTES (WP → Next)
      // =========================

      // Certificado de nacimiento
      ...both(
        "/traduccion-jurada-certificado-de-nacimiento",
        "/documentos-oficiales/certificado-de-nacimiento"
      ),

      // Título universitario → documentos académicos
      ...both(
        "/traduccion-jurada-titulo-universitario",
        "/documentos-oficiales/documentos-academicos"
      ),

      // Presupuesto (URL antigua WP)
      ...both("/solicitar-presupuesto", "/presupuesto"),

      // Empadronamiento
      ...both(
        "/traduccion-jurada-de-certificado-empadronamiento",
        "/documentos-oficiales/certificado-de-empadronamiento"
      ),

      // Poder notarial
      ...both(
        "/traduccion-jurada-de-poder-notarial",
        "/documentos-oficiales/poder-notarial"
      ),

      // Certificado de matrimonio
      ...both(
        "/traduccion-jurada-certificado-matrimonio",
        "/documentos-oficiales/certificado-de-matrimonio"
      ),

      // Certificado 840
      ...both(
        "/traduccion-jurada-de-certificado-840",
        "/documentos-oficiales/certificado-840"
      ),

      // =========================
      // 2) OPCIONAL: LANDINGS DE CIUDADES (si en WP había muchas)
      // OJO: esto redirige TODAS /traductor-jurado-xxxxx a una sola página
      // =========================
      {
        source: "/traductor-jurado-:slug*",
        destination: "/traductor-jurado",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
