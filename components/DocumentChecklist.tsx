import { DOCUMENT_CATEGORIES, DocumentCategory } from "@/lib/documents";
import Link from "next/link";

function findCategory(slug?: string): DocumentCategory | undefined {
  if (!slug) return undefined;
  return DOCUMENT_CATEGORIES.find((c) => c.slug === slug);
}

export function DocumentChecklist({ slug }: { slug?: string }) {
  const category = findCategory(slug);
  if (!category) return null;

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
        {category.exampleUrl ? (
          <a
            href={category.exampleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-emerald-800 underline-offset-2 hover:underline"
          >
            Ver ejemplo anon. (PDF)
          </a>
        ) : null}
      </div>
    </section>
  );
}
