import Script from "next/script";

type Offer = {
  price: string;
  priceCurrency: string;
  availability?: string;
  url?: string;
};

type SchemaProductProps = {
  name: string;
  description: string;
  category?: string;
  sku?: string;
  offers: Offer[];
};

export function SchemaProduct({ name, description, category, sku, offers }: SchemaProductProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    category: category || "Traducción jurada",
    sku: sku || undefined,
    offers: offers.map((o) => ({
      "@type": "Offer",
      price: o.price,
      priceCurrency: o.priceCurrency,
      availability: o.availability || "https://schema.org/InStock",
      url: o.url,
    })),
    provider: {
      "@type": "Organization",
      name: "TraduccionesJuradas.net",
      url: "https://traduccionesjuradas.net",
      email: "hola@traduccionesjuradas.net",
      telephone: "+34 951 333 614",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Calle Esperanto, 9",
        addressLocality: "Málaga",
        addressCountry: "ES",
        postalCode: "29007",
      },
    },
  };

  return (
    <Script
      id={`schema-product-${sku || name.toLowerCase().replace(/\s+/g, "-")}`}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
