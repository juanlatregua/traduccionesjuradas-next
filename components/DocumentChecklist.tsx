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
    <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs shadow-sm">
      <div className="flex items-center gap-2 text-slate-800">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-[11px] font-bold text-emerald-700">
          PDF
        </span>
        <span className="font-semibold">{example.label}</span>
      </div>
      <a
        href={example.url}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
      >
        Ver ejemplo
      </a>
    </div>
  );

  return (
    <section className="mt-10 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-6 text-sm text-slate-800">
      <h2 className="text-lg font-semibold text-emerald-900">
        Checklist y formato para {category.title}
      </h2>
      <p className="mt-1 text-slate-700">{category.description}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/60 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">Qué revisar</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {category.checklist.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/60 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            Formato y entrega
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {category.formatTips.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span>{item}</span>
              </li>
            ))}
            {category.legalNotes?.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-slate-600">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link
          href="/presupuesto"
          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Pedir presupuesto para {category.title.toLowerCase()}
        </Link>
      </div>

      {examples.length > 0 ? (
        <div className="mt-4 space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Ejemplos anonimizados
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {examples.map((ex) => (
              <ExampleCard key={ex.label} example={ex} />
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            Los ejemplos están censurados para proteger datos personales. Pide presupuesto para tu caso concreto.
          </p>
        </div>
      ) : null}
    </section>
  );
}
