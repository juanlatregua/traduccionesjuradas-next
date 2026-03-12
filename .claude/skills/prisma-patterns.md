# Prisma — Modelos, relaciones y migraciones

## Modelos principales (20) y relaciones clave

### Hub central: Order
```
Order (reference único)
├── OrderEvent[]           — log de cambios de estado (onDelete: Cascade)
├── OrderPaymentEvent[]    — webhooks de pago (idempotencyKey unique, onDelete: Cascade)
├── BillingData?           — datos facturación (one-to-one, onDelete: Cascade)
├── ShippingData?          — dirección envío papel (one-to-one, onDelete: Cascade)
├── DocumentAnalysis[]     — análisis IA vinculados (onDelete: SetNull)
├── CollaboratorAssignment[] — asignaciones a colaboradores (onDelete: Cascade)
└── Quote?                 — presupuesto formal vinculado
```

### Ecosistema de presupuestos
```
Customer (email unique)
└── Quote[] (quoteNumber unique, publicToken unique)
    ├── QuoteLine[]        — líneas del presupuesto
    ├── QuotePayment[]     — pagos (Stripe session/intent)
    ├── MessageLog[]       — emails/WhatsApp enviados
    ├── AccessEvent[]      — aperturas del presupuesto
    └── StripeEventLog[]   — eventos Stripe
```

### Funnel de pedido
```
OrderSession (reference unique)
└── OrderDocument[]        — documentos subidos durante el funnel
```

### Módulo colaboradores
```
Collaborator (email unique, active index)
└── CollaboratorAssignment[] (accessToken unique)
    — unique(orderId, collaboratorId)
    — AssignmentStatus: REQUESTED → QUOTED → ACCEPTED → DELIVERED
                                  ↘ REJECTED (terminal)
                                  ↘ QUOTE_REVISION_REQUESTED → QUOTED (ciclo)
```

### Otros modelos
- **RateLimitBucket** — rate limiting por IP (key como id)
- **ChatSession** — historial chat IA (sessionId unique, messages JSON)
- **DocumentAnalysis** — análisis IA (status enum con 10 estados, GDPR fields)
- **FailedEmail** — log de emails fallidos (error, attempt)

## Enums (15)
| Enum | Valores |
|------|---------|
| OrderStatus | PENDING_PAYMENT, PAID, IN_PROGRESS, DELIVERED, CANCELLED |
| PaymentStatus | PENDING, PAID, FAILED, REFUNDED |
| PaymentMethod | REDSYS, PAYPAL, BIZUM, TRANSFER, STRIPE |
| DeliveryState | PRESUPUESTO, EN_PROCESO, TRADUCIDO |
| QuoteStatus | DRAFT, SENT, OPENED, ACCEPTED, PAID, IN_PROGRESS, DELIVERED, EXPIRED |
| SessionStep | START, UPLOAD, REVIEW, CHECKOUT, CONFIRMATION |
| AssignmentStatus | REQUESTED, QUOTED, QUOTE_REVISION_REQUESTED, ACCEPTED, REJECTED, DELIVERED |
| DocAnalysisStatus | UPLOADED → ANALYZING → ANALYZED → QUOTE_GENERATED → PAID → DELIVERED |

## Patrones de diseño
- **Decimales:** Quote/payment usan `Decimal(12,2)` para precisión monetaria
- **Cascadas:** La mayoría usa `onDelete: Cascade`; Customer usa `Restrict`
- **Tokens públicos:** `publicToken` (quotes), `accessToken` (assignments) para acceso sin auth
- **JSON fields:** `quoteSnapshotJson`, `analysisJson`, `payload` para datos flexibles
- **Temporal:** `createdAt` + `updatedAt` en todos; timestamps específicos (`paidAt`, `deliveredAt`)
- **GDPR:** `gdprConsent`, `extractedNames[]`, IP hasheada

## Cómo crear y aplicar migraciones

### ⚠️ Shadow DB no funciona con Prisma Postgres
`prisma migrate dev` falla con P3006. Flujo correcto:

```bash
# 1. Editar schema.prisma
# 2. Aplicar directamente
npx prisma db push

# 3. Crear migración SQL manual
mkdir -p prisma/migrations/YYYYMMDDHHMMSS_descripcion
# Escribir el SQL equivalente en migration.sql

# 4. En producción
# prisma-deploy-safe.mjs detecta P3005 y hace db push automáticamente
```

### Prisma Studio
```bash
npx prisma studio    # Abre UI en http://localhost:5555
```

## Qué NO hacer
- **NUNCA** usar `prisma migrate dev` — falla con Prisma Postgres (shadow DB)
- **NUNCA** borrar migraciones existentes en `prisma/migrations/`
- **NUNCA** modificar campos de OrderPaymentEvent.idempotencyKey — rompe deduplicación de webhooks
- **NUNCA** cambiar onDelete de Customer (Restrict) a Cascade — borraría quotes con historial
- Cuidado al renombrar campos — Prisma interpreta rename como drop+create (pierde datos)
