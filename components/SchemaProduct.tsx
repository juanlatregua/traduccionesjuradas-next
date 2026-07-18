
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
    // PNG y en el host canónico: Google no acepta SVG para rich results
    // (BMP/GIF/JPEG/PNG/WebP) y el dominio sin www responde 308, así que la
    // imagen del Product quedaba inválida por partida doble.
    image: ["https://www.traduccionesjuradas.net/api/og"],
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
    // Rating/reviews NO van por producto (serían las mismas reseñas del negocio
    // clonadas en 9 fichas → markup auto-servido, riesgo de penalización). El
    // aggregateRating vive solo a nivel de negocio en app/layout.tsx.
    provider: {
      "@type": "Organization",
      name: "TraduccionesJuradas.net",
      url: "https://www.traduccionesjuradas.net",
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
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
