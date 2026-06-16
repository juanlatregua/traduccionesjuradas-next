import type { Metadata } from "next";
import Link from "next/link";
import { posts } from "@/content";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "Blog | Guías sobre traducción jurada en España",
  description:
    "Guías prácticas sobre traducción jurada, trámites de extranjería, homologación de títulos y documentación oficial en España.",
  alternates: { canonical: "https://www.traduccionesjuradas.net/blog" },
  openGraph: {
    images: [
      {
        url: "/api/og?title=Blog&subtitle=Gu%C3%ADas+sobre+traducci%C3%B3n+jurada+en+Espa%C3%B1a",
        width: 1200,
        height: 630,
        alt: "Blog — TraduccionesJuradas.net",
      },
    ],
  },
};

const CATEGORY_LABELS: Record<string, string> = {
  tramites: "Trámites",
  paises: "Países",
  faq: "Preguntas frecuentes",
  profesion: "Profesión",
};

export default function BlogPage() {
  const publishedPosts = posts
    .filter((p) => p.published)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-blog"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Blog", url: "https://www.traduccionesjuradas.net/blog" },
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          { name: "Blog", href: "/blog" },
        ]}
      />

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Blog
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
          Guías sobre traducción jurada en España
        </h1>
        {/* Respuesta-arriba citable (AEO). */}
        <p className="mt-3 text-base font-medium text-encre">
          Una traducción jurada es la traducción oficial de un documento, firmada y sellada por un traductor jurado acreditado por el Ministerio de Asuntos Exteriores (MAEC), con plena validez legal ante organismos oficiales de España y del extranjero. Estas guías explican cuándo se necesita y cómo tramitarla.
        </p>
        <p className="mt-3 text-sm text-sepia sm:text-base">
          Artículos prácticos sobre traducción jurada, trámites de extranjería,
          homologación de títulos y documentación oficial.
        </p>
      </header>

      <div className="mt-10 grid gap-6">
        {publishedPosts.map((post) => (
          <article
            key={post.slugAsParams}
            className="rounded-2xl border border-cream bg-card p-5 shadow-sm transition hover:border-bleu hover:shadow-md"
          >
            <Link href={`/blog/${post.slugAsParams}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-block rounded-full bg-bleu/10 px-2.5 py-0.5 text-[11px] font-semibold text-bleu">
                    {CATEGORY_LABELS[post.category] || post.category}
                  </span>
                  <h2 className="mt-2 text-lg font-semibold text-encre hover:text-bleu transition-colors">
                    {post.title}
                  </h2>
                  <p className="mt-1 text-sm text-sepia">{post.description}</p>
                </div>
              </div>
              <time className="mt-3 block text-xs text-graphite">
                {new Date(post.date).toLocaleDateString("es-ES", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
            </Link>
          </article>
        ))}

        {publishedPosts.length === 0 && (
          <p className="text-sm text-graphite">
            Próximamente publicaremos artículos aquí.
          </p>
        )}
      </div>
    </main>
  );
}
