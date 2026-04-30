
type Step = { name: string; text: string };

type Props = {
  name: string;
  description: string;
  steps: Step[];
  id?: string;
};

export function SchemaHowTo({ name, description, steps, id }: Props) {
  const data = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description,
    step: steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      text: s.text,
    })),
  };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}
