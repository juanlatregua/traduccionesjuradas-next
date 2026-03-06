# Análisis completo — traduccionesjuradas.net

> Generado: 2026-03-06
> Dominio: `https://www.traduccionesjuradas.net`
> Repo: `traduccionesjuradas-next`

---

## 1. Stack técnico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Framework | Next.js (App Router) | 14.2.35 |
| UI | React | 18.3.1 |
| Lenguaje | TypeScript (strict) | 5.5.4 |
| Estilos | TailwindCSS + PostCSS | 3.4.10 |
| Base de datos | PostgreSQL (Prisma Cloud) | — |
| ORM | Prisma | 6.16.3 |
| Auth | NextAuth (Google OAuth, JWT) | 4.24.13 |
| CMS/Blog | Velite + MDX | 0.3.1 |
| IA | Anthropic Claude SDK | 0.78.0 |
| Pagos | Stripe, Redsys, PayPal | — |
| Email | SendGrid + Nodemailer | 8.1.6 / 7.0.12 |
| Almacenamiento | Vercel Blob | 2.2.0 |
| PDF | jsPDF + pdf-parse | 4.2.0 / 1.1.1 |
| DOCX | Mammoth | 1.11.0 |
| Iconos | Lucide React | 0.555.0 |
| Deploy | Vercel | — |
| Tests | Node.js test runner nativo | — |
| CI | Lighthouse CI | — |

**Fuentes tipográficas:** Inter (sans) + Merriweather (serif), cargadas via `next/font/google`.

**Scripts de build:**
- `dev` — `next dev`
- `build` — `prisma generate && next build`
- `build:vercel` — `prisma generate && prisma-deploy-safe.mjs && next build`
- `test` — `node --test --experimental-strip-types tests/**/*.test.ts`

---

## 2. Estructura de rutas y páginas

### 2.1 Páginas públicas (SEO)

| Ruta | Descripción |
|------|-------------|
| `/` | Home — estimador de presupuesto instantáneo |
| `/presupuesto-instantaneo` | Herramienta IA de presupuesto con subida de documentos |
| `/precios-traduccion-jurada` | Tabla de precios por idioma y documento |
| `/proceso` | Cómo funciona el servicio |
| `/traductores-jurados` | Equipo de traductores |
| `/acreditacion` | Credenciales y acreditación oficial |
| `/contacto` | Formulario de contacto |
| `/preguntas-frecuentes` | FAQ |
| `/traduccion-jurada-online` | Landing — traducción jurada online |
| `/traducciones-juradas-baratas` | Landing — precio económico |
| `/traduccion-jurada-frances-malaga` | Landing local — francés en Málaga |
| `/marruecos` | Landing — documentos marroquíes |
| `/teletrabajo` | Página de teletrabajo |

### 2.2 Documentos oficiales (`/documentos-oficiales/`)

| Ruta | Categoría |
|------|-----------|
| `/documentos-oficiales` | Índice general |
| `/documentos-oficiales/certificados-registro-civil` | Registro civil |
| `/documentos-oficiales/certificado-de-nacimiento` | Nacimiento |
| `/documentos-oficiales/certificado-de-matrimonio` | Matrimonio |
| `/documentos-oficiales/antecedentes-penales` | Antecedentes penales |
| `/documentos-oficiales/documentos-academicos` | Académicos |
| `/documentos-oficiales/documentos-laborales` | Laborales |
| `/documentos-oficiales/documentos-juridicos` | Jurídicos |
| `/documentos-oficiales/documentos-mercantiles` | Mercantiles |
| `/documentos-oficiales/apostilla-haya` | Apostilla de la Haya |

### 2.3 Pilares de idioma (`/traductor-jurado-{idioma}/`)

| Ruta | Idioma |
|------|--------|
| `/traductor-jurado-frances` | Francés |
| `/traductor-jurado-ingles` | Inglés |
| `/traductor-jurado-aleman` | Alemán |
| `/traductor-jurado-portugues` | Portugués |
| `/traductor-jurado-italiano` | Italiano |
| `/traductor-jurado-neerlandes` | Neerlandés |
| `/traductor-jurado-catalan` | Catalán |
| `/traductor-jurado-rumano` | Rumano |
| `/traductor-jurado-sueco` | Sueco |
| `/traductor-jurado-noruego` | Noruego |

Todas usan el componente compartido `PaginaIdioma.tsx` con `SchemaProduct` + `aggregateRating` + reviews reales.

### 2.4 Blog (`/blog/`)

| Slug | Artículo |
|------|----------|
| `/blog` | Índice del blog |
| `/blog/documentos-marroquies-guia-completa` | Guía documentos marroquíes |
| `/blog/homologacion-titulo-universitario` | Homologación título universitario |
| `/blog/nacionalidad-espanola-documentos` | Nacionalidad española: documentos |
| `/blog/que-es-un-traductor-jurado` | ¿Qué es un traductor jurado? |
| `/blog/reagrupacion-familiar-documentos` | Reagrupación familiar: documentos |
| `/blog/traduccion-jurada-online-es-legal` | ¿Es legal la traducción jurada online? |

