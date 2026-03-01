import {
  DOCUMENT_CATEGORIES,
  DocumentCategory,
  DocumentExample,
} from "@/lib/documents";
import Link from "next/link";

function findCategory(slug?: string): DocumentCategory | undefined {
  if (!slug) return undefined;
  return DOCUMENT_CATEGORIES.find((c) => c.slug === slug);
}

export function DocumentChecklist({ slug }: { slug?: string }) {
  const category = findCategory(slug);
  if (!category) return null;

  const examples = category.examples || [];

  const ExampleCard = ({ example }: { example: DocumentExample }) => (
    <div className="flex items-center justify-between rounded-xl border border-cream bg-card px-3 py-2 text-xs shadow-paper">
      <div className="flex items-center gap-2 text-encre">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-cream text-[11px] font-bold text-bleu">
          PDF
        </span>
        <span className="font-semibold">{example.label}</span>
      </div>
      <a
        href={example.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-cream px-2 py-1 text-[11px] font-semibold text-bleu hover:bg-parchment"
      >
        Ver ejemplo
      </a>
    </div>
  );

  return (
    <section className="mt-10 rounded-3xl border border-cream bg-cream p-6 text-sm text-sepia">
      <h2 className="text-lg font-semibold text-encre">
        Checklist y formato para {category.title}
      </h2>
      <p className="mt-1 text-sepia">{category.description}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-doc border border-cream bg-card p-4 shadow-paper">
          <h3 className="text-sm font-semibold text-encre">Qué revisar</h3>
          <ul className="mt-2 space-y-2 text-sm text-sepia">
            {category.checklist.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-bleu" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-doc border border-cream bg-card p-4 shadow-paper">
          <h3 className="text-sm font-semibold text-encre">
            Formato y entrega
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-sepia">
            {category.formatTips.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-bleu" />
                <span>{item}</span>
              </li>
            ))}
            {category.legalNotes?.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-sepia">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-or" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/presupuesto"
          className="inline-flex items-center gap-2 rounded-2xl bg-bleu px-4 py-2 font-semibold text-parchment shadow-sm hover:bg-bleu-dark"
        >
          Pedir presupuesto para {category.title.toLowerCase()}
        </Link>
      </div>

      {examples.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-graphite">
            Ejemplos anonimizados
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {examples.map((ex) => (
              <ExampleCard key={ex.label} example={ex} />
            ))}
          </div>
          <p className="text-[11px] text-graphite">
            Los ejemplos están censurados para proteger datos personales. Pide presupuesto para tu caso concreto.
          </p>
        </div>
      ) : null}
    </section>
  );
}
