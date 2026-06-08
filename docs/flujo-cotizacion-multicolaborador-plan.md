# Flujo de captación → cotización multi-colaborador → entrega

> Plan de implementación. Origen: sesión 2026-06-08 (workflow ultracode: 6 mapeos + diseño + revisión adversarial contra el código real).
> Decisiones de Juan recogidas en la misma sesión (ver §Decisiones).

## Objetivo

Cerrar el flujo desde que un cliente llega (email / WhatsApp / web) hasta la entrega, con
cotización competitiva entre colaboradores y precio automático al cliente:

1. Llega un documento (email/WhatsApp/alta manual).
2. Enrutado por idioma: **FR → Juan Silva directo**; resto → solicitud de presupuesto a los colaboradores de ese idioma.
3. El/los colaborador(es) responden **precio (sin IVA) + plazo**.
4. El sistema calcula el precio al cliente: **coste × 1,25 (margen) × 1,21 (IVA)**.
5. Se sugiere la mejor oferta (precio+plazo); **Juan confirma** (híbrido).
6. Se manda el presupuesto al cliente en su idioma; **el cliente confirma pagando** (el pago = el OK).
7. Se fija el plazo. El **día de cumplimiento** un cron avisa al colaborador para que suba la traducción.
8. La traducción se entrega al cliente y queda en el sistema.

## Decisiones (2026-06-08)

- **El 25% = margen de HBTJ** sobre el coste del colaborador, **cobro único** (confirmado 2026-06-08, NO anticipo). Fórmula:
  `precioClienteCents = round(costeColaboradorCents × 1.25 × 1.21)`.
- **El cliente confirma pagando** — no hay paso de "aceptar/rechazar" separado; el pago es la aceptación.
- **Selección híbrida**: el sistema sugiere la mejor por score precio+plazo, Juan confirma.
- **Intake por las 3 vías**: alta manual (ya existe) primero; luego webhook WhatsApp y webhook email.
  WhatsApp entrante queda supeditado a rehabilitar el sender (ver `project_fase2_whatsapp_state`).
- **Juan Silva = colaborador formal** con `fr`; los pedidos FR crean una asignación auto-aceptada.

## Estado actual — lo que YA existe (≈70%)

- `Collaborator` (`languages[]`, `phone`, `supplierType` AUTONOMO|EMPRESA, `swornNumber`, `active`) y
  `CollaboratorAssignment` con máquina `REQUESTED → QUOTED → ACCEPTED → DELIVERED` (+ `REJECTED`,
  `QUOTE_REVISION_REQUESTED`), `accessToken`, `quotedPriceCents`, `quotedDeadline`, `deliveredFileUrl`.
  `prisma/schema.prisma`.
- `@@unique([orderId, collaboratorId])` → **ya permite N colaboradores por pedido** (1 bid c/u). No tocar.
- Página pública tokenizada del colaborador: `app/encargo/[token]/page.tsx` + `app/api/encargo/[token]/route.ts`
  (`action=quote` cotiza, `action=delivery` entrega). Sin login, rate-limited.
- `lib/collaborators.ts`: `getCollaboratorsByLanguage`, `createAssignment`, `submitCollaboratorQuote`,
  `requestQuoteRevision`, `acceptCollaboratorQuote`, `rejectCollaboratorQuote`, `submitCollaboratorDelivery`.
- Alta de pedido sin funnel: `app/api/orders/pm-create/route.ts` (`createOrder` source=`file`).
- Notificaciones: `lib/email.ts` (Graph), `lib/sms.ts` (Twilio, fallback WA→SMS), `lib/collaborator-emails.ts`,
  `lib/notification-templates.ts`. Cron diario `app/api/cron/staff-digest`.
- Enrutado parcial: `autoAssignCollaboratorIfNeeded` (`lib/workflow-server.ts`) asigna EN/DE/PT/IT a
  `DEFAULT_COLLABORATOR_EMAIL` (Juan Amor) **al pagar**; FR solo recibe ETA (`assignDefaultFrenchEtaIfNeeded`).
- Pago a nivel Order: `createCheckoutSession` (`lib/stripe.ts`) + webhook `app/api/payment/stripe/webhook`.
- Math IVA: `DEFAULT_VAT_RATE = 0.21` (`lib/quotes.ts`). Margen/finanzas: `lib/finance.ts`. ETA: `lib/eta.ts` (`addBusinessDays`).

## Lo que falta (el orquestado)

