
type Props = { id?: string };

export function SchemaLocalBusiness({ id }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "TraduccionesJuradas.net – HBTJ Consultores Lingüísticos S.L.",
    url: "https://www.traduccionesjuradas.net",
    telephone: "+34951333614",
    email: "hola@traduccionesjuradas.net",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Calle Esperanto, 9",
      addressLocality: "Málaga",
      postalCode: "29007",
      addressCountry: "ES",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "19:00",
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: "+34951333614",
      contactType: "customer service",
      availableLanguage: ["Spanish", "French", "English"],
      areaServed: "ES",
    },
    priceRange: "€€",
    sameAs: [
      "https://wa.me/34607356273",
    ],
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
