// app/traducao-certificada/page.tsx — Home em português (caixa de ferramentas),
// mesmo componente lang-aware que ES/FR. Dados estruturados localizados (AEO).
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import HomeV2 from "@/components/HomeV2";
import { HOME_FAQ, HOME_HOWTO } from "@/lib/i18n/home-schema";
import { LOCALE_ABS, HREFLANG_ALTERNATES, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: { absolute: "Tradução certificada espanhol ↔ português · validade oficial em Espanha" },
  description:
    "Tradução certificada oficial em 10 idiomas, 100% online. Envie o seu documento e receba um orçamento fechado em 60 segundos. Entrega 24–72h. Tradutores acreditados pelo MAEC de Espanha. Desde 35 €.",
  alternates: { canonical: LOCALE_ABS.pt, languages: HREFLANG_ALTERNATES },
  openGraph: {
    title: "Tradução certificada espanhol ↔ português",
    description: "Preço fechado e prazo de imediato. Tradutores acreditados pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC). Desde 35 €.",
    locale: "pt_PT",
    url: LOCALE_ABS.pt,
  },
};

export default function TraducaoCertificadaPage() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs id="breadcrumbs-home-pt" items={[{ name: LOCALE_HOME_LABEL.pt, url: LOCALE_ABS.pt }]} />
      <SchemaPerson id="schema-person-home-pt" />
      <SchemaFAQ items={HOME_FAQ.pt} id="schema-faq-home-pt" />
      <SchemaHowTo id="schema-howto-home-pt" name={HOME_HOWTO.pt.name} description={HOME_HOWTO.pt.description} steps={HOME_HOWTO.pt.steps} />
      <HomeV2 lang="pt" />
    </div>
  );
}
