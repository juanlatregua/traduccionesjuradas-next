"use client";

// Switcher de idioma ES↔FR. En páginas ES enlaza a la versión francesa
// (/traduction-assermentee); en páginas FR vuelve al home ES. Muestra el idioma
// AL QUE se cambia (FR en ES, ES en FR), como un selector estándar.

import Link from "next/link";
import { Globe } from "lucide-react";
import { useUiLang } from "@/lib/i18n/use-ui-lang";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const lang = useUiLang();
  const toFrench = lang === "es";
  const href = toFrench ? "/traduction-assermentee" : "/";
  const label = toFrench ? "FR" : "ES";
  const aria = toFrench ? "Voir la version française" : "Ver la versión en español";

  return (
    <Link
      href={href}
      hrefLang={toFrench ? "fr" : "es"}
      aria-label={aria}
      title={aria}
      className={`inline-flex h-9 items-center gap-1.5 rounded-xl border border-or px-2.5 text-[12px] font-bold text-bleu shadow-sm transition-colors hover:bg-or-light/60 ${className}`}
    >
      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </Link>
  );
}
