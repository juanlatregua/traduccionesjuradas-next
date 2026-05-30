// lib/i18n/nav.ts — Navegación del header en un solo sitio, bilingüe (es|fr).
// Un único Header la consume para ES y FR: añadir un idioma = añadir su columna
// aquí, no reimplementar un componente. Resuelve la divergencia ES/HeaderFr.
//
// Nota: muchas páginas de destino solo existen en ES por ahora; los hrefs
// apuntan a ellas hasta que haya equivalente FR. La ESTRUCTURA (desplegables,
// idiomas, documentos) sí queda igual de rica en ambos idiomas.

export type NavLang = "es" | "fr";

type Bi = { es: string; fr: string };

export type NavItem = { label: Bi; href: string };
export type NavDropdown = {
  label: Bi;
  align?: "left" | "right";
  groups: { heading: Bi; items: NavItem[]; cols?: 1 | 2 }[];
  foot?: { text: Bi; linkLabel: Bi; href: string };
};

export function t(b: Bi, lang: NavLang): string {
  return b[lang];
}

// ── Desplegable de idiomas (Traductor jurado / Traducteur assermenté) ──
const LANG_LINK = (slug: string, es: string, fr: string): NavItem => ({
  label: { es: `Traductor jurado de ${es}`, fr: `Traducteur assermenté de ${fr}` },
  href: `/traductor-jurado-${slug}`,
});
const LANG_SHORT = (slug: string, es: string, fr: string): NavItem => ({
  label: { es, fr },
  href: `/traductor-jurado-${slug}`,
});

export const TRANSLATOR_DROPDOWN: NavDropdown = {
  label: { es: "Traductor jurado", fr: "Traducteur assermenté" },
  align: "right",
  groups: [
    {
      heading: { es: "Idiomas principales", fr: "Langues principales" },
      cols: 1,
      items: [
        LANG_LINK("frances", "francés", "français"),
        LANG_LINK("aleman", "alemán", "allemand"),
        LANG_LINK("ingles", "inglés", "anglais"),
      ],
    },
    {
      heading: { es: "Otros idiomas", fr: "Autres langues" },
      cols: 2,
      items: [
        LANG_SHORT("neerlandes", "Neerlandés", "Néerlandais"),
        LANG_SHORT("italiano", "Italiano", "Italien"),
        LANG_SHORT("portugues", "Portugués", "Portugais"),
        LANG_SHORT("rumano", "Rumano", "Roumain"),
        LANG_SHORT("catalan", "Catalán", "Catalan"),
        LANG_SHORT("sueco", "Sueco", "Suédois"),
        LANG_SHORT("noruego", "Noruego", "Norvégien"),
      ],
    },
  ],
  foot: {
    text: { es: "Ver todos los idiomas", fr: "Voir toutes les langues" },
    linkLabel: { es: "Traductores jurados", fr: "Traducteurs assermentés" },
    href: "/traductores-jurados",
  },
};

export const DOCS_DROPDOWN: NavDropdown = {
  label: { es: "Documentos oficiales", fr: "Documents officiels" },
  align: "left",
  groups: [
    {
      heading: { es: "Más consultados", fr: "Les plus demandés" },
      cols: 1,
      items: [
        { label: { es: "Certificados del Registro Civil", fr: "Actes d'état civil" }, href: "/documentos-oficiales/certificados-registro-civil" },
        { label: { es: "Antecedentes penales", fr: "Casier judiciaire" }, href: "/documentos-oficiales/antecedentes-penales" },
        { label: { es: "Documentos para teletrabajar en España", fr: "Documents pour télétravailler en Espagne" }, href: "/teletrabajo" },
        { label: { es: "Documentos mercantiles y empresariales", fr: "Documents commerciaux et d'entreprise" }, href: "/documentos-oficiales/documentos-mercantiles" },
      ],
    },
  ],
  foot: {
    text: { es: "Ver listado completo en", fr: "Voir la liste complète dans" },
    linkLabel: { es: "Documentos oficiales", fr: "Documents officiels" },
    href: "/documentos-oficiales",
  },
};

// ── Enlaces simples del nav ──
export const NAV_PROCESO: NavItem = { label: { es: "Cómo funciona", fr: "Comment ça marche" }, href: "/proceso" };
export const NAV_PRECIOS: NavItem = { label: { es: "Precios", fr: "Tarifs" }, href: "/precios-traduccion-jurada" };
export const NAV_FAQ: NavItem = { label: { es: "Preguntas frecuentes", fr: "FAQ" }, href: "/preguntas-frecuentes" };
export const NAV_BLOG: NavItem = { label: { es: "Blog", fr: "Blog" }, href: "/blog" };
export const NAV_AREA: NavItem = { label: { es: "Área cliente", fr: "Espace client" }, href: "/area-cliente" };
export const NAV_ZONA: NavItem = { label: { es: "Zona traductor", fr: "Espace traducteur" }, href: "/zona-traductor" };
export const NAV_EXPEDIENTE: NavItem = { label: { es: "Subir expediente", fr: "Déposer un dossier" }, href: "/expediente" };

// CTA principal: la puerta. En FR, su puerta canónica es /traduction-assermentee.
export const NAV_CTA = {
  label: { es: "Presupuesto instantáneo", fr: "Devis instantané" },
  href: { es: "/presupuesto-instantaneo", fr: "/traduction-assermentee" } as Record<NavLang, string>,
};
