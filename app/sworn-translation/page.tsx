// app/sworn-translation/page.tsx — Home en inglés (banco de utilidades), mismo
// componente lang-aware que el ES/FR. Datos estructurados localizados (AEO).
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import HomeV2 from "@/components/HomeV2";
import { HOME_FAQ, HOME_HOWTO } from "@/lib/i18n/home-schema";
import { LOCALE_ABS, HREFLANG_ALTERNATES, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: { absolute: "Sworn translation Spanish ↔ English · official validity in Spain" },
  description:
    "Official sworn translation in 10 languages, 100% online. Upload your document and get a fixed quote in 60 seconds. Delivery 24–72h. Translators accredited by Spain's MAEC. From €35.",
  alternates: { canonical: LOCALE_ABS.en, languages: HREFLANG_ALTERNATES },
  openGraph: {
    title: "Sworn translation Spanish ↔ English",
    description: "Fixed price and delivery instantly. Translators accredited by Spain's Ministry of Foreign Affairs (MAEC). From €35.",
    locale: "en_GB",
    url: LOCALE_ABS.en,
  },
};

export default function SwornTranslationPage() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs id="breadcrumbs-home-en" items={[{ name: LOCALE_HOME_LABEL.en, url: LOCALE_ABS.en }]} />
      <SchemaPerson id="schema-person-home-en" />
      <SchemaFAQ items={HOME_FAQ.en} id="schema-faq-home-en" />
      <SchemaHowTo id="schema-howto-home-en" name={HOME_HOWTO.en.name} description={HOME_HOWTO.en.description} steps={HOME_HOWTO.en.steps} />
      <HomeV2 lang="en" />
    </div>
  );
}
