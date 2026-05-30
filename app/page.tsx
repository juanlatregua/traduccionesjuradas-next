// app/page.tsx — Home v2 "banco de utilidades" (ES). Cuerpo en <HomeV2 lang>,
// lang-aware y reutilizable (FR/EN/DE/PT viven en sus rutas con el mismo
// componente). Aquí se conservan metadata + datos estructurados (SEO/AEO).
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import HomeV2 from "@/components/HomeV2";
import { HOME_FAQ, HOME_HOWTO } from "@/lib/i18n/home-schema";
import { LOCALE_ABS, HREFLANG_ALTERNATES, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: {
    absolute: "Traducción jurada oficial · 10 idiomas · validez en toda España",
  },
  description:
    "Traducción jurada oficial en 10 idiomas, 100% online. Sube tu documento y recibe presupuesto cerrado en 60 segundos. Entrega 24-72h. Traductores jurados acreditados por el MAEC. Desde 35€.",
  alternates: {
    canonical: LOCALE_ABS.es,
    languages: HREFLANG_ALTERNATES,
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs
        id="breadcrumbs-home"
        items={[{ name: LOCALE_HOME_LABEL.es, url: "https://www.traduccionesjuradas.net/" }]}
      />
      <SchemaPerson id="schema-person-home" />
      <SchemaFAQ items={HOME_FAQ.es} id="schema-faq-home" />
      <SchemaHowTo
        id="schema-howto-home"
        name={HOME_HOWTO.es.name}
        description={HOME_HOWTO.es.description}
        steps={HOME_HOWTO.es.steps}
      />

      <HomeV2 lang="es" />
    </div>
  );
}
