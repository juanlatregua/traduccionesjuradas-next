// lib/i18n/nav.ts — Navegación del header en un solo sitio, en los 5 idiomas
// (es·fr·en·de·pt). Un único Header la consume: añadir un idioma = añadir su
// valor en cada Tr, no reimplementar un componente.
//
// Nota: muchas páginas de destino solo existen en ES por ahora; los hrefs
// apuntan a ellas hasta que haya equivalente por idioma. La ESTRUCTURA
// (desplegables, idiomas, documentos) queda igual de rica en todos los idiomas.

import type { Locale, Tr } from "@/lib/i18n/locales";
import { LOCALE_HOME } from "@/lib/i18n/locales";

export type NavLang = Locale;

export type NavItem = { label: Tr; href: string };
export type NavDropdown = {
  label: Tr;
  align?: "left" | "right";
  groups: { heading: Tr; items: NavItem[]; cols?: 1 | 2 }[];
  foot?: { text: Tr; linkLabel: Tr; href: string };
};

const tr = (es: string, fr: string, en: string, de: string, pt: string): Tr => ({ es, fr, en, de, pt });

export function t(b: Tr, lang: NavLang): string {
  return b[lang];
}

// ── Desplegable de idiomas (Traductor jurado / Sworn translator / …) ──
// Nombre del idioma en cada UI; la etiqueta se compone con el patrón de cada UI.
type LangName = { es: string; fr: string; en: string; de: string; pt: string };

const fullLabel = (n: LangName): Tr =>
  tr(
    `Traductor jurado de ${n.es}`,
    `Traducteur assermenté de ${n.fr}`,
    `Sworn translator for ${n.en}`,
    `Vereidigter Übersetzer für ${n.de}`,
    `Tradutor ajuramentado de ${n.pt}`
  );

const LANG_LINK = (slug: string, n: LangName): NavItem => ({ label: fullLabel(n), href: `/traductor-jurado-${slug}` });
const LANG_SHORT = (slug: string, n: LangName): NavItem => ({ label: tr(n.es, n.fr, n.en, n.de, n.pt), href: `/traductor-jurado-${slug}` });

export const TRANSLATOR_DROPDOWN: NavDropdown = {
  label: tr("Traductor jurado", "Traducteur assermenté", "Sworn translator", "Vereidigter Übersetzer", "Tradutor ajuramentado"),
  align: "right",
  groups: [
    {
      heading: tr("Idiomas principales", "Langues principales", "Main languages", "Hauptsprachen", "Idiomas principais"),
      cols: 1,
      items: [
        LANG_LINK("frances", { es: "francés", fr: "français", en: "French", de: "Französisch", pt: "francês" }),
        LANG_LINK("aleman", { es: "alemán", fr: "allemand", en: "German", de: "Deutsch", pt: "alemão" }),
        LANG_LINK("ingles", { es: "inglés", fr: "anglais", en: "English", de: "Englisch", pt: "inglês" }),
      ],
    },
    {
      heading: tr("Otros idiomas", "Autres langues", "Other languages", "Weitere Sprachen", "Outros idiomas"),
      cols: 2,
      items: [
        LANG_SHORT("neerlandes", { es: "Neerlandés", fr: "Néerlandais", en: "Dutch", de: "Niederländisch", pt: "Neerlandês" }),
        LANG_SHORT("italiano", { es: "Italiano", fr: "Italien", en: "Italian", de: "Italienisch", pt: "Italiano" }),
        LANG_SHORT("portugues", { es: "Portugués", fr: "Portugais", en: "Portuguese", de: "Portugiesisch", pt: "Português" }),
        LANG_SHORT("rumano", { es: "Rumano", fr: "Roumain", en: "Romanian", de: "Rumänisch", pt: "Romeno" }),
        LANG_SHORT("catalan", { es: "Catalán", fr: "Catalan", en: "Catalan", de: "Katalanisch", pt: "Catalão" }),
        LANG_SHORT("sueco", { es: "Sueco", fr: "Suédois", en: "Swedish", de: "Schwedisch", pt: "Sueco" }),
        LANG_SHORT("noruego", { es: "Noruego", fr: "Norvégien", en: "Norwegian", de: "Norwegisch", pt: "Norueguês" }),
      ],
    },
  ],
  foot: {
    text: tr("Ver todos los idiomas", "Voir toutes les langues", "See all languages", "Alle Sprachen ansehen", "Ver todos os idiomas"),
    linkLabel: tr("Traductores jurados", "Traducteurs assermentés", "Sworn translators", "Vereidigte Übersetzer", "Tradutores ajuramentados"),
    href: "/traductores-jurados",
  },
};

