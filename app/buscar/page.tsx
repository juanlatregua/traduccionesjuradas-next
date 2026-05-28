import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { SITE_SEARCH_INDEX } from "@/lib/search/site-index";
import { searchSite, groupResults } from "@/lib/search/match";

export const metadata: Metadata = {
  title: "Buscar",
  description: "Busca páginas, idiomas, ciudades, documentos y guías en traduccionesjuradas.net.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.traduccionesjuradas.net/buscar" },
};

export default function BuscarPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q || "").trim();
  const results = q ? searchSite(q, SITE_SEARCH_INDEX, 50) : [];
  const grouped = groupResults(results);

  return (
    <section className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-baskerville text-3xl font-bold text-bleu">Buscar</h1>
      <p className="mt-2 text-sm text-graphite">
        Encuentra cualquier página: idiomas, ciudades, tipos de documento,
        precios o guías del blog.
      </p>

      <form action="/buscar" method="get" role="search" className="mt-6">
        <label htmlFor="q" className="sr-only">
          Buscar en la web
        </label>
        <div className="flex items-center gap-3 rounded-xl border border-graphite/20 bg-white px-3 focus-within:border-bleu focus-within:ring-1 focus-within:ring-bleu/20">
          <Search className="h-5 w-5 shrink-0 text-bleu" aria-hidden="true" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            autoFocus
            placeholder="Busca idioma, ciudad, documento, guía…"
            className="w-full bg-transparent py-3 text-base text-encre outline-none placeholder:text-graphite"
          />
          <button
            type="submit"
            className="my-1.5 shrink-0 rounded-lg bg-bleu px-4 py-1.5 text-sm font-semibold text-white hover:bg-bleu/90"
          >
            Buscar
          </button>
        </div>
      </form>

      <div className="mt-8">
        {q === "" && (
          <p className="text-sm text-graphite">
            Escribe arriba lo que buscas.
          </p>
        )}

        {q !== "" && results.length === 0 && (
          <p className="text-sm text-graphite">
            Sin resultados para «{q}». Prueba con otra palabra o{" "}
            <a
              href="https://wa.me/34951333614"
              className="font-semibold text-bleu hover:underline"
            >
              escríbenos por WhatsApp
            </a>
            .
          </p>
        )}

        {grouped.map(([group, items]) => (
          <div key={group} className="mb-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-graphite">
              {group}
            </p>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className="flex items-center justify-between gap-3 rounded-lg border border-cream bg-card px-4 py-2.5 text-sm text-encre transition-colors hover:border-bleu hover:text-bleu"
                  >
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <span className="shrink-0 text-graphite" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
