import type { MetadataRoute } from "next";

// PWA — la web instalable en la pantalla de inicio. Acceso rápido de un toque,
// a pantalla completa. El shortcut lleva directo a la zona de traductor.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TraduccionesJuradas.net",
    short_name: "TJ Juradas",
    description:
      "Traducción jurada oficial online. Precio cerrado al instante, traductores jurados acreditados.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7ed",
    theme_color: "#B8922A",
    lang: "es",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Zona traductor",
        short_name: "Traductor",
        description: "Bandeja y workspace de pedidos",
        url: "/zona-traductor",
      },
      {
        name: "Presupuesto instantáneo",
        short_name: "Presupuesto",
        description: "Subir documentos y cerrar precio",
        url: "/presupuesto-instantaneo",
      },
    ],
  };
}