Sistema: Velite + MDX con categorías (`tramites`, `paises`, `faq`, `profesion`), flag `published`, y generación automática de slugs.

### 2.5 Funnel de pedido (grupo `(funnel)/`)

| Ruta | Paso |
|------|------|
| `/start` | Inicio del pedido |
| `/upload` | Subida de documentos |
| `/review` | Revisión del análisis IA |
| `/checkout` | Pago |
| `/confirmation` | Confirmación |

### 2.6 Áreas privadas

| Ruta | Área |
|------|------|
| `/acceso` | Login |
| `/admin/quotes/` | Gestión de presupuestos (admin) |
| `/admin/quotes/[id]/` | Editor de presupuesto |
| `/admin/quotes/new` | Crear presupuesto manual |
| `/zona-traductor/` | Dashboard traductor |
| `/zona-traductor/verificar` | Verificación OTP |
| `/area-cliente/` | Área cliente |
| `/area-cliente/pedido/[reference]/` | Seguimiento de pedido |
| `/area-cliente/pedido/[reference]/pagar/` | Pago de pedido |

### 2.7 Utilidades

| Ruta | Función |
|------|---------|
| `/consulta` | Consultar estado de pedido |
| `/consulta-pedido` | Verificar estado de pago |
| `/pedido-recibido` | Confirmación de pedido recibido |
| `/q/[token]` | Acceso público a presupuesto vía token |
| `/pago/exito` | Resultado de pago exitoso |
| `/pago/cancelado` | Resultado de pago cancelado |
| `/documentos` | Página auxiliar de documentos |
| `/presupuesto` | Redirige a `/presupuesto-instantaneo` |

### 2.8 Páginas legales

| Ruta | Contenido |
|------|-----------|
| `/aviso-legal` | Aviso legal |
| `/privacidad` | Política de privacidad |
| `/politica-de-cookies` | Política de cookies |

### 2.9 API Routes (68 endpoints)

- `/api/auth/[...nextauth]/` — Autenticación
- `/api/documents/analyze/` — Análisis IA de documentos
- `/api/documents/upload/` — Subida a Vercel Blob
- `/api/documents/quote/` — Generación de presupuesto
- `/api/documents/payment/` — Procesamiento de pagos
- `/api/orders/*` — CRUD de pedidos (~14 rutas)
- `/api/payment/*` — Pasarelas (Stripe, Redsys, PayPal)
- `/api/quotes/*` — Gestión de presupuestos (~10 rutas)
- `/api/session/*` — Sesiones del funnel
- `/api/chat/` — Chat IA con Claude
- `/api/cron/*` — Tareas programadas
- `/api/presupuesto/` — Endpoint de presupuesto
- `/api/og` — Generación dinámica de imágenes OG

---

## 3. Sistema de SEO actual

### 3.1 Metadata base (`app/layout.tsx`)

```ts
metadataBase: new URL("https://www.traduccionesjuradas.net")
title: {
  default: "Traducciones juradas oficiales online | traduccionesjuradas.net",
  template: "%s | traduccionesjuradas.net",
}
```

- OpenGraph configurado con imagen `/opengraph-image.png` (1200x630)
- Twitter Card: `summary_large_image`
- Locale: `es_ES`
- Cada página define su propio `metadata` con título, descripción y canonical

### 3.2 Datos estructurados (Schema.org)

| Schema | Ubicación | Estado |
|--------|-----------|--------|
| `ProfessionalService` | `app/layout.tsx` (global) | OK |
| `Product` + `aggregateRating` + `Review` | `components/SchemaProduct.tsx` (idiomas y docs) | OK |
| `FAQPage` | Home (`app/page.tsx`) | OK |
| `Article` | Blog posts (`app/blog/[slug]/page.tsx`) | OK |

### 3.3 Sitemap (`app/sitemap.ts`)

Generación dinámica con 37 rutas estáticas + posts del blog publicados.

**Prioridades:**
| Tipo | Prioridad |
|------|-----------|
| Home | 1.0 |
| Servicio principal (presupuesto, precios, docs) | 0.9 |
| Documentos e idiomas | 0.8 |
| Blog, info, FAQ | 0.7 |
| Legal | 0.3 |

**Frecuencia de cambio:**
- Home, presupuesto, precios → `weekly`
- Legal → `yearly`
- Resto → `monthly`

### 3.4 Robots (`app/robots.ts`)

```
User-agent: *
Allow: /
Disallow: /area-cliente/
Disallow: /zona-traductor/
Disallow: /admin/
Disallow: /acceso
Disallow: /q/
Sitemap: https://www.traduccionesjuradas.net/sitemap.xml
```

