import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { posts } from "@/content";
import { notFound } from "next/navigation";
import { MDXContent } from "@/components/blog/MDXContent";
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs";
import { Breadcrumbs } from "@/components/Breadcrumbs";

const CATEGORY_LABELS: Record<string, string> = {
  tramites: "Trámites",
  paises: "Países",
  faq: "Preguntas frecuentes",
  profesion: "Profesión",
};

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return posts
    .filter((p) => p.published)
    .map((post) => ({ slug: post.slugAsParams }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slugAsParams === slug);
  if (!post) return {};
  return {
    title: `${post.title} | Traducciones Juradas`,
    description: post.description,
    keywords: post.keywords,
    alternates: {
      canonical: `https://www.traduccionesjuradas.net/blog/${post.slugAsParams}`,
    },
    openGraph: {
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(post.title)}&subtitle=Blog+%E2%80%94+TraduccionesJuradas.net`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { slug } = await params;
  const post = posts.find((p) => p.slugAsParams === slug);
  if (!post || !post.published) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 lg:py-12">
      <SchemaBreadcrumbs
        id="breadcrumbs-blog-post"
        items={[
          { name: "Inicio", url: "https://www.traduccionesjuradas.net/" },
          { name: "Blog", url: "https://www.traduccionesjuradas.net/blog" },
          {
            name: post.title,
            url: `https://www.traduccionesjuradas.net/blog/${post.slugAsParams}`,
          },
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Inicio", href: "/" },
          { name: "Blog", href: "/blog" },
          { name: post.title, href: `/blog/${post.slugAsParams}` },
        ]}
      />

      <Script
        id="schema-article"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.description,
            image: [`https://www.traduccionesjuradas.net/api/og?title=${encodeURIComponent(post.title)}&subtitle=Blog+%E2%80%94+TraduccionesJuradas.net`],
            datePublished: post.date,
            dateModified: post.date,
            author: {
              "@type": "Person",
              name: "Juan Silva Moreno",
              jobTitle: "Traductor Jurado",
              url: "https://www.traduccionesjuradas.net/acreditacion",
            },
            publisher: {
              "@type": "Organization",
              name: "TraduccionesJuradas.net",
              url: "https://www.traduccionesjuradas.net",
            },
            mainEntityOfPage: `https://www.traduccionesjuradas.net/blog/${post.slugAsParams}`,
            keywords: post.keywords?.join(", "),
          }),
        }}
      />

      <article>
        <header className="mb-8">
          <span className="inline-block rounded-full bg-bleu/10 px-2.5 py-0.5 text-[11px] font-semibold text-bleu">
            {CATEGORY_LABELS[post.category] || post.category}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-encre sm:text-4xl">
            {post.title}
          </h1>
          <p className="mt-3 text-sm text-sepia sm:text-base">
            {post.description}
          </p>
          <time className="mt-2 block text-xs text-graphite">
            {new Date(post.date).toLocaleDateString("es-ES", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </time>
        </header>

        <div className="prose-tj">
          <MDXContent code={post.body} />
        </div>

        {/* POSTS RELACIONADOS */}
        {(() => {
          const related = posts
            .filter((p) => p.published && p.slugAsParams !== slug)
            .sort((a, b) => {
              const aMatch = a.category === post.category ? 1 : 0;
              const bMatch = b.category === post.category ? 1 : 0;
              if (bMatch !== aMatch) return bMatch - aMatch;
              return new Date(b.date).getTime() - new Date(a.date).getTime();
            })
            .slice(0, 3);
          if (related.length === 0) return null;
          return (
            <section className="mt-12">
              <h2 className="text-lg font-semibold text-encre">
                También te puede interesar
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {related.map((r) => (
                  <Link
                    key={r.slugAsParams}
                    href={`/blog/${r.slugAsParams}`}
                    className="group rounded-xl border border-cream bg-card p-4 shadow-sm transition hover:border-bleu hover:shadow-md"
                  >
                    <span className="inline-block rounded-full bg-bleu/10 px-2 py-0.5 text-[10px] font-semibold text-bleu">
                      {CATEGORY_LABELS[r.category] || r.category}
                    </span>
                    <h3 className="mt-2 text-sm font-semibold text-encre group-hover:text-bleu transition-colors">
                      {r.title}
                    </h3>
                  </Link>
                ))}
              </div>
            </section>
          );
        })()}

        {/* CTA */}
        <section className="mt-12 rounded-2xl border border-cream bg-cream/70 p-6 text-sm">
          <h2 className="text-lg font-semibold text-bleu">
            ¿Necesitas una traducción jurada?
          </h2>
          <p className="mt-1 text-encre">
            Sube tu documento y recibe un{" "}
            <strong>precio cerrado al instante</strong>.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href="/presupuesto-instantaneo"
              className="rounded-2xl bg-bleu px-5 py-2 text-xs font-semibold text-white hover:bg-bleu-dark"
            >
              Presupuesto instantáneo
            </Link>
            <Link
              href="/blog"
              className="text-xs font-medium text-bleu underline-offset-2 hover:underline"
            >
              Volver al blog
            </Link>
          </div>
        </section>
      </article>
    </main>
  );
}
