// app/quelles-traductions-pour-ma-demarche/page.tsx — Lecteur de courriers (FR).
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import { SchemaService } from "@/components/SchemaService";
import LectorPage from "@/components/LectorPage";
import { lectorT } from "@/lib/i18n/lector";
import { HOWTO_LECTOR, FAQ_LECTOR } from "@/lib/i18n/lector-schema";
import { LECTOR_ABS, LOCALE_ABS, HREFLANG_LECTOR, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

const t = lectorT.fr;

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  alternates: { canonical: LECTOR_ABS.fr, languages: HREFLANG_LECTOR },
  openGraph: { title: t.h1, description: t.metaDescription, locale: "fr_FR", url: LECTOR_ABS.fr },
};

export default function Page() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="bc-lector-fr"
        items={[
          { name: LOCALE_HOME_LABEL.fr, url: LOCALE_ABS.fr },
          { name: t.h1, url: LECTOR_ABS.fr },
        ]}
      />
      <SchemaHowTo id="howto-lector-fr" name={HOWTO_LECTOR.fr.name} description={HOWTO_LECTOR.fr.description} steps={HOWTO_LECTOR.fr.steps} />
      <SchemaFAQ id="faq-lector-fr" items={FAQ_LECTOR.fr} />
      <SchemaService id="svc-lector-fr" serviceName={t.h1} serviceDescription={t.metaDescription} serviceUrl={LECTOR_ABS.fr} />
      <LectorPage lang="fr" />
    </div>
  );
}