### 3.5 Headers noindex (`next.config.mjs`)

Cabecera `X-Robots-Tag: noindex, nofollow` en:
- `/area-cliente/:path*`
- `/zona-traductor/:path*`
- `/admin/:path*`
- `/acceso`
- `/q/:path*`

### 3.6 Redirecciones de dominio

- `http://` → `https://` (301)
- `traduccionesjuradas.net` → `www.traduccionesjuradas.net` (301)

---

## 4. Páginas de ciudades/provincias existentes

### Estado actual: NO HAY PÁGINAS DE CIUDAD

La estrategia anterior de WordPress (100+ páginas `/traductor-jurado-{ciudad}/`) fue **eliminada**. Todas redirigen ahora a `/documentos-oficiales` o a `/`.

**Única excepción local:** `/traduccion-jurada-frances-malaga` (landing específica francés + Málaga).

**Ciudades con redirect explícito en `next.config.mjs`:**

| Ciudad | Redirect → |
|--------|-----------|
| Madrid | `/documentos-oficiales` |
| Barcelona | `/documentos-oficiales` |
| Sevilla | `/documentos-oficiales` |
| Zaragoza | `/documentos-oficiales` |
| Pontevedra | `/documentos-oficiales` |
| Fuerteventura | `/documentos-oficiales` |
| Denia | `/documentos-oficiales` |
| Badalona | `/documentos-oficiales` |
| Cuenca | `/documentos-oficiales` |
| Jerez | `/documentos-oficiales` |
| Torrelodones | `/documentos-oficiales` |
| Alcorcón | `/documentos-oficiales` |
| Alcobendas | `/documentos-oficiales` |
| Fuengirola | `/documentos-oficiales` |
| Getafe | `/documentos-oficiales` |
| Moralzarzal | `/documentos-oficiales` |
| Pamplona | `/documentos-oficiales` |
| Palma de Mallorca | `/documentos-oficiales` |
| Calpe | `/documentos-oficiales` |
| Teruel | `/documentos-oficiales` |
| Tenerife | `/documentos-oficiales` |
| Gran Canaria | `/documentos-oficiales` |
| Puerto de la Cruz | `/documentos-oficiales` |
| Altea | `/documentos-oficiales` |
| Guadalajara | `/documentos-oficiales` |

**Catch-all en middleware:** cualquier URL que empiece por `/traductor-jurado-` y no esté en la allowlist de idiomas → redirect 301 a `/`.

---

## 5. Estado de los redirects desde URLs legacy de WordPress

### 5.1 Resumen

| Tipo | Cantidad | Mecanismo |
|------|----------|-----------|
| Documentos WP → `/documentos-oficiales/*` | ~30 | `next.config.mjs` redirects |
| Ciudades WP → `/documentos-oficiales` | ~25 | `next.config.mjs` redirects |
| Categorías WooCommerce → docs/home | ~10 | `next.config.mjs` redirects |
| Páginas antiguas (inicio, agencia, envios...) | ~15 | `next.config.mjs` redirects |
| Legal (privacidad, aviso legal) | ~4 | `next.config.mjs` redirects |
| Presupuesto/carrito | ~6 | `next.config.mjs` redirects |
| Idiomas sin soporte (griego, persa) | 2 | `next.config.mjs` → `/traductores-jurados` |
| Catch-all francés legacy | 1 | `next.config.mjs` + `middleware.ts` |
| Dominio HTTP/non-www | 2 | `next.config.mjs` |
| **Total redirects en config** | **~95 reglas** | **301 permanent** |

### 5.2 Middleware (`middleware.ts`)

| Patrón | Respuesta |
|--------|-----------|
| `/wp-json/*` | 410 Gone |
| `/wp-admin/*` | 410 Gone |
| `/wp-login.php` | 410 Gone |
| `/xmlrpc.php` | 410 Gone |
| `/wp-content/plugins/*/endpoint.php` | 410 Gone |
| `*/feed` | 410 Gone |
| `/?route=*` (WP legacy query) | 410 Gone |
| `/inicio/*` | 301 → `/` |
| `/agencia/*` | 301 → `/` |
| `/contacto/page/N` | 301 → `/contacto` |
| `/traductor-jurado-*` (no en allowlist) | 301 → `/` |
| `/traduccion-jurada-*` (no en allowlist) | 301 → `/` |
| `/traductor-*` (no en allowlist) | 301 → `/` |
| `/traducciones-*` (no en allowlist) | 301 → `/` |
| `/categoria-producto/*` | 301 → `/` |
| URL con "frances" (no es pillar) | 301 → `/traductor-jurado-frances` |

### 5.3 Allowlist de middleware (URLs que NO se redirigen)

