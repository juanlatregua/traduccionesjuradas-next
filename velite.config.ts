import { defineCollection, defineConfig, s } from 'velite'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'

const posts = defineCollection({
  name: 'Post',
  pattern: 'blog/**/*.mdx',
  schema: s
    .object({
      title: s.string().max(120),
      description: s.string().max(300),
      date: s.isodate(),
      dateModified: s.isodate().optional(),
      slug: s.path(),
      published: s.boolean().default(true),
      category: s.enum(['tramites', 'paises', 'faq', 'profesion']),
      keywords: s.array(s.string()).optional(),
      // FAQ opcional → JSON-LD FAQPage server-side (formato que más citan los
      // motores de IA). Las respuestas deben salir del contenido verificado.
      faq: s.array(s.object({ question: s.string(), answer: s.string() })).optional(),
      body: s.mdx(),
      metadata: s.metadata(),
    })
    .transform((data) => ({
      ...data,
      slugAsParams: data.slug.split('/').slice(1).join('/'),
    })),
})

export default defineConfig({
  root: 'content',
  output: {
    data: '.velite',
    assets: 'public/static',
    base: '/static/',
    name: '[name]-[hash:6].[ext]',
    clean: true,
  },
  collections: { posts },
  mdx: {
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
  },
})
