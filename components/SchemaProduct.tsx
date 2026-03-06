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
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 1,
        maxValue: 3,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 0,
        unitCode: "DAY",
      },
    },
  };

  const returnPolicy = {
    "@type": "MerchantReturnPolicy",
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    name: "Servicio no reembolsable tras iniciar la traducción",
    applicableCountry: "ES",
  };

  const data = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    category: category || "Traducción jurada",
    sku: sku || undefined,
    brand: {
      "@type": "Brand",
      name: "TraduccionesJuradas.net",
    },
    image: ["https://traduccionesjuradas.net/brand/logo-horizontal.svg"],
    offers: offers.map((o) => ({
      "@type": "Offer",
      price: o.price,
      priceCurrency: o.priceCurrency,
      priceValidUntil: `${new Date().getFullYear()}-12-31`,
      availability: o.availability || "https://schema.org/InStock",
      url: o.url,
      shippingDetails: o.shippingDetails || [shippingDetails],
      hasMerchantReturnPolicy: returnPolicy,
    })),
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      bestRating: "5",
      ratingCount: "43",
    },
    review: [
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Julio Roza" },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: "Trato exquisito, trabajo óptimo.",
      },
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Alejandro García Riesgo" },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: "Muy rápidos y muy eficaces.",
      },
      {
        "@type": "Review",
        author: { "@type": "Person", name: "María López Torner" },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: "Estoy realmente satisfecha con el encargo.",
      },
    ],
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
