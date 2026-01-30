import Script from "next/script";

type QA = { question: string; answer: string };

type Props = { items: QA[]; id?: string };

export function SchemaFAQ({ items, id }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((qa) => ({
      "@type": "Question",
      name: qa.question,
      acceptedAnswer: { "@type": "Answer", text: qa.answer },
    })),
  };
  return (
    <Script
      id={id || "schema-faq"}
      type="application/ld+json"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
