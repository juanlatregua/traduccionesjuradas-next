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
      ratingCount: "46",
    },
    review: [
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Yassine E." },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: "Buen trabajo, bien hecho.",
        datePublished: "2026-04-24",
      },
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Anais A." },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: "Excelente servicio, rapidez y respuesta.",
        datePublished: "2026-03-22",
      },
      {
        "@type": "Review",
        author: { "@type": "Person", name: "Pedro V." },
        reviewRating: { "@type": "Rating", ratingValue: "5", bestRating: "5" },
        reviewBody: "Necesitábamos con urgencia una traducción jurada del francés y el servicio fue fantástico. Muy profesionales.",
        datePublished: "2024-04-15",
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
