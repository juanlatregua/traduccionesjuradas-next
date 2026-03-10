import Script from "next/script";

type Props = {
  id?: string;
  serviceName: string;
  serviceDescription: string;
  serviceUrl: string;
  brand?: { "@type": string; name: string };
  provider?: { "@type": string; name: string; jobTitle?: string };
};

export function SchemaService({ id, serviceName, serviceDescription, serviceUrl, brand, provider }: Props) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: serviceName,
    description: serviceDescription,
    url: serviceUrl,
    provider: provider ?? {
      "@type": "ProfessionalService",
      name: "TraduccionesJuradas.net – HBTJ Consultores Lingüísticos S.L.",
      url: "https://www.traduccionesjuradas.net",
      telephone: "+34951333614",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Calle Esperanto, 9",
        addressLocality: "Málaga",
        postalCode: "29007",
        addressCountry: "ES",
      },
    },
    areaServed: {
      "@type": "Country",
      name: "Spain",
    },
    serviceType: "Traducción jurada",
  };
  if (brand) {
    data.brand = brand;
  }
  return (
    <Script
      id={id || "schema-service"}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
