"use client";

// Detección del idioma del marco (header/footer/lupa/puerta) por ruta.
// La fuente de verdad (prefijos → idioma) vive en locales.ts; aquí solo se
// resuelve el pathname actual. Añadir un idioma = añadirlo en locales.ts.

import { usePathname } from "next/navigation";
import { localeFromPath, type Locale } from "@/lib/i18n/locales";

export type UiLang = Locale;

export function useUiLang(): UiLang {
  return localeFromPath(usePathname());
}

// Compat: algunos sitios aún preguntan "¿es francés?". Se mantiene apoyado en
// la fuente única para no duplicar la lista de prefijos.
export function isFrenchPath(pathname: string | null | undefined): boolean {
  return localeFromPath(pathname) === "fr";
}
