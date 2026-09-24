"use client";

// components/home/SubidaPanel.tsx — «Suelta tus documentos» (maqueta 22-sep)
// con dos pestañas: un documento (la puerta de siempre: email + par de idiomas
// + consentimiento ANTES de subir, orden de Juan 4-sep) y expediente grande
// (components/ExpedientePublicIntake, el mismo de /expediente). Nada de lógica
// de subida aquí: solo se elige cuál de las dos se enseña.

import { useId, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Upload, FolderOpen, Loader2 } from "lucide-react";
import PuertaClient from "@/app/presupuesto-instantaneo/PuertaClient";
import type { PuertaLang } from "@/lib/i18n/puerta";
import { PUERTA_LANGS, WHATSAPP_HEAD, toPuertaLang } from "@/lib/i18n/whatsapp-arrival";

const ExpedientePublicIntake = dynamic(() => import("@/components/ExpedientePublicIntake"), {
  ssr: false,
  loading: () => (
    <p className="flex items-center gap-2 py-6 text-sm text-graphite">
      <Loader2 className="h-4 w-4 animate-spin text-bleu" aria-hidden="true" />
      Preparando la subida del expediente…
    </p>
  ),
});

type Tab = "uno" | "expediente";

const TABS: { key: Tab; label: string; hint: string; icon: typeof Upload }[] = [
  { key: "uno", label: "Un documento", hint: "Presupuesto al instante", icon: Upload },
  { key: "expediente", label: "Varios documentos o expediente grande", hint: "Hasta 300 archivos, ZIP, 500 MB c/u", icon: FolderOpen },
];

export function SubidaPanel({ source, lang }: { source: string | null; lang: PuertaLang }) {
  const [tab, setTab] = useState<Tab>("uno");
  const base = useId();
  const fromWhatsApp = source === "whatsapp";

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
            {fromWhatsApp ? WHATSAPP_HEAD[lang].title : "Sube o fotografía tu documento"}
          </h2>
          <p className="text-sm text-graphite">Precio cerrado al momento en francés · en el día en los demás idiomas</p>
        </div>
      </div>

      {fromWhatsApp && (
        <>
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{WHATSAPP_HEAD[lang].banner}</p>
          <nav aria-label="Idioma" className="flex flex-wrap gap-2">
            {PUERTA_LANGS.map((l) => (
              <Link
                key={l}
                href={`/?p=whatsapp&l=${l}`}
                aria-current={l === lang ? "true" : undefined}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${
                  l === lang ? "border-bleu bg-bleu text-white" : "border-bleu/20 bg-parchment text-bleu hover:border-or"
                }`}
              >
                {l}
              </Link>
            ))}
          </nav>
        </>
      )}

      <div role="tablist" aria-label="Qué vas a subir" className="grid grid-cols-2 gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`${base}-tab-${t.key}`}
              aria-selected={active}
              aria-controls={`${base}-panel-${t.key}`}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.key)}
              className={`flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition-colors sm:px-4 ${
                active ? "border-bleu bg-bleu/5 text-encre" : "border-graphite/20 bg-parchment text-graphite hover:border-bleu/40"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-bold leading-tight sm:text-[15px]">
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-bleu" : "text-graphite"}`} aria-hidden="true" />
                {t.label}
              </span>
              <span className="text-xs leading-tight">{t.hint}</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panel-uno`}
        aria-labelledby={`${base}-tab-uno`}
        hidden={tab !== "uno"}
      >
        {tab === "uno" && <PuertaClient purpose={null} source={source} lang={lang} />}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel-expediente`}
        aria-labelledby={`${base}-tab-expediente`}
        hidden={tab !== "expediente"}
      >
        {tab === "expediente" && (
          <div className="space-y-4">
            <p className="text-sm text-graphite">
              Sube todos los documentos del expediente de una vez: PDF, fotos, escaneos o ZIP. Preparamos{" "}
              <strong className="text-encre">un presupuesto único</strong> y te lo enviamos por email.
            </p>
            <ExpedientePublicIntake />
          </div>
        )}
      </div>
    </section>
  );
}

// La portada es estática: ?p= y &l= se leen en el cliente (mismo contrato que
// /presupuesto-instantaneo: ?p=whatsapp&l=fr). Va dentro de <Suspense>.
export default function SubidaPanelFromParams() {
  const params = useSearchParams();
  const p = (params.get("p") || "").toLowerCase().trim();
  const source = p === "whatsapp" ? "whatsapp" : null;
  const lang = source ? toPuertaLang(params.get("l")) : "es";
  return <SubidaPanel source={source} lang={lang} />;
}
