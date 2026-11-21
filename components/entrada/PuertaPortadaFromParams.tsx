"use client";

// Las portadas son estáticas: ?p=whatsapp&l=fr se lee en el cliente (mismo contrato que SubidaPanelFromParams).
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import PuertaPortada from "@/components/entrada/PuertaPortada";
import { toPuertaLang } from "@/lib/i18n/whatsapp-arrival";
import type { EntradaLang } from "@/lib/entrada/i18n";

export default function PuertaPortadaFromParams({ lang, asistente }: { lang: EntradaLang; asistente: ReactNode }) {
  const params = useSearchParams();
  const whatsapp = (params.get("p") || "").toLowerCase().trim() === "whatsapp";
  const effective = whatsapp && params.get("l") ? toPuertaLang(params.get("l")) : lang;
  return <PuertaPortada key={effective} lang={effective} source={whatsapp ? "whatsapp" : null} asistente={asistente} idiomaNav={whatsapp} />;
}
