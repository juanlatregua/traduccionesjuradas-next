# CLAUDE.md — traduccionesjuradas-next

## Qué es este proyecto

Web comercial + plataforma de gestión de pedidos de **traducción jurada** (francés ↔ español como idioma principal, 10 idiomas en total). Negocio real de HBTJ Consultores Lingüísticos S.L., con sede en Málaga.

**URL producción:** https://www.traduccionesjuradas.net
**Deploy:** Vercel (auto-deploy desde `main`)

## Stack técnico

- **Framework:** Next.js 14.2.35 (App Router) + TypeScript 5.5.4
- **Estilos:** TailwindCSS 3.4.10 con paleta personalizada (bleu, encre, sepia, cream, parchment)
- **Base de datos:** Prisma 6.16.3 + PostgreSQL (Prisma Postgres en Vercel)
- **Blog:** Velite 0.3.1 + MDX (`content/blog/*.mdx`) — 4 categorías: tramites, paises, faq, profesion
- **Auth:** NextAuth 4.24.13 (Google OAuth) — acceso staff controlado por `STAFF_EMAILS`
- **Pagos:** Stripe 20.3.1 (principal), Redsys (redsys-easy 5.3.2), Bizum, transferencia. PayPal desactivado.
- **Email:** SendGrid (@sendgrid/mail 8.1.6)
- **SMS/WhatsApp:** Twilio (fire-and-forget con logs)
- **AI:** Anthropic Claude (@anthropic-ai/sdk 0.78.0, modelo claude-sonnet-4-20250514) — análisis documentos + chat
- **Almacenamiento:** Vercel Blob (@vercel/blob 2.2.0)
- **PDF:** jspdf 4.2.0, pdf-parse 1.1.1, mammoth 1.11.0

## Comandos esenciales

```bash
npm run dev           # desarrollo local
npm run build         # prisma generate + next build
npm run test:unit     # tests unitarios (node --test)
npm run test:e2e      # tests e2e
npx tsc --noEmit --skipLibCheck  # type-check (hay errores preexistentes de Prisma/Velite/Anthropic que se ignoran)
vercel --prod --yes   # deploy manual a producción
```

## Estructura del proyecto

```
app/
├── page.tsx                          # Home
├── traductor-jurado-{idioma}/        # 10 páginas de idioma (usan PaginaIdioma component)
├── traductor-jurado/[ciudad]/        # 50 páginas de ciudad (SEO local)
├── documentos-oficiales/             # Hub + 9 subpáginas de tipos de documento
├── blog/                             # Listado + [slug] dinámico desde Velite (10 artículos)
├── presupuesto-instantaneo/          # Formulario público principal (CTA)
├── (funnel)/                         # Flujo: start → upload → review → checkout → confirmation
├── area-cliente/                     # Zona cliente (pedido/[reference]/pagar)
├── admin/                            # Panel staff (quotes, gestión)
├── api/                              # ~45 endpoints REST
│   ├── orders/                       # CRUD pedidos + webhooks + finanzas
│   ├── payment/                      # Stripe, Redsys, PayPal
│   ├── documents/                    # Upload + análisis IA
│   ├── quotes/                       # Presupuestos formales
│   ├── session/                      # Funnel de pedido
│   └── cron/                         # Limpieza chat/documentos
├── contacto/, proceso/, acreditacion/, teletrabajo/, marruecos/
├── q/[token]/                        # Acceso público presupuesto
├── zona-traductor/                   # Panel traductor (OTP)
└── pago/{exito,cancelado}/           # Post-pago
components/
├── PaginaIdioma.tsx                  # Componente compartido para las 10 páginas de idioma
├── Schema*.tsx                       # JSON-LD: BreadcrumbList, FAQPage, Product, Service, LocalBusiness, HowTo, Person
├── ia/                               # DocumentUploader, LeadGate, análisis IA
└── blog/                             # MDXContent
lib/
├── order-token.ts                    # HMAC-SHA256 para firmar URLs de pedidos
├── sms.ts + sms-templates.ts         # Twilio abstraction
├── email.ts                          # SendGrid (16 tipos de email)
├── pricing.ts                        # Tarifas por idioma/par
├── stripe.ts, redsys.ts, paypal.ts  # Payment gateways
├── workflow.ts + workflow-server.ts   # Estado operativo de pedidos
├── rate-limit.ts                     # Rate limiting por IP
└── ai/                               # Prompts y análisis con Claude
src/data/
└── ciudades.ts                       # 50 ciudades para SEO local
```

## Seguridad — URLs de pedidos

Las URLs públicas de pedidos llevan un **token HMAC-SHA256** firmado con `ORDER_TOKEN_SECRET`:
- `lib/order-token.ts`: `generateOrderToken()`, `verifyOrderToken()`, `buildSignedOrderUrl()`
- Verificado en `app/api/orders/[reference]/public/route.ts` (línea 53)
- Si `ORDER_TOKEN_SECRET` no está configurado, `verifyOrderToken` devuelve `false` (sin bypass)
- Rate limit: 120 req/10min por IP
- Comparación timing-safe contra timing attacks

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
- **Ciudades:** SchemaService + SchemaLocalBusiness

## Middleware y redirects

- `middleware.ts`: gestiona rutas legacy de WordPress (allowlist en `VALID_LEGACY_PATHS`), bloquea `?action=` con 404, 410 para endpoints WP (wp-json, wp-login, xmlrpc, feeds genéricos)
- `next.config.mjs`: 100+ redirects 301 para rutas antiguas (/inicio, /agencia, /documentos, /palabra, /mapa-del-sitio, /feed, /wp-admin/admin-ajax.php, etc.)
- No duplicar reglas entre ambos
- Ciudades legacy (`/traductor-jurado-madrid`) → redirigen a `/traductor-jurado/madrid` via middleware

## Variables de entorno

Documentadas en `.env.example` (~80 variables). Las críticas:
- `DATABASE_URL`, `NEXTAUTH_SECRET`, `ORDER_TOKEN_SECRET`
- `SENDGRID_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`, `CRON_SECRET`

Ver `PROYECTO.md` para listado completo por categoría.

## Convenciones

- **Idioma del código:** TypeScript en inglés, contenido/UI en español
- **Commits:** estilo convencional (`fix:`, `feat:`, `fix(seo):`)
- **No sobreingeniería:** solo lo pedido, sin añadir docstrings/comments innecesarios
- **Imports schema:** `import { SchemaX } from "@/components/SchemaX"`
- **SMS:** fire-and-forget con `.catch(console.error)`, nunca bloquea la respuesta
- **Pagos:** todos los endpoints públicos de pago validan estado del pedido + rate limit por IP
- **Blog:** frontmatter con title, description, date, category (enum), published, keywords
- **Zsh:** al hacer `git add` de rutas con brackets, usar comillas: `git add "app/api/orders/[reference]/route.ts"`
- **Deploy manual:** `vercel --prod --yes` desde la raíz del proyecto
- **Documentación del proyecto:** `PROYECTO.md` (estado completo) y `EJECUTAR.md` (pendientes)

## Errores preexistentes en tsc

Estos errores aparecen siempre en `tsc --noEmit` y NO son problemas reales:
- `@prisma/client` types → ejecutar `prisma generate` para resolverlos
- `@anthropic-ai/sdk` module not found → types no instalados localmente
- `@/content` module not found → generado por Velite en build
