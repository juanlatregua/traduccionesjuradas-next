// app/leitor-de-notificacoes/page.tsx — Leitor de notificações (PT).
import type { Metadata } from "next";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import { SchemaService } from "@/components/SchemaService";
import LectorPage from "@/components/LectorPage";
import { lectorT } from "@/lib/i18n/lector";
import { HOWTO_LECTOR, FAQ_LECTOR } from "@/lib/i18n/lector-schema";
import { LECTOR_ABS, LOCALE_ABS, HREFLANG_LECTOR, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

const t = lectorT.pt;

export const metadata: Metadata = {
  title: { absolute: t.metaTitle },
  description: t.metaDescription,
  alternates: { canonical: LECTOR_ABS.pt, languages: HREFLANG_LECTOR },
  openGraph: { title: t.h1, description: t.metaDescription, locale: "pt_PT", url: LECTOR_ABS.pt },
};

export default function Page() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="bc-lector-pt"
        items={[
          { name: LOCALE_HOME_LABEL.pt, url: LOCALE_ABS.pt },
          { name: t.h1, url: LECTOR_ABS.pt },
        ]}
      />
      <SchemaHowTo id="howto-lector-pt" name={HOWTO_LECTOR.pt.name} description={HOWTO_LECTOR.pt.description} steps={HOWTO_LECTOR.pt.steps} />
      <SchemaFAQ id="faq-lector-pt" items={FAQ_LECTOR.pt} />
      <SchemaService id="svc-lector-pt" serviceName={t.h1} serviceDescription={t.metaDescription} serviceUrl={LECTOR_ABS.pt} />
      <LectorPage lang="pt" />
    </div>
  );
}
