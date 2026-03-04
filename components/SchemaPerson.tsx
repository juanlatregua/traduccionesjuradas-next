import Script from "next/script";

type Props = { id?: string };

export function SchemaPerson({ id }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: "Juan Silva Moreno",
    jobTitle: "Traductor-intérprete jurado de francés",
    worksFor: {
      "@type": "Organization",
      name: "HBTJ Consultores Lingüísticos S.L.",
      url: "https://www.traduccionesjuradas.net",
    },
    knowsLanguage: ["es", "fr", "en"],
    hasCredential: {
      "@type": "EducationalOccupationalCredential",
      credentialCategory: "Traductor-intérprete jurado",
      recognizedBy: {
        "@type": "GovernmentOrganization",
        name: "Ministerio de Asuntos Exteriores de España",
      },
    },
    sameAs: "https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Traductores-Interpretes-Jurados.aspx",
  };
  return (
    <Script
      id={id || "schema-person"}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
