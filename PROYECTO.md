# PROYECTO — traduccionesjuradas-next

> Estado real del proyecto a 2026-03-08

## 1. Stack técnico

| Componente | Versión |
|---|---|
| Next.js | 14.2.35 (App Router) |
| React | 18.3.1 |
| TypeScript | 5.5.4 |
| TailwindCSS | 3.4.10 |
| Prisma | 6.16.3 (+ @prisma/client 6.16.3) |
| NextAuth | 4.24.13 (Google OAuth) |
| Stripe | 20.3.1 |
| Redsys (redsys-easy) | 5.3.2 |
| @anthropic-ai/sdk | 0.78.0 (Claude Sonnet 4) |
| @sendgrid/mail | 8.1.6 |
| @vercel/blob | 2.2.0 |
| Velite (blog MDX) | 0.3.1 |
| jspdf | 4.2.0 |
| mammoth | 1.11.0 |
| pdf-parse | 1.1.1 |
| nodemailer | 7.0.12 (fallback) |
| lucide-react | 0.555.0 |
| ESLint | 8.57.0 |
| PostCSS | 8.4.38 |

**Deploy:** Vercel (auto-deploy desde `main`)
**URL:** https://www.traduccionesjuradas.net
**DB:** Prisma Postgres (Vercel)

---

## 2. Estructura de rutas

### Páginas públicas

| Ruta | Descripción |
|---|---|
| `/` | Home |
| `/presupuesto-instantaneo` | Formulario CTA principal |
| `/contacto` | Contacto |
| `/consulta` | Chat IA |
| `/consulta-pedido` | Consultar estado de pedido |
| `/proceso` | Cómo funciona |
| `/acreditacion` | Info acreditación traductores |
| `/teletrabajo` | Info teletrabajo |
| `/marruecos` | Landing Marruecos |
| `/precios-traduccion-jurada` | Tarifas |
| `/preguntas-frecuentes` | FAQ |
| `/traductores-jurados` | Equipo |
| `/traduccion-jurada-online` | Landing online |
| `/traduccion-jurada-frances-malaga` | Landing local Málaga |
| `/traducciones-juradas-baratas` | Landing low-cost |
| `/blog` | Listado blog |
| `/blog/[slug]` | Artículo (10 publicados) |
| `/aviso-legal` | Legal |
| `/privacidad` | Privacidad |
| `/politica-de-cookies` | Cookies |

### Páginas de idioma (10)

`/traductor-jurado-{frances,ingles,aleman,italiano,neerlandes,portugues,catalan,sueco,noruego,rumano}`

### Páginas de ciudad (50)

`/traductor-jurado/[ciudad]` — generadas desde `src/data/ciudades.ts`

### Documentos oficiales (10)

| Ruta | Documento |
|---|---|
| `/documentos-oficiales` | Hub |
| `/documentos-oficiales/certificado-de-nacimiento` | Nacimiento |
| `/documentos-oficiales/certificado-de-matrimonio` | Matrimonio |
| `/documentos-oficiales/certificados-registro-civil` | Registro civil |
| `/documentos-oficiales/antecedentes-penales` | Antecedentes |
| `/documentos-oficiales/documentos-academicos` | Académicos |
| `/documentos-oficiales/documentos-laborales` | Laborales |
| `/documentos-oficiales/documentos-mercantiles` | Mercantiles |
| `/documentos-oficiales/documentos-juridicos` | Jurídicos |
| `/documentos-oficiales/apostilla-haya` | Apostilla |

### Funnel de pedido

`/start` → `/upload` → `/review` → `/checkout` → `/confirmation`

### Área cliente

| Ruta | Descripción |
|---|---|
| `/area-cliente` | Login cliente |
| `/area-cliente/pedido/[reference]` | Detalle pedido |
| `/area-cliente/pedido/[reference]/pagar` | Pago pedido |
| `/pago/exito` | Post-pago OK |
| `/pago/cancelado` | Post-pago cancelado |
| `/pedido-recibido` | Confirmación recepción |

### Admin / Staff

| Ruta | Descripción |
|---|---|
| `/acceso` | Login staff |
| `/admin/quotes` | Gestión presupuestos |
| `/admin/quotes/[id]` | Detalle presupuesto |
| `/admin/quotes/new` | Nuevo presupuesto |
| `/zona-traductor` | Panel traductor |
| `/zona-traductor/verificar` | Verificar OTP traductor |
| `/q/[token]` | Acceso público presupuesto |

### API (~45 endpoints)

