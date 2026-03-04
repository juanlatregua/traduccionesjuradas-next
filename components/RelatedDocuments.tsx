import Link from "next/link";

const ALL_DOCS = [
  { slug: "certificados-registro-civil", name: "Certificados del Registro Civil" },
  { slug: "certificado-de-nacimiento", name: "Certificado de nacimiento" },
  { slug: "certificado-de-matrimonio", name: "Certificado de matrimonio" },
  { slug: "antecedentes-penales", name: "Antecedentes penales" },
  { slug: "documentos-academicos", name: "Documentos académicos" },
  { slug: "documentos-laborales", name: "Documentos laborales" },
  { slug: "documentos-juridicos", name: "Documentos jurídicos" },
  { slug: "documentos-mercantiles", name: "Documentos mercantiles" },
  { slug: "apostilla-haya", name: "Apostilla de La Haya" },
];

type Props = { currentSlug: string };

export function RelatedDocuments({ currentSlug }: Props) {
  const others = ALL_DOCS.filter((d) => d.slug !== currentSlug);

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-encre">
        Otros documentos oficiales
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {others.map((doc) => (
          <Link
            key={doc.slug}
            href={`/documentos-oficiales/${doc.slug}`}
            className="rounded-full border border-cream bg-card px-3 py-1.5 text-xs font-medium text-encre hover:border-bleu hover:text-bleu transition-colors"
          >
            {doc.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