export const DOCS_DROPDOWN: NavDropdown = {
  label: tr("Documentos oficiales", "Documents officiels", "Official documents", "Amtliche Dokumente", "Documentos oficiais"),
  align: "left",
  groups: [
    {
      heading: tr("Más consultados", "Les plus demandés", "Most requested", "Am häufigsten gefragt", "Mais consultados"),
      cols: 1,
      items: [
        { label: tr("Certificados del Registro Civil", "Actes d'état civil", "Civil registry certificates", "Personenstandsurkunden", "Certidões do Registo Civil"), href: "/documentos-oficiales/certificados-registro-civil" },
        { label: tr("Antecedentes penales", "Casier judiciaire", "Criminal record certificate", "Führungszeugnis", "Certidão de antecedentes criminais"), href: "/documentos-oficiales/antecedentes-penales" },
        { label: tr("Documentos para teletrabajar en España", "Documents pour télétravailler en Espagne", "Documents to work remotely in Spain", "Dokumente für Remote-Arbeit in Spanien", "Documentos para teletrabalhar em Espanha"), href: "/teletrabajo" },
        { label: tr("Documentos mercantiles y empresariales", "Documents commerciaux et d'entreprise", "Commercial and corporate documents", "Handels- und Unternehmensdokumente", "Documentos comerciais e empresariais"), href: "/documentos-oficiales/documentos-mercantiles" },
      ],
    },
  ],
  foot: {
    text: tr("Ver listado completo en", "Voir la liste complète dans", "See the full list in", "Vollständige Liste unter", "Ver a lista completa em"),
    linkLabel: tr("Documentos oficiales", "Documents officiels", "Official documents", "Amtliche Dokumente", "Documentos oficiais"),
    href: "/documentos-oficiales",
  },
};

// ── Enlaces simples del nav ──
export const NAV_PROCESO: NavItem = { label: tr("Cómo funciona", "Comment ça marche", "How it works", "So funktioniert's", "Como funciona"), href: "/proceso" };
export const NAV_PRECIOS: NavItem = { label: tr("Precios", "Tarifs", "Pricing", "Preise", "Preços"), href: "/precios-traduccion-jurada" };
export const NAV_FAQ: NavItem = { label: tr("Preguntas frecuentes", "FAQ", "FAQ", "FAQ", "Perguntas frequentes"), href: "/preguntas-frecuentes" };
export const NAV_BLOG: NavItem = { label: tr("Blog", "Blog", "Blog", "Blog", "Blog"), href: "/blog" };
export const NAV_AREA: NavItem = { label: tr("Área cliente", "Espace client", "Client area", "Kundenbereich", "Área de cliente"), href: "/area-cliente" };
export const NAV_ZONA: NavItem = { label: tr("Zona traductor", "Espace traducteur", "Translator area", "Übersetzerbereich", "Área do tradutor"), href: "/zona-traductor" };
export const NAV_EXPEDIENTE: NavItem = { label: tr("Subir expediente", "Plusieurs documents", "Multiple documents", "Mehrere Dokumente", "Vários documentos"), href: "/expediente" };

// CTA principal: la puerta. En ES es la página dedicada; en el resto, el ancla
// del héroe en el home propio del idioma (donde vive la puerta).
export const NAV_CTA = {
  label: tr("Presupuesto instantáneo", "Devis instantané", "Instant quote", "Sofortangebot", "Orçamento instantâneo"),
  href: {
    es: "/presupuesto-instantaneo",
    fr: `${LOCALE_HOME.fr}#hero-fr`,
    en: `${LOCALE_HOME.en}#hero`,
    de: `${LOCALE_HOME.de}#hero`,
    pt: `${LOCALE_HOME.pt}#hero`,
  } as Record<NavLang, string>,
};

// ── Rótulos de UI del header (aria/botones) — evita ternarios es/fr sueltos ──
export const NAV_UI = {
  brandAria: tr("Traducciones Juradas — inicio", "Traductions assermentées — accueil", "Traducciones Juradas — home", "Traducciones Juradas — Startseite", "Traducciones Juradas — início"),
  navAria: tr("Navegación principal", "Navigation principale", "Main navigation", "Hauptnavigation", "Navegação principal"),
  openMenu: tr("Abrir menú", "Ouvrir le menu", "Open menu", "Menü öffnen", "Abrir menu"),
  closeMenu: tr("Cerrar menú", "Fermer le menu", "Close menu", "Menü schließen", "Fechar menu"),
  menu: tr("Menú", "Menu", "Menu", "Menü", "Menu"),
  close: tr("Cerrar", "Fermer", "Close", "Schließen", "Fechar"),
};
