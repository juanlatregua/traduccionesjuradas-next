// app/behoerdenbrief-leser/page.tsx — Behördenbrief-Leser (DE).
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import { SchemaService } from "@/components/SchemaService";
import LectorPage from "@/components/LectorPage";
import { lectorT } from "@/lib/i18n/lector";
import { HOWTO_LECTOR, FAQ_LECTOR } from "@/lib/i18n/lector-schema";
import { LECTOR_ABS, LOCALE_ABS, HREFLANG_LECTOR, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

const t = lectorT.de;

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  alternates: { canonical: LECTOR_ABS.de, languages: HREFLANG_LECTOR },
  openGraph: { title: t.h1, description: t.metaDescription, locale: "de_DE", url: LECTOR_ABS.de },
};

export default function Page() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="bc-lector-de"
        items={[
          { name: LOCALE_HOME_LABEL.de, url: LOCALE_ABS.de },
          { name: t.h1, url: LECTOR_ABS.de },
        ]}
      />
      <SchemaHowTo id="howto-lector-de" name={HOWTO_LECTOR.de.name} description={HOWTO_LECTOR.de.description} steps={HOWTO_LECTOR.de.steps} />
      <SchemaFAQ id="faq-lector-de" items={FAQ_LECTOR.de} />
      <SchemaService id="svc-lector-de" serviceName={t.h1} serviceDescription={t.metaDescription} serviceUrl={LECTOR_ABS.de} />
      <LectorPage lang="de" />
    </div>
  );
}