**Sesión (5):** `/api/session/{start,upload,proceed-checkout,purpose,add-another}`
**Pedidos (17):** `/api/orders`, `/api/orders/[reference]/{public,quote,workflow,delivery,documents,confirm-payment,assign,delete,archive,invoice,invoice-pdf,payment-proof}`, `/api/orders/{export,lookup,estimation-accuracy,pm-create}`
**Finanzas (5):** `/api/orders/[reference]/finance/{margin,margin-approval,close,reconciliation,supplier-invoice}`
**Pagos (10):** `/api/payment/{capabilities,create-intent,card,stripe,stripe/webhook,redsys,redsys/notification,paypal,paypal/capture,webhook}`
**Presupuestos (12):** `/api/quotes`, `/api/quotes/[id]/{finalize-send,email-preview,preview-pdf,resend,mark-in-progress,mark-delivered}`, `/api/quotes/public/[token]/checkout`, `/api/quotes/{reminders,stripe-webhook}`
**Documentos (7):** `/api/documents/{upload,analyze,quote,payment,lookup}`, `/api/documents/[id]/{status,contact}`
**IA (3):** `/api/presupuesto`, `/api/estimador`, `/api/chat`
**Otros (5):** `/api/upload`, `/api/leads/error`, `/api/traductor/{send-code,verify-code,notificar}`
**Cron (2):** `/api/cron/{chat-cleanup,document-cleanup}`
**Auth (1):** `/api/auth/[...nextauth]`
**OG (1):** `/api/og`

---

## 3. Modelos Prisma (17 modelos, 10 enums)

### Modelos principales

| Modelo | Descripción |
|---|---|
| **Order** | Pedido: reference, client, langPair, words, amount, status, payment, delivery |
| **OrderEvent** | Auditoría de pedido (type, message, payload JSON) |
| **OrderPaymentEvent** | Webhooks de pago (provider, idempotencyKey) |
| **BillingData** | Datos fiscales (NIF, dirección) — 1:1 con Order |
| **ShippingData** | Envío físico (dirección completa) — 1:1 con Order |
| **OrderSession** | Sesión funnel (step, purpose, amounts, payment) |
| **OrderDocument** | Documentos subidos en sesión |
| **DocumentAnalysis** | Análisis IA completo (Claude): tipo, idioma, palabras, complejidad, presupuesto |
| **Customer** | Cliente de presupuesto formal |
| **Quote** | Presupuesto formal: número, estado, líneas, PDF, token público |
| **QuoteLine** | Línea de presupuesto (descripción, cantidad, precio) |
| **QuotePayment** | Pago de presupuesto (Stripe) |
| **MessageLog** | Registro de emails/WhatsApp enviados |
| **AccessEvent** | Tracking apertura presupuesto |
| **StripeEventLog** | Webhooks Stripe de presupuestos |
| **ChatSession** | Sesión de chat IA |
| **RateLimitBucket** | Rate limiting por IP |

### Enums

| Enum | Valores |
|---|---|
| OrderStatus | PENDING_PAYMENT, PAID, IN_PROGRESS, DELIVERED, CANCELLED |
| PaymentStatus | PENDING, PAID, FAILED, REFUNDED |
| PaymentMethod | REDSYS, PAYPAL, BIZUM, TRANSFER, STRIPE |
| DeliveryState | PRESUPUESTO, EN_PROCESO, TRADUCIDO |
| QuoteStatus | DRAFT, SENT, OPENED, ACCEPTED, PAID, IN_PROGRESS, DELIVERED, EXPIRED |
| DocAnalysisStatus | UPLOADED, ANALYZING, ANALYZED, ANALYSIS_FAILED, QUOTE_GENERATED, PAYMENT_PENDING, PAID, IN_TRANSLATION, TRANSLATED, DELIVERED |

---

## 4. Integraciones

| Integración | Estado | Detalle |
|---|---|---|
| **SendGrid** | ✅ Funcionando | 16 tipos de email, tracking desactivado |
| **Stripe** | ✅ Funcionando | Checkout sessions + webhooks (pedidos y presupuestos) |
| **Redsys** | ✅ Funcionando | Redirect form + notificación, SMS post-pago |
| **PayPal** | ❌ Desactivado | NEXT_PUBLIC_ENABLE_PAYPAL=false, código presente |
| **Bizum** | ✅ Funcionando | Manual (transferencia con identificador) |
| **Transferencia** | ✅ Funcionando | IBAN + BIC en UI |
| **Claude (Anthropic)** | ✅ Funcionando | claude-sonnet-4-20250514, análisis documentos + chat |
| **Twilio SMS** | ✅ Funcionando | OTP traductor, notificaciones post-pago, fire-and-forget |
| **Twilio WhatsApp** | ✅ Funcionando | Notificaciones alternativas a SMS |
| **Vercel Blob** | ✅ Funcionando | Almacenamiento ficheros subidos, PDFs, traducciones |
| **Google Vision** | ⚠️ Parcial | Env vars definidas, no integrado en código |
| **OCR.space** | ⚠️ Parcial | Env var definida, fallback no integrado |
| **NextAuth (Google)** | ✅ Funcionando | OAuth para staff (STAFF_EMAILS) |
| **Velite (blog)** | ✅ Funcionando | 10 artículos MDX, 4 categorías |