```
/traductor-jurado-frances
/traductor-jurado-ingles
/traductor-jurado-aleman
/traductor-jurado-portugues
/traductor-jurado-italiano
/traductor-jurado-neerlandes
/traductor-jurado-catalan
/traductor-jurado-sueco
/traductor-jurado-noruego
/traduccion-jurada-online
/traduccion-jurada-frances-malaga
/traducciones-juradas-baratas
/traductores-jurados
```

---

## 6. Pendientes y problemas detectados

### 6.1 Seguridad

| Prioridad | Problema | Archivo |
|-----------|----------|---------|
| **ALTA** | Acceso público a pedidos solo por referencia (sin token firmado) | `app/api/orders/[reference]/public/route.ts:49` |

TODO textual en el código:
```ts
// TODO: Requerir token firmado por pedido para evitar acceso público solo por referencia.
```

### 6.2 SEO — Oportunidades

| Item | Estado | Nota |
|------|--------|------|
| Páginas de ciudad | Eliminadas | Oportunidad perdida de local SEO. Solo queda `/traduccion-jurada-frances-malaga` |
| Blog | 6 artículos | Infraestructura lista pero infrautilizada. Sistema de categorías definido |
| Hreflang | No implementado | Solo locale `es_ES`, sin versiones en otros idiomas |
| Breadcrumbs schema | No encontrado | No hay BreadcrumbList schema markup |
| Sitemap lastModified | Usa `new Date()` | Siempre marca la fecha actual en vez de la real de modificación |

### 6.3 Duplicación en redirects

Hay reglas duplicadas entre `next.config.mjs` y `middleware.ts`:
- `/inicio` y `/agencia` están en ambos
- `/contacto/page/N` está en ambos
- Catch-all de francés está en ambos
- `/categoria-producto/*` está en ambos

No es un bug (Next.js procesa `next.config.mjs` primero, middleware actúa como fallback), pero añade complejidad de mantenimiento.

### 6.4 Funcionalidades parciales o en evolución

| Item | Estado |
|------|--------|
| Análisis IA de documentos | Funcional, con reglas complejas de conteo de palabras/tablas en evolución |
| Motor de precios | Funcional, con tarifas base por idioma (0.08-0.14 €/palabra) |
| Sistema de quotes (presupuestos manuales) | Completo (10+ modelos Prisma, email/WhatsApp, tokens públicos) |
| Chat IA (Claude) | Funcional, con memoria de conversación y cleanup automático |
| Idempotencia de pagos | Implementada (Stripe webhooks, Redsys, PayPal) |
| Rate limiting | Custom token-bucket con cleanup semanal |

### 6.5 Cron jobs

| Job | Horario | Ruta |
|-----|---------|------|
| Recordatorios de presupuesto | Diario 9:00 | `/api/quotes/reminders` |
| Limpieza de chats | Domingos 3:00 | `/api/cron/chat-cleanup` |
| Limpieza de documentos (30 días) | Domingos 4:00 | `/api/cron/document-cleanup` |

### 6.6 Tests

17 archivos de test (unit + e2e) usando el test runner nativo de Node.js con `--experimental-strip-types`.

### 6.7 Otras observaciones

- **Trailing slash:** `skipTrailingSlashRedirect: true` en `next.config.mjs`. Muchos redirects se definen con y sin trailing slash como reglas separadas (verbose pero funcional).
- **Rumano** no está en la allowlist del middleware (`VALID_LEGACY_PATHS`) pero tiene página en `/traductor-jurado-rumano/`. Podría ser interceptado por el catch-all del middleware si se accede como `/traductor-jurado-rumano` (sin trailing slash funciona porque el middleware normaliza quitando trailing slashes, y `traductor-jurado-rumano` no empieza por los prefijos catch-all). **Verificar que funciona correctamente.**
- **`/documentos/page.tsx`** existe como página separada de `/documentos-oficiales/page.tsx` — posible vestigio.
- **`/presupuesto/page.tsx`** existe como página cuando también hay un redirect de `/presupuesto` → `/presupuesto-instantaneo` — el redirect en config tiene prioridad, por lo que la página nunca se sirve.

---

## Resumen ejecutivo

**traduccionesjuradas.net** es una plataforma SaaS madura para traducciones juradas online. Migrada desde WordPress/WooCommerce a Next.js 14 con App Router. Incluye análisis de documentos con IA (Claude), triple pasarela de pago (Stripe/Redsys/PayPal), sistema de presupuestos manuales, dashboards para admin/traductor/cliente, y blog MDX.

La migración SEO está bien cubierta con ~95 redirects 301 y respuestas 410 para endpoints WP. Los datos estructurados (ProfessionalService, Product con reviews, FAQ, Article) están implementados. Las principales oportunidades pendientes son: local SEO (ciudades eliminadas), crecimiento del blog, y un fix de seguridad en el endpoint público de pedidos.
