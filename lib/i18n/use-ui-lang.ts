"use client";

// Detección de idioma del marco (header/footer/lupa) por ruta. Las rutas FR
// usan el marco francés; el resto, el español. Extensible añadiendo prefijos.

import { usePathname } from "next/navigation";

export type UiLang = "es" | "fr";

export const FRENCH_PREFIXES = ["/traduction-assermentee", "/fr"];

export function isFrenchPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return FRENCH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function useUiLang(): UiLang {
  return isFrenchPath(usePathname()) ? "fr" : "es";
}
