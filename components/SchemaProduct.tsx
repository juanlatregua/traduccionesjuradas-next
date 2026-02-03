import Script from "next/script";

type Offer = {
  price: string;
  priceCurrency: string;
  availability?: string;
  url?: string;
  shippingDetails?: any;
};

type SchemaProductProps = {
  name: string;
  description: string;
  category?: string;
  sku?: string;
  offers: Offer[];
};

export function SchemaProduct({ name, description, category, sku, offers }: SchemaProductProps) {
  const shippingDetails = {
    "@type": "OfferShippingDetails",
    shippingRate: {
      "@type": "MonetaryAmount",
      value: 0,
      currency: "EUR",
    },
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "ES",
    },
  };

  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    returnPolicyCategory: "https://schema.org/NonRefundable",
    name: "Servicio no reembolsable tras iniciar la traducción",
  };

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    category: category || "Traducción jurada",
    sku: sku || undefined,
    image: ["https://traduccionesjuradas.net/logo-tj-app.svg"],
    offers: offers.map((o) => ({
      "@type": "Offer",
      price: o.price,
      priceCurrency: o.priceCurrency,
      availability: o.availability || "https://schema.org/InStock",
      url: o.url,
      shippingDetails: o.shippingDetails || shippingDetails,
      hasMerchantReturnPolicy: returnPolicy,
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
