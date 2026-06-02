// app/que-traducciones-necesito/page.tsx — Lector de requerimientos (ES).
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import { SchemaService } from "@/components/SchemaService";
import LectorPage from "@/components/LectorPage";
import { lectorT } from "@/lib/i18n/lector";
import { HOWTO_LECTOR, FAQ_LECTOR } from "@/lib/i18n/lector-schema";
import { LECTOR_ABS, LOCALE_ABS, HREFLANG_LECTOR, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

const t = lectorT.es;

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  alternates: { canonical: LECTOR_ABS.es, languages: HREFLANG_LECTOR },
  openGraph: { title: t.h1, description: t.metaDescription, locale: "es_ES", url: LECTOR_ABS.es },
};

export default function Page() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="bc-lector-es"
        items={[
          { name: LOCALE_HOME_LABEL.es, url: LOCALE_ABS.es },
          { name: t.h1, url: LECTOR_ABS.es },
        ]}
      />
      <SchemaHowTo id="howto-lector-es" name={HOWTO_LECTOR.es.name} description={HOWTO_LECTOR.es.description} steps={HOWTO_LECTOR.es.steps} />
      <SchemaFAQ id="faq-lector-es" items={FAQ_LECTOR.es} />
      <SchemaService id="svc-lector-es" serviceName={t.h1} serviceDescription={t.metaDescription} serviceUrl={LECTOR_ABS.es} />
      <LectorPage lang="es" />
    </div>
  );
}
