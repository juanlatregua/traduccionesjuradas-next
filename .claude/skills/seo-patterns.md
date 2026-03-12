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

## Reglas
- Toda página pública **debe** tener `canonical` y `SchemaBreadcrumbs`
- Páginas con precios **deben** tener `SchemaProduct`
- No añadir schemas que no apliquen — Google penaliza markup irrelevante
- Los precios en schemas deben coincidir con los mostrados en UI
