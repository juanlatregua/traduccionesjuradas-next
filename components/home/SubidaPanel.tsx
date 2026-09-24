"use client";

// components/home/SubidaPanel.tsx — «Suelta tus documentos» (maqueta 22-sep)
// con dos pestañas: un documento (la puerta de siempre: email + par de idiomas
// + consentimiento ANTES de subir, orden de Juan 4-sep) y expediente grande
// (components/ExpedientePublicIntake, el mismo de /expediente, con su propia
// puerta de nombre + email + consentimiento). Nada de lógica de subida aquí:
// solo se elige cuál de las dos se enseña.

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Upload, FolderOpen, Loader2 } from "lucide-react";
import PuertaClient from "@/app/presupuesto-instantaneo/PuertaClient";
import type { Locale } from "@/lib/i18n/locales";
import { HOME_HERO } from "@/lib/i18n/home-hero";
import { PUERTA_LANGS, WHATSAPP_HEAD, toPuertaLang } from "@/lib/i18n/whatsapp-arrival";

const ExpedientePublicIntake = dynamic(() => import("@/components/ExpedientePublicIntake"), {
  ssr: false,
  loading: () => (
    <p className="flex items-center gap-2 py-6 text-sm text-graphite">
      <Loader2 className="h-4 w-4 animate-spin text-bleu" aria-hidden="true" />
      …
    </p>
  ),
});

type Tab = "uno" | "expediente";

export function SubidaPanel({ source, lang }: { source: string | null; lang: Locale }) {
  const t = HOME_HERO.subida;
  const [tab, setTab] = useState<Tab>("uno");
  // Cambiar de pestaña NO desmonta la otra: el email, los idiomas, el precio o
  // la cola de subidas siguen ahí. El expediente se monta la primera vez que
  // se abre y ya no se desmonta.
  const [expOpened, setExpOpened] = useState(false);
  const base = useId();
  const pathname = usePathname() || "/";
  const fromWhatsApp = source === "whatsapp";

  const tabs: { key: Tab; label: string; hint: string; icon: typeof Upload }[] = [
    { key: "uno", label: t.tabOne[lang], hint: t.tabOneHint[lang], icon: Upload },
    { key: "expediente", label: t.tabMany[lang], hint: t.tabManyHint[lang], icon: FolderOpen },
  ];

  return (
    <section
      aria-labelledby="subida-title"
      lang={lang}
      className="flex flex-col gap-4 rounded-2xl border border-cream bg-white p-5 shadow-paper sm:p-7"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-or text-white" aria-hidden="true">
          <Upload className="h-5 w-5" />
        </span>
        <div>
          <h2 id="subida-title" className="font-baskerville text-xl font-bold text-encre sm:text-2xl">
            {fromWhatsApp ? WHATSAPP_HEAD[lang].title : t.title[lang]}
          </h2>
          <p className="text-sm text-graphite">{t.sub[lang]}</p>
        </div>
      </div>

      {fromWhatsApp && (
        <>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{WHATSAPP_HEAD[lang].banner}</p>
          <nav aria-label={t.langNavAria[lang]} className="flex flex-wrap gap-2">
            {PUERTA_LANGS.map((l) => (
              <Link
                key={l}
                href={`${pathname}?p=whatsapp&l=${l}`}
                aria-current={l === lang ? "true" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold uppercase ${
                  l === lang ? "border-bleu bg-bleu text-white" : "border-bleu/20 bg-parchment text-bleu hover:border-or"
                }`}
              >
                {l}
              </Link>
            ))}
          </nav>
        </>
      )}

      <div role="tablist" aria-label={t.tabsAria[lang]} className="grid grid-cols-2 gap-2">
        {tabs.map((tb) => {
          const active = tab === tb.key;
          const Icon = tb.icon;
          return (
            <button
              key={tb.key}
              type="button"
              role="tab"
              id={`${base}-tab-${tb.key}`}
              aria-selected={active}
              aria-controls={`${base}-panel-${tb.key}`}
              onClick={() => {
                setTab(tb.key);
                if (tb.key === "expediente") setExpOpened(true);
              }}
              className={`flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors sm:px-4 ${
                active ? "border-bleu bg-bleu/5 text-encre" : "border-graphite/20 bg-parchment text-graphite hover:border-bleu/40"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold leading-tight sm:text-[15px]">
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-bleu" : "text-graphite"}`} aria-hidden="true" />
                {tb.label}
              </span>
              <span className="text-xs leading-tight">{tb.hint}</span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`${base}-panel-uno`} aria-labelledby={`${base}-tab-uno`} hidden={tab !== "uno"}>
        <PuertaClient purpose={null} source={source} lang={lang} />
      </div>
      <div role="tabpanel" id={`${base}-panel-expediente`} aria-labelledby={`${base}-tab-expediente`} hidden={tab !== "expediente"}>
        {expOpened && (
          <div className="space-y-4">
            <p className="text-sm text-graphite">
              {t.manyIntroPre[lang]}
              <strong className="text-encre">{t.manyIntroStrong[lang]}</strong>
              {t.manyIntroPost[lang]}
            </p>
            <ExpedientePublicIntake lang={lang} source={source} />
          </div>
        )}
      </div>
    </section>
  );
}

// Las portadas son estáticas: ?p= y &l= se leen en el cliente (mismo contrato
// que /presupuesto-instantaneo: ?p=whatsapp&l=fr). Va dentro de <Suspense>.
export default function SubidaPanelFromParams({ lang }: { lang: Locale }) {
  const params = useSearchParams();
  const p = (params.get("p") || "").toLowerCase().trim();
  const source = p === "whatsapp" ? "whatsapp" : null;
  const effectiveLang = source && params.get("l") ? toPuertaLang(params.get("l")) : lang;
  return <SubidaPanel source={source} lang={effectiveLang} />;
}
