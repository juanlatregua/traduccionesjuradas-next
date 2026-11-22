"use client";

// Las portadas son estáticas: ?p=<origen>&l=fr se lee en el cliente (mismos orígenes que /presupuesto-instantaneo).
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import PuertaPortada from "@/components/entrada/PuertaPortada";
import { toPuertaLang } from "@/lib/i18n/whatsapp-arrival";
import type { EntradaLang } from "@/lib/entrada/i18n";
import { sourceDe } from "@/lib/entrada/sources";

export default function PuertaPortadaFromParams({ lang, asistente }: { lang: EntradaLang; asistente: ReactNode }) {
  const params = useSearchParams();
  const source = sourceDe(params.get("p"));
  const whatsapp = source === "whatsapp";
  const effective = whatsapp && params.get("l") ? toPuertaLang(params.get("l")) : lang;
  return <PuertaPortada key={effective} lang={effective} source={source} asistente={asistente} idiomaNav={whatsapp} />;
}
