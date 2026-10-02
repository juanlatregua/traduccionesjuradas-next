// app/beglaubigte-uebersetzung/page.tsx — Home auf Deutsch (Werkzeugkasten),
// gleiche lang-aware Komponente wie ES/FR. Lokalisierte strukturierte Daten (AEO).
import type { Metadata } from "next";
import { SchemaFAQ } from "@/components/SchemaFAQ";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { SchemaPerson } from "@/components/SchemaPerson";
import { SchemaService } from "@/components/SchemaService";
import { SchemaHowTo } from "@/components/SchemaHowTo";
import HomeV2 from "@/components/HomeV2";
import HomeHero from "@/components/home/HomeHero";
import RespuestaDirecta from "@/components/home/RespuestaDirecta";
import { HOME_FAQ, HOME_HOWTO } from "@/lib/i18n/home-schema";
import { LOCALE_ABS, HREFLANG_ALTERNATES, LOCALE_HOME_LABEL } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: { absolute: "Beglaubigte Übersetzung Spanisch ↔ Deutsch · amtlich gültig in Spanien" },
  description:
    "Amtliche beglaubigte Übersetzung in 10 Sprachen, 100 % online. Dokument hochladen und vor der Zahlung ein Festpreisangebot erhalten. Vom spanischen MAEC ermächtigte Übersetzer. Deutsch ab 40 € zzgl. MwSt., Angebot in der Regel am selben Tag.",
  alternates: { canonical: LOCALE_ABS.de, languages: HREFLANG_ALTERNATES },
  openGraph: {
    title: "Beglaubigte Übersetzung Spanisch ↔ Deutsch",
    description: "Festpreis vor der Zahlung. Vom spanischen Außenministerium (MAEC) ermächtigte Übersetzer. Ab 40 € zzgl. MwSt.",
    locale: "de_DE",
    url: LOCALE_ABS.de,
  },
};

export default function BeglaubigteUebersetzungPage() {
  return (
    <div lang="de" className="min-h-screen bg-parchment text-sepia">
      <SchemaBreadcrumbs id="breadcrumbs-home-de" items={[{ name: LOCALE_HOME_LABEL.de, url: LOCALE_ABS.de }]} />
      <SchemaPerson id="schema-person-home-de" />
      <SchemaService id="schema-service-home-de" serviceName="Beglaubigte Übersetzung Spanisch ↔ Deutsch" serviceDescription="Beglaubigte (vereidigte) Übersetzung von Dokumenten für spanische Behörden durch vom spanischen Außenministerium (MAEC) bestellte Übersetzer. Lieferung online als digital signiertes PDF; verbindliches Angebot vor der Zahlung." serviceUrl={LOCALE_ABS.de} serviceType="Beglaubigte Übersetzung" />
      <SchemaFAQ items={HOME_FAQ.de} id="schema-faq-home-de" />
      <SchemaHowTo id="schema-howto-home-de" name={HOME_HOWTO.de.name} description={HOME_HOWTO.de.description} steps={HOME_HOWTO.de.steps} />
      <RespuestaDirecta lang="de" />
      <HomeV2 lang="de" hero={<HomeHero lang="de" />} />
    </div>
  );
}