1. **Cotizar ANTES del pago.** Hoy la asignación corre *post-pago*; hay que invertir el orden.
2. **Broadcast multi-colaborador + selección** por precio/plazo.
3. **Cálculo del precio al cliente** (coste × margen × IVA). **Bug actual**: `finance.margin.snapshot`
   compara `quotedPriceCents` (coste sin IVA) contra `Order.amountCents` (con IVA) → margen negativo.
4. **Presupuesto + pago como confirmación** del cliente, en su idioma.
5. **Cron del día de cumplimiento** para avisar al colaborador (el `dueDate` se guarda pero no se usa).
6. **Intake entrante automático** (webhooks email/WhatsApp) — no existe.

## Correcciones de la revisión adversarial (no tropezar)

- **Pago del cliente**: usar `createCheckoutSession` (`lib/stripe.ts`), el Order ya existe.
  NO `createQuoteStripeCheckoutSession` (acoplado a `Quote`).
- **`createOrder` tipa `source` como union TS** `'preset'|'file'|'estimador'`. Para un nuevo valor (p.ej.
  `'intake'`) hay que ampliar la union, no pasar string libre (rompe el build aunque el schema sea String).
- **Guard en la cascada de pago**: `autoAssignCollaboratorIfNeeded` re-asignaría EN/DE/PT/IT al pagar,
  chocando con el colaborador ya elegido. Condicionar (skip si ya hay asignación ganadora/aceptada).
- **No existe `Collaborator` de Juan Silva con `fr`** todavía → crearlo (decisión: colaborador formal).
- **`submitCollaboratorDelivery` NO copia a `Order`** — la copia a `Order.finalDeliveryFileUrl`/`translatedFileUrl`
  y la transición a `TRADUCIDO_ENTREGADO` son trabajo nuevo (Fase 4).
- **`select-bid` debe ser transaccional** (marcar 1 ganadora + rechazar N-1 en una transacción; idempotente).
- **`@@unique([orderId,collaboratorId])`** impide re-pedir al mismo colaborador → reutilizar la fila (reset de status),
  no crear otra.
- **Sin sobreingeniería**: nada de modelo `QuoteBid`/`QuotationRequest` nuevo (CollaboratorAssignment basta);
  nada de `Quote` formal (basta `Order.amountCents` + `Order.quoteSnapshotJson`); **eliminar el "OK definitivo
  del colaborador"** (el `QUOTED` ya es su compromiso; la selección de Juan es el cierre); no añadir campos
  `Collaborator` especulativos (`maxConcurrentJobs`, etc.) hasta que haga falta scoring real.
- **Workflow rígido**: `WORKFLOW_TRANSITIONS` es lineal. Usar un sub-estado `Order.quoteState` paralelo
  (mínimo) en vez de tocar `WorkflowState`. `PRESUPUESTO_ENVIADO` ya mapea "presupuesto al cliente".
- **Crons**: `vercel.json` ya tiene ~9. Verificar plan (Pro) antes de añadir; el digest existente puede absorber
  los follow-ups en vez de un cron nuevo.

## Cambios de schema (aditivos, `prisma db push`)

Todos nullable o con default (no `migrate dev` — shadow DB falla):

- `CollaboratorAssignment`: `isWinning Boolean @default(false)`, `score Float?`.
  *(Se descarta `confirmedByCollaboratorAt`: el OK final del colaborador se elimina.)*
- `Order`: `supplierCostCents Int?`, `marginPct Int? @default(25)`, `quoteState String?`
  (mínimo: `ESPERANDO_CLIENTE` | `ACEPTADO_CLIENTE`), `intakeChannel String?` (email|whatsapp|manual).
  *(`quoteSnapshotJson`, `dueDate`, `amountCents`, `clientLocale` ya existen.)*
- `OrderEvent`: sin cambio de schema; nuevos `type`: `collaborator.quote_request_batch`,
  `order.pricing.calculated`, `collaborator.delivery_reminder_sent`.

## Fases

### Fase 1 — Math IVA+margen + plazo  *(mayor valor, menor riesgo)*
- Corregir el cálculo: al seleccionar bid, `Order.amountCents = round(coste × (1+marginPct/100) × 1.21)`,
  `Order.supplierCostCents = coste`. `finance.margin.snapshot` comparable (coste×1.21 vs revenue).
- Fijar `dueDate = quotedDeadline` (con `addBusinessDays` de buffer si envío papel).
- `prisma db push` de los campos aditivos.
- Definir explícitamente la convención de IVA del input del colaborador (hoy teclea un número sin distinción).
- Ficheros: `app/api/orders/[reference]/collaborator-assignment/[id]/route.ts`, `lib/finance.ts`,
  `lib/collaborators.ts`, `prisma/schema.prisma`, `lib/quotes.ts`.