---

## 5. Estado de funcionalidades

### Core

| Funcionalidad | Estado |
|---|---|
| Funnel de pedido (start → confirmation) | ✅ Funcionando |
| Análisis IA de documentos | ✅ Funcionando |
| Presupuesto instantáneo | ✅ Funcionando |
| Gestión de pedidos (admin) | ✅ Funcionando |
| Sistema de presupuestos formales | ✅ Funcionando |
| Pagos Stripe | ✅ Funcionando |
| Pagos Redsys | ✅ Funcionando |
| Pagos Bizum / Transferencia | ✅ Funcionando |
| Pagos PayPal | ❌ Desactivado |
| Emails transaccionales | ✅ Funcionando |
| SMS/WhatsApp notificaciones | ✅ Funcionando |
| Chat IA público | ✅ Funcionando |
| Blog MDX | ✅ Funcionando |
| Zona traductor (OTP) | ✅ Funcionando |
| Facturación PDF | ✅ Funcionando |
| Workflow de pedidos | ✅ Funcionando |
| Finanzas (margen, reconciliación) | ✅ Funcionando |

### SEO

| Funcionalidad | Estado |
|---|---|
| Schema JSON-LD (7 tipos) | ✅ Funcionando |
| OG Image dinámica | ✅ Funcionando |
| Sitemap XML | ✅ Funcionando |
| Canonical URLs | ✅ Funcionando |
| 10 páginas de idioma | ✅ Funcionando |
| 50 páginas de ciudad | ✅ Desplegado (pendiente indexación) |
| Redirects legacy WordPress (100+) | ✅ Funcionando |
| Middleware 410 endpoints WP | ✅ Funcionando |

### Seguridad

| Funcionalidad | Estado |
|---|---|
| URLs pedidos firmadas (HMAC-SHA256) | ✅ Funcionando |
| Rate limiting por IP | ✅ Funcionando |
| Timing-safe token comparison | ✅ Funcionando |
| GDPR censoring en análisis IA | ✅ Funcionando |
| Noindex en rutas privadas | ✅ Funcionando |

---

## 6. Variables de entorno (80)

### Obligatorias

```
DATABASE_URL
NEXTAUTH_URL
NEXTAUTH_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
STAFF_EMAILS
ORDER_TOKEN_SECRET
NEXT_PUBLIC_SITE_URL
```

### Email

```
SENDGRID_API_KEY
SENDGRID_FROM
PRESUPUESTO_TO
PM_NOTIFICATION_TO          # opcional
SENDGRID_SKIP_DEV           # opcional
```

### SMS / WhatsApp

```
SMS_PROVIDER                # log | twilio
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_API_KEY_SID          # alternativa a AUTH_TOKEN
TWILIO_API_KEY_SECRET
TWILIO_FROM_NUMBER
TWILIO_WHATSAPP_FROM
```

### Pagos — Stripe

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_QUOTES_WEBHOOK_SECRET
```

### Pagos — Redsys

```
REDSYS_SECRET_KEY
REDSYS_MERCHANT_CODE
REDSYS_TERMINAL             # default: 1
REDSYS_ENV                  # test | production
NEXT_PUBLIC_ENABLE_REDSYS
```

### Pagos — PayPal (desactivado)

```
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_ENV                  # sandbox | production
NEXT_PUBLIC_ENABLE_PAYPAL   # false
NEXT_PUBLIC_PAYPAL_CLIENT_ID
NEXT_PUBLIC_PAYPAL_MANUAL_LINK
NEXT_PUBLIC_PAYPAL_ACCOUNT
```

### Pagos — Manual

```
NEXT_PUBLIC_TRANSFER_ACCOUNT_HOLDER
NEXT_PUBLIC_TRANSFER_IBAN
NEXT_PUBLIC_TRANSFER_BIC
NEXT_PUBLIC_BIZUM_IDENTIFIER
```

### IA / OCR

```
ANTHROPIC_API_KEY
OCR_SPACE_API_KEY
GOOGLE_VISION_API_KEY
GOOGLE_VISION_SERVICE_ACCOUNT_JSON
```

### Storage

```
BLOB_READ_WRITE_TOKEN       # auto en Vercel
```

### Seguridad / Cron

```
CRON_SECRET
QUOTES_CRON_SECRET
RATE_LIMIT_STORE            # memory | redis
```

### Operacional

```
ETA_HOLIDAYS                # YYYY-MM-DD,YYYY-MM-DD
TRANSLATOR_COLLABORATORS    # JSON array
NO_CLICK_TRACKING           # SendGrid
```
