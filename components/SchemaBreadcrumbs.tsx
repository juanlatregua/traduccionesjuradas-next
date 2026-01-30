import Script from "next/script";

type Crumb = { name: string; url: string };

type Props = { items: Crumb[]; id?: string };

export function SchemaBreadcrumbs({ items, id }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: c.name,
      item: c.url,
    })),
  };
  return (
    <Script
      id={id || "schema-breadcrumbs"}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