### Fase 2 — Broadcast multi-colaborador + selección híbrida
- `POST /api/orders/[reference]/quote-request-batch`: `getCollaboratorsByLanguage` → N `CollaboratorAssignment`
  REQUESTED + `sendFriendlyQuoteRequest` a cada uno.
- Crear el `Collaborator` de **Juan Silva** (`fr`) y cablear FR → asignación auto-aceptada.
- `POST /api/orders/[reference]/select-bid` (transaccional): marca ganadora (`isWinning`), rechaza el resto,
  calcula precio cliente (Fase 1). El sistema **sugiere** la mejor por score; Juan **confirma**.
- UI comparativa en `components/CollaboratorAssignmentPanel.tsx` (ordenar por precio/plazo, score sugerido).
- Ficheros: `app/api/orders/[reference]/quote-request-batch/route.ts`,
  `app/api/orders/[reference]/select-bid/route.ts`, `components/CollaboratorAssignmentPanel.tsx`,
  `lib/workflow-server.ts`, `lib/collaborators.ts`.

### Fase 3 — Presupuesto al cliente + pago = confirmación
- `POST /api/orders/[reference]/send-quote-to-client`: email+SMS en `clientLocale` con el precio final, plazo y
  **link de pago** (`createCheckoutSession`, `lib/stripe.ts`). Transición a `PRESUPUESTO_ENVIADO` /
  `quoteState=ESPERANDO_CLIENTE`.
- El cliente paga → webhook `app/api/payment/stripe/webhook` → `quoteState=ACEPTADO_CLIENTE` →
  notifica al colaborador ganador → transición a `EN_TRADUCCION` (hito SMS al cliente).
- **Guard**: el webhook NO debe re-auto-asignar (ya hay ganadora).
- *(No hay endpoint de "decision" separado: el pago es la confirmación.)*
- Ficheros: `app/api/orders/[reference]/send-quote-to-client/route.ts`,
  `app/api/payment/stripe/webhook/route.ts`, `lib/stripe.ts`, `lib/collaborator-emails.ts`,
  `lib/email.ts`, `lib/sms.ts`, `lib/workflow-server.ts`.

### Fase 4 — Cron recordatorio + entrega al cliente
- `app/api/cron/delivery-reminders`: asignaciones ACCEPTED con `dueDate==hoy` (o T-1) sin `deliveredAt`
  → SMS+email al colaborador con link `/encargo/[token]`. Patrón de `staff-digest` (auth por header).
- En `action=delivery`: copiar `deliveredFileUrl` a `Order.finalDeliveryFileUrl` + transición
  `TRADUCIDO_ENTREGADO` (hito SMS 'lista' + `sendTranslationReadyEmail` bilingüe).
- Ficheros: `app/api/cron/delivery-reminders/route.ts`, `app/api/encargo/[token]/route.ts`,
  `lib/workflow-server.ts`, `lib/email.ts`, `vercel.json`.

### Fase 5 — Intake entrante automático *(mayor riesgo; las 3 vías)*
- Manual ya cubierto por `pm-create` (con entrada de idioma del admin para enrutar).
- `POST /api/webhooks/whatsapp-inbound` (Twilio, valida `X-Twilio-Signature`) — supeditado a rehabilitar WA.
- `POST /api/webhooks/email-inbound` (Graph subscription, valida `clientState`).
- Ambos: crean pedido (`source` ampliado), suben adjuntos a Blob, detección de idioma → `quote-request-batch`.
- **Respetar el gate `isAutoPriceable`** (incidente doc ruso, NO ru/uk) y no enrutar mal por idioma erróneo.
- Ficheros: `app/api/webhooks/whatsapp-inbound/route.ts`, `app/api/webhooks/email-inbound/route.ts`,
  `lib/orders.ts`, `lib/azure-mail.ts`, `lib/sms.ts`.

## Riesgos

- **Bug de margen actual** (Fase 1): si no se corrige, contamina facturación (`Expense`).
- **Tokens públicos**: rate-limit + expiración obligatorios en cualquier endpoint público nuevo.
- **`select-bid` no transaccional** → dobles ganadores si dos aceptan a la vez.
- **Webhooks (Fase 5)**: firma/replay, adjuntos maliciosos, idioma mal detectado → cobro erróneo.
- **WhatsApp** aún no rehabilitado: el canal real es SMS hasta dar de alta el sender dedicado.
- **prisma db push aditivo**: todos los campos nuevos nullable/con default.
