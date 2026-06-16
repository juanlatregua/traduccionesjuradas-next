// app/beglaubigte-uebersetzung/page.tsx — Home auf Deutsch (Werkzeugkasten),
// gleiche lang-aware Komponente wie ES/FR. Lokalisierte strukturierte Daten (AEO).
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import HomeV2 from "@/components/HomeV2";
import { HOME_FAQ, HOME_HOWTO } from "@/lib/i18n/home-schema";
import { LOCALE_ABS, HREFLANG_ALTERNATES, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: { absolute: "Beglaubigte Übersetzung Spanisch ↔ Deutsch · amtlich gültig in Spanien" },
  description:
    "Amtliche beglaubigte Übersetzung in 10 Sprachen, 100 % online. Dokument hochladen und in 60 Sekunden ein Festpreisangebot erhalten. Lieferung 24–72 Std. Vom spanischen MAEC ermächtigte Übersetzer. Ab 35 €.",
  alternates: { canonical: LOCALE_ABS.de, languages: HREFLANG_ALTERNATES },
  openGraph: {
    title: "Beglaubigte Übersetzung Spanisch ↔ Deutsch",
    description: "Festpreis und Liefertermin sofort. Vom spanischen Außenministerium (MAEC) ermächtigte Übersetzer. Ab 35 €.",
    locale: "de_DE",
    url: LOCALE_ABS.de,
  },
};

export default function BeglaubigteUebersetzungPage() {
  return (
    <div lang="de" className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs id="breadcrumbs-home-de" items={[{ name: LOCALE_HOME_LABEL.de, url: LOCALE_ABS.de }]} />
      <SchemaPerson id="schema-person-home-de" />
      <SchemaFAQ items={HOME_FAQ.de} id="schema-faq-home-de" />
      <SchemaHowTo id="schema-howto-home-de" name={HOME_HOWTO.de.name} description={HOME_HOWTO.de.description} steps={HOME_HOWTO.de.steps} />
      <HomeV2 lang="de" />
    </div>
  );
}
