// app/official-letter-reader/page.tsx — Official letter reader (EN).
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import { SchemaService } from "@/components/SchemaService";
import LectorPage from "@/components/LectorPage";
import { lectorT } from "@/lib/i18n/lector";
import { HOWTO_LECTOR, FAQ_LECTOR } from "@/lib/i18n/lector-schema";
import { LECTOR_ABS, LOCALE_ABS, HREFLANG_LECTOR, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

const t = lectorT.en;

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  alternates: { canonical: LECTOR_ABS.en, languages: HREFLANG_LECTOR },
  openGraph: { title: t.h1, description: t.metaDescription, locale: "en_GB", url: LECTOR_ABS.en },
};

export default function Page() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="bc-lector-en"
        items={[
          { name: LOCALE_HOME_LABEL.en, url: LOCALE_ABS.en },
          { name: t.h1, url: LECTOR_ABS.en },
        ]}
      />
      <SchemaHowTo id="howto-lector-en" name={HOWTO_LECTOR.en.name} description={HOWTO_LECTOR.en.description} steps={HOWTO_LECTOR.en.steps} />
      <SchemaFAQ id="faq-lector-en" items={FAQ_LECTOR.en} />
      <SchemaService id="svc-lector-en" serviceName={t.h1} serviceDescription={t.metaDescription} serviceUrl={LECTOR_ABS.en} />
      <LectorPage lang="en" />
    </div>
  );
}
