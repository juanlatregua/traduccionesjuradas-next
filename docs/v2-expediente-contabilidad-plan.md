# Plan — Expediente como proyecto + contabilidad

Diseño aprobado por Juan (2026-05-29). Cierra los huecos detectados en la auditoría
del ciclo intake → presupuesto → pedido → producción → entrega → factura.

## Ya implementado (esta sesión, sin migración)

- **Pipeline de análisis por capas** (`lib/ai/extract-text.ts`, `analyzeDocumentText`,
  `lib/ai/run-analysis.ts`): PDF con texto → Haiku/texto (barato); escaneo → Sonnet/visión.
- **Presupuesto de expediente (staff)**: `/zona-traductor/presupuesto` — N PDFs → tabla
  editable → Quote con descuento por volumen.
- **Intake público de expediente**: home → `/expediente` → `/api/expediente/submit` →
  bandeja `/zona-traductor/expedientes` → `?exp=REF` precarga y analiza → presupuesto.
  Emails de acuse al cliente + aviso al staff. Consulta pública `/expediente/[token]`.
- **KEYSTONE Quote→Pedido** (`createOrderShellFromQuote` + webhook de quote): presupuesto
  pagado crea el Order de producción + cascada (PAGO_VALIDADO, ETA FR, auto-colaborador, emails).

## Fase A — Contabilidad rápida (SIN migración)

1. **Pago manual de presupuesto (Bizum/transferencia).**
   Hoy un Quote solo pasa a PAID por webhook Stripe. Falta endpoint
   `POST /api/quotes/[id]/mark-paid` (staff) que registre `QuotePayment` manual,
   marque Quote PAID y dispare el mismo puente Quote→Order. Botón en `AdminQuoteDetailPanel`.

2. **Coste de colaborador → margen automático.**
   `CollaboratorAssignment.quotedPriceCents` ya existe pero hay que reescribirlo a mano en
   el panel de margen. Al aceptar la asignación, sembrar `supplierCostCents` en el snapshot
   de margen (`finance.margin.snapshot`) sumando los assignments aceptados del pedido.

## Fase B — Factura cliente fiscal (migración ADITIVA, segura)

Hoy `invoice-pdf` genera `F-{ref}` al vuelo, sin numeración ni persistencia → inútil para
la gestoría. Modelo nuevo:

```prisma
model ClientInvoice {
  id            String   @id @default(cuid())
  number        String   @unique          // FAC-2026-00001 (secuencial por año)
  orderId       String
  order         Order    @relation(fields: [orderId], references: [id])
  issuedAt      DateTime @default(now())
  // Snapshot fiscal congelado en el momento de emisión
  fiscalName    String
  nif           String
  address       String
  baseCents     Int                       // base imponible
  vatRate       Float    @default(0.21)
  vatCents      Int
  totalCents    Int
  pdfUrl        String?
  pdfHash       String?
  createdAt     DateTime @default(now())
  @@index([orderId])
}
```
+ `Order.clientInvoice ClientInvoice?` (inverso). Numeración secuencial por año en una
transacción (count + retry como `generateUniqueQuoteNumber`). `invoice-pdf` pasa a leer/crear
`ClientInvoice` en vez de templar `F-{ref}`.

## Fase C — Expediente como proyecto (migración + refactor por fases)

Problema: el Order es monolítico (1 langPair, 1 colaborador único, 1 entrega). Un expediente
EN→ES + ES→EN con varios colaboradores no cabe.

### C1 — Estructura de documentos del pedido (aditivo)
```prisma
model OrderDocumentItem {
  id              String   @id @default(cuid())
  orderId         String
  order           Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fileName        String
  fileUrl         String
  documentType    String?
  sourceLang      String?
  targetLang      String?
  words           Int?
  quotedCents     Int?
  status          String   @default("PENDING") // PENDING|IN_TRANSLATION|DELIVERED
  assignedTo      String?                       // collaborator email
  deliveredFileUrl String?
  deliveredAt     DateTime?
  createdAt       DateTime @default(now())
  @@index([orderId])
}
```
El puente Quote→Order copia las `QuoteLine`/`DocumentAnalysis` del expediente a
`OrderDocumentItem`. El workspace del traductor pasa a vista por documento (progreso N/M).

### C2 — Multi-colaborador (cambio de constraint)
`CollaboratorAssignment` hoy `@@unique([orderId, collaboratorId])`. Para repartir un
expediente por idioma/documento, asignación a nivel de `OrderDocumentItem`
(`assignedTo`) o tabla intermedia. Auto-asignación por idioma de cada documento.

### C3 — Entrega progresiva
Entrega por `OrderDocumentItem` (`deliveredFileUrl`) en vez de un único
`Order.finalDeliveryFileUrl`. El Order pasa a TRADUCIDO_ENTREGADO cuando todos sus
documentos están DELIVERED.

### Nota de diseño
No hace falta un modelo `Project` separado: **el Order ES el expediente** (ya agrupa N
docs vía la relación nueva). Evita un nivel extra y reusa todo el ciclo de pedido,
contabilidad y workspace existente.

## Orden de ejecución propuesto

1. Fase A (sin migración) — inmediato.
2. Fase B (migración aditiva, sin riesgo de datos) — tras revisar SQL.
3. Fase C por sub-fases (C1 aditivo → C2 → C3 + UI workspace) — tras revisar SQL.

Todas las migraciones vía `prisma db push` (aditivas = sin pérdida de datos). Preview del
SQL antes de aplicar a prod (runbook `docs/runbooks/migraciones`).
