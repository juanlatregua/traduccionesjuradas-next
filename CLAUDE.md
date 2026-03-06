# CLAUDE.md — traduccionesjuradas-next

## Qué es este proyecto

Web comercial + plataforma de gestión de pedidos de **traducción jurada** (francés ↔ español como idioma principal, 10 idiomas en total). Negocio real de HBTJ Consultores Lingüísticos S.L., con sede en Málaga.

**URL producción:** https://www.traduccionesjuradas.net
**Deploy:** Vercel (auto-deploy desde `main`)

## Stack técnico

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Estilos:** TailwindCSS con paleta personalizada (bleu, encre, sepia, cream, parchment)
- **Base de datos:** Prisma + PostgreSQL (Prisma Postgres en Vercel)
- **Blog:** Velite + MDX (`content/blog/*.mdx`) — 4 categorías: tramites, paises, faq, profesion
- **Auth:** NextAuth (Google OAuth) — acceso staff controlado por `STAFF_EMAILS`
- **Pagos:** Stripe (principal), Redsys, Bizum, transferencia. PayPal desactivado.
- **Email:** SendGrid
- **SMS/WhatsApp:** Twilio (fire-and-forget con logs)
- **AI:** Anthropic Claude (análisis documentos + chat), Google Vision, OCR.space
- **Almacenamiento:** Vercel Blob

## Comandos esenciales

```bash
npm run dev           # desarrollo local
npm run build         # prisma generate + next build
npm run test:unit     # tests unitarios (node --test)
npm run test:e2e      # tests e2e
npx tsc --noEmit --skipLibCheck  # type-check (hay errores preexistentes de Prisma/Velite/Anthropic que se ignoran)
```

## Estructura del proyecto

```
app/
├── page.tsx                          # Home
├── traductor-jurado-{idioma}/        # 10 páginas de idioma (usan PaginaIdioma component)
├── documentos-oficiales/             # Hub + 9 subpáginas de tipos de documento
├── blog/                             # Listado + [slug] dinámico desde Velite
├── presupuesto-instantaneo/          # Formulario público principal (CTA)
├── (funnel)/                         # Flujo: start → upload → review → checkout → confirmation
├── area-cliente/                     # Zona cliente (pedido/[reference]/pagar)
├── admin/                            # Panel staff (quotes, gestión)
├── api/                              # ~40 endpoints REST
│   ├── orders/                       # CRUD pedidos + webhooks
│   ├── payment/                      # Stripe, Redsys, PayPal
│   ├── documents/                    # Upload + análisis IA
│   ├── quotes/                       # Presupuestos formales
│   └── cron/                         # Limpieza chat/documentos
├── contacto/, proceso/, acreditacion/, teletrabajo/, marruecos/
└── pago/{exito,cancelado}/           # Post-pago
components/
├── PaginaIdioma.tsx                  # Componente compartido para las 10 páginas de idioma
├── Schema*.tsx                       # JSON-LD: BreadcrumbList, FAQPage, Product, Service, LocalBusiness, HowTo, Person
├── ia/                               # DocumentUploader, LeadGate, análisis IA
└── blog/                             # MDXContent
lib/
├── order-token.ts                    # HMAC-SHA256 para firmar URLs de pedidos
├── sms.ts + sms-templates.ts         # Twilio abstraction
├── email.ts                          # SendGrid templates
├── pricing.ts                        # Tarifas por idioma/par
├── stripe.ts, redsys.ts             # Payment gateways
├── workflow.ts + workflow-server.ts   # Estado operativo de pedidos
└── ai/                               # Prompts y análisis con Claude
```

## Seguridad — URLs de pedidos

Las URLs públicas de pedidos llevan un **token HMAC-SHA256** firmado con `ORDER_TOKEN_SECRET`:
- `lib/order-token.ts`: `generateOrderToken()`, `verifyOrderToken()`, `buildSignedOrderUrl()`
- Verificado en `app/api/orders/[reference]/public/route.ts`
- Generado en todos los endpoints que crean URLs de pago/detalle (~9 server files + 3 client components)

## SEO y Schema JSON-LD

Cada página pública tiene:
- `metadata` con title, description y `alternates.canonical`
- `SchemaBreadcrumbs` (BreadcrumbList)
- OG image dinámica via `/api/og`

Schemas adicionales por tipo de página:
- **Home:** FAQPage, SchemaLocalBusiness (via layout)
- **Idiomas** (PaginaIdioma): SchemaService + SchemaProduct + SchemaFAQ
- **Documentos:** SchemaService + SchemaFAQ + SchemaProduct (en las que tienen precios)
- **Blog articles:** Schema Article con image, author, publisher
- **Proceso:** SchemaHowTo
- **Traductores:** SchemaPerson

## Middleware y redirects

- `middleware.ts`: gestiona rutas legacy de WordPress (allowlist en `VALID_LEGACY_PATHS`)
- `next.config.mjs`: redirects 301 para rutas antiguas (/inicio, /agencia, /documentos, etc.)
- No duplicar reglas entre ambos

## Variables de entorno

Documentadas en `.env.example` (~45 variables). Las críticas:
- `DATABASE_URL`, `NEXTAUTH_SECRET`, `ORDER_TOKEN_SECRET`
- `SENDGRID_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`, `CRON_SECRET`

## Convenciones

- **Idioma del código:** TypeScript en inglés, contenido/UI en español
- **Commits:** estilo convencional (`fix:`, `feat:`, `fix(seo):`)
- **No sobreingeniería:** solo lo pedido, sin añadir docstrings/comments innecesarios
- **Imports schema:** `import { SchemaX } from "@/components/SchemaX"`
- **SMS:** fire-and-forget con `.catch(console.error)`, nunca bloquea la respuesta
- **Pagos:** todos los endpoints públicos de pago validan estado del pedido + rate limit por IP
- **Blog:** frontmatter con title, description, date, category (enum), published, keywords
- **Zsh:** al hacer `git add` de rutas con brackets, usar comillas: `git add "app/api/orders/[reference]/route.ts"`

## Errores preexistentes en tsc

Estos errores aparecen siempre en `tsc --noEmit` y NO son problemas reales:
- `@prisma/client` types → ejecutar `prisma generate` para resolverlos
- `@anthropic-ai/sdk` module not found → types no instalados localmente
- `@/content` module not found → generado por Velite en build
