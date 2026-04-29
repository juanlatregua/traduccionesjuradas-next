# SEO — Schema JSON-LD, metadata y OG images

## Componentes Schema (7)
| Componente | Tipo JSON-LD | Ubicación |
|------------|-------------|-----------|
| `SchemaBreadcrumbs` | BreadcrumbList | Todas las páginas públicas |
| `SchemaFAQ` | FAQPage | Home, idiomas, documentos, online |
| `SchemaService` | Service | Idiomas, documentos, ciudades* |
| `SchemaProduct` | Product | Idiomas, documentos (con precios) |
| `SchemaHowTo` | HowTo | /proceso |
| `SchemaPerson` | Person | /traductores-jurados |
| `SchemaLocalBusiness` | ProfessionalService | layout.tsx (global) |

*Ciudades usan schema inline (no componente).

## Mapping: página → schemas

| Tipo página | # | Breadcrumbs | FAQ | Service | Product | Especial |
|-------------|---|-------------|-----|---------|---------|----------|
| Home | 1 | ✓ | ✓ | — | — | — |
| Idiomas | 10 | ✓ | ✓ | ✓ | ✓ (precios dinámicos) | — |
| Ciudades | 50 | ✓ | — | ✓* | — | ProfessionalService inline |
| Documentos | 9 | ✓ (3 niveles) | ✓ | ✓ | ✓ | — |
| Documentos hub | 1 | ✓ | — | — | — | — |
| Blog posts | 10 | ✓ (3 niveles) | — | — | — | Article inline |
| Proceso | 1 | ✓ | — | — | — | HowTo |
| Traductores | 1 | ✓ | — | — | — | Person |

## Metadata — patrón estándar

Todas las páginas públicas deben tener:
```tsx
export const metadata: Metadata = {
  title: "Título | traduccionesjuradas.net",
  description: "Descripción para SERP",
  alternates: {
    canonical: "https://www.traduccionesjuradas.net/ruta"
  },
  openGraph: {
    images: [{ url: "/api/og?title=...&subtitle=...", width: 1200, height: 630 }]
  }
}
```

### Root layout (layout.tsx)
```
metadataBase: https://www.traduccionesjuradas.net
Title template: "%s | traduccionesjuradas.net"
OpenGraph: locale es_ES, siteName TraduccionesJuradas.net
Twitter: summary_large_image
+ ProfessionalService schema inline (datos empresa)
```

## OG Images dinámicas
- Endpoint: `/api/og?title={title}&subtitle={subtitle}`
- Formato: 1200×630 PNG
- Usadas en: idiomas, blog, documentos, proceso
- Fallback: `opengraph-image.png` en root

## SchemaProduct — precios dinámicos (idiomas)
```tsx
<SchemaProduct
  name="Traducción jurada de francés"
  offers={[
    { name: "~300 palabras", price: rate * 300 * 1.1 },
    { name: "~800 palabras", price: rate * 800 * 1.1 },
    { name: "~2000 palabras", price: rate * 2000 * 1.1 },
  ]}
/>
```
Precios calculados desde `getWordRateForLangOrPair(lang)` × 1.1 (IVA).

## Blog Article — schema inline
```tsx
const articleSchema = {
  "@type": "Article",
  headline: post.title,
  author: { "@type": "Person", name: "Juan Silva Moreno" },
  publisher: { "@type": "Organization", name: "TraduccionesJuradas.net" },
  datePublished: post.date,
  image: `/api/og?title=${encodeURIComponent(post.title)}&subtitle=Blog`
}
```

## Headers noindex (next.config.mjs)
Rutas privadas con `X-Robots-Tag: noindex`:
- `/area-cliente`, `/zona-traductor`, `/admin`, `/acceso`, `/q`, `/pedido`

## Imports
```tsx
import { SchemaBreadcrumbs } from "@/components/SchemaBreadcrumbs"
import { SchemaFAQ } from "@/components/SchemaFAQ"
import { SchemaService } from "@/components/SchemaService"
import { SchemaProduct } from "@/components/SchemaProduct"
```

## Trailing slash
- `skipTrailingSlashRedirect` **eliminado** (marzo 2026) — Next.js redirige `/page/` → `/page` (308)
- **Canonicals siempre sin trailing slash** — alineados con el redirect automático
- **NO añadir redirects que agreguen trailing slash** → crea loops con el comportamiento por defecto
- Client components (`"use client"`) no pueden exportar metadata → usar `layout.tsx` del directorio (ej: `/contacto`)

## Middleware: legacy URLs
- `?route=` query params en cualquier path → 301 al path limpio (strip params)
- `?route=` en root/index.php → 410 Gone
- `?action=` → 404
- WordPress endpoints (wp-json, wp-admin, wp-login, xmlrpc, wp-content/plugins) → 410 Gone
- `/traductor-jurado-{ciudad}` (formato WP) → middleware redirige a `/traductor-jurado/{slug}` o `/`
- `VALID_LEGACY_PATHS` en middleware protege páginas de idiomas y documentos del catch-all redirect

## Sitemap
- `app/sitemap.ts` — generado dinámicamente, 95 URLs
- Incluye: estáticas (LAST_MODIFIED), blog (posts Velite), ciudades (CIUDADES)
- Prioridades: 1.0 home, 0.9 servicios, 0.8 idiomas/documentos, 0.7 blog/info, 0.3 legal
- Actualizar `LAST_MODIFIED` manualmente cuando se modifique contenido

## Internal linking (desplegado 25 marzo 2026)
- **Blog**: posts relacionados (hasta 3) al final de cada artículo, ordenados por categoría coincidente + fecha
- **Home**: sección "Guías y recursos" con 4 posts destacados + enlace a /blog
- **Ciudades** (`/traductor-jurado/[ciudad]`): sección "Idiomas disponibles" con pills a las 10 páginas de idioma
- **Idiomas** (`PaginaIdioma.tsx`): sección "Ciudades principales" con pills a 6 ciudades (madrid, barcelona, valencia, sevilla, malaga, bilbao)
- **Documentos oficiales** (9 páginas): secciones de info práctica con enlaces internos a páginas relacionadas y blog
- **Breadcrumbs documentos**: URLs corregidas a `www.traduccionesjuradas.net` (antes sin www)

## Schema global (layout.tsx)
- `ProfessionalService` (Organization) con `aggregateRating`: 5.0 / 19 reseñas — **actualizar ratingCount cuando haya más reseñas**
- `WebSite` con `SearchAction` apuntando a `/blog?q={search_term_string}`

## Reglas
- Toda página pública **debe** tener `canonical` y `SchemaBreadcrumbs`
- Páginas con precios **deben** tener `SchemaProduct`
- No añadir schemas que no apliquen — Google penaliza markup irrelevante
- Los precios en schemas deben coincidir con los mostrados en UI
- **AggregateRating**: actualizar `ratingCount` en layout.tsx cuando haya nuevas reseñas en Google
