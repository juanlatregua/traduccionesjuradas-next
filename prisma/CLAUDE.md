# Prisma — Schema y migraciones

## Schema: 20 modelos, 15 enums

### Modelos principales
| Modelo | Propósito | Relación clave |
|--------|-----------|----------------|
| Order | Pedido de traducción | Hub central — conecta todo |
| OrderEvent | Log de cambios de estado | → Order (Cascade) |
| OrderPaymentEvent | Log de webhooks de pago | → Order (Cascade), idempotencyKey unique |
| BillingData | Datos de facturación | → Order (1:1, Cascade) |
| ShippingData | Dirección envío papel | → Order (1:1, Cascade) |
| Customer | Cliente (para quotes) | email unique |
| Quote | Presupuesto formal | → Customer (Restrict), publicToken unique |
| QuoteLine | Línea del presupuesto | → Quote (Cascade) |
| QuotePayment | Pago vinculado a quote | → Quote (Cascade) |
| OrderSession | Sesión del funnel | reference unique |
| OrderDocument | Documento del funnel | → OrderSession (Cascade) |
| DocumentAnalysis | Análisis IA | → Order (SetNull) |
| Collaborator | Traductor externo | email unique |
| CollaboratorAssignment | Asignación a colaborador | → Order (Cascade), → Collaborator (Restrict) |
| ChatSession | Historial chat IA | sessionId unique |
| RateLimitBucket | Rate limiting | key como id |
| FailedEmail | Emails fallidos | Solo audit |

### Relaciones críticas
- `Customer → Quote`: **onDelete: Restrict** — no borrar cliente si tiene quotes
- `Collaborator → Assignment`: **onDelete: Restrict** — no borrar colaborador activo
- Todo lo demás: **onDelete: Cascade** — borrar padre borra hijos

## Cómo migrar sin perder datos
1. Editar `schema.prisma`
2. `npx prisma db push` (aplica directo, NO migrate dev)
3. Crear SQL manual en `prisma/migrations/YYYYMMDDHHMMSS_desc/migration.sql`
4. `npx prisma migrate resolve --applied YYYYMMDDHHMMSS_desc`

**NUNCA usar `prisma migrate dev`** — falla con Prisma Postgres (P3006).

Ver `docs/runbooks/prisma-migrations.md` para detalle completo.
