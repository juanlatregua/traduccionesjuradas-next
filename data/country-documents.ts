// data/country-documents.ts — Documentos típicos por país

export type CountryInfo = {
  code: string;
  name: string;
  nameEs: string;
  flag: string;
  commonDocuments: string[];
  languages: string[];
};

export const COUNTRIES: CountryInfo[] = [
  {
    code: "FR",
    name: "France",
    nameEs: "Francia",
    flag: "/flags/fr.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "criminal_record", "degree"],
    languages: ["fr"],
  },
  {
    code: "MA",
    name: "Maroc",
    nameEs: "Marruecos",
    flag: "/flags/ma.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "criminal_record", "passport"],
    languages: ["fr", "ar"],
  },
  {
    code: "BE",
    name: "Belgique",
    nameEs: "Bélgica",
    flag: "/flags/be.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "degree"],
    languages: ["fr", "nl"],
  },
  {
    code: "CH",
    name: "Suisse",
    nameEs: "Suiza",
    flag: "/flags/ch.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "criminal_record"],
    languages: ["fr", "de", "it"],
  },
  {
    code: "GB",
    name: "United Kingdom",
    nameEs: "Reino Unido",
    flag: "/flags/gb.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "criminal_record", "degree"],
    languages: ["en"],
  },
  {
    code: "DE",
    name: "Deutschland",
    nameEs: "Alemania",
    flag: "/flags/de.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "degree", "criminal_record"],
    languages: ["de"],
  },
  {
    code: "IT",
    name: "Italia",
    nameEs: "Italia",
    flag: "/flags/it.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "degree"],
    languages: ["it"],
  },
  {
    code: "PT",
    name: "Portugal",
    nameEs: "Portugal",
    flag: "/flags/pt.svg",
    commonDocuments: ["birth_certificate", "marriage_certificate", "criminal_record"],
    languages: ["pt"],
  },
  {
    code: "US",
    name: "United States",
    nameEs: "Estados Unidos",
    flag: "/flags/us.svg",
    commonDocuments: ["birth_certificate", "degree", "criminal_record"],
    languages: ["en"],
  },
];

export function getCountryInfo(code: string): CountryInfo | undefined {
  return COUNTRIES.find((c) => c.code === code);
}
