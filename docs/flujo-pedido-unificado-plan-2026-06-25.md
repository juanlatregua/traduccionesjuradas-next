# Flujo de pedido unificado — plan definitivo (2026-06-25)

Origen: workflow multi-agente (auditar → diseñar → criticar). El diseño pasó por una
revisión adversarial que cazó una contradicción en el fix de entrega; este documento
recoge el plan **ya corregido**. Sin migración de schema en ninguna fase.

## Rutas verificadas (ficheros clave)
- `app/api/orders/[reference]/delivery/route.ts` — entrega (transición ANTES de persistir; OrderEvent del mensaje)
- `lib/workflow.ts` — máquina de estados (`WORKFLOW_TRANSITIONS`, `getWorkflowState`)
- `lib/workflow-server.ts` — `transitionWorkflowState` (corta en `from===to` ANTES de `canTransition`; SMS solo si `changed`)
- `lib/orders.ts:597` — `updateDeliveryState` (ya escribe `deliveryState` + `status`)
- `lib/email.ts:193` — `sendTranslationReadyEmail` (devuelve void)
- `lib/email-retry.ts` — `sendEmailWithRetry` (traga error, devuelve void)
- `app/api/invoices/[id]/paid/route.ts` — endpoint huérfano, sin commitear, infra-gateado
- `app/api/bank/decision/route.ts:21-31` — `setPaid` inline (2º sellador de `ClientInvoice.paidAt`), gate ADMIN/PM OK
- `lib/client-invoice.ts:217` — `issueInvoice` (hogar del futuro `setInvoicePaid`)
- `components/{OrderActionPanel(849),ProjectCockpit(316),TranslationWorkspacePanel(312)}.tsx`

## Los 3 dolores (verificados en código + BD)
1. **Entrega no se guarda.** `getWorkflowState` resuelve un pedido PAID + `deliveryState=PRESUPUESTO` a `PAGO_VALIDADO`. `WORKFLOW_TRANSITIONS["PAGO_VALIDADO"]=["EN_TRADUCCION"]` → el salto a `TRADUCIDO_ENTREGADO` se rechaza → el endpoint devuelve 400 **antes** de persistir. Caso normal FR (nunca pasa por EN_TRADUCCION). BD: `TJ-2026-QKFJ2661` PAID, `deliveryState=PRESUPUESTO`, todos los campos de entrega null.
2. **Mensaje invisible.** El email de entrega se manda pero su contenido (asunto/cuerpo) no se guarda; solo un `OrderEvent` genérico. Bug 2º: `downloadUrl: translatedFileUrl` (campo crudo, vacío en multi-archivo).
3. **Cobro duplicado.** `invoices/[id]/paid` (huérfano, sin UI, sin commitear) duplica el sellado de `ClientInvoice.paidAt` de `bank/decision`, e infra-gateado (solo STAFF; debería ADMIN/PM).

---

## FASE 1 — Fix de entrega ✅ HECHO (rama `feat/flujo-pedido-fixes`)
**El endpoint YA es "transición-primero"** → el fix es UNA arista, sin reordenar, sin `forceMilestone`
(el diseño original proponía invertir el orden + forzar el hito; la crítica demostró que eso dejaba la
arista como código muerto y duplicaba el SMS — descartado).
- `lib/workflow.ts`: `PAGO_VALIDADO: ["EN_TRADUCCION", "TRADUCIDO_ENTREGADO"]`. No relaja pago (la guarda solo bloquea PAGO_VALIDADO sin pago; el endpoint corta si no PAID).
- `delivery/route.ts`: `downloadUrl: translatedFileUrl` → `primaryFileUrl` (correcto en multi-archivo).
- Verificado: `tsc --noEmit` 0 errores.
- **Confirmar en prod:** reintentar "Entregar" en `TJ-2026-QKFJ2661` → 200; BD con `deliveryState=TRADUCIDO`, `status=DELIVERED`, `deliveryFilesJson` no-null; `workflow.state_changed` escrito; SMS "lista" una vez.

## FASE 2 — Persistir el mensaje enviado (backend) — PENDIENTE
Corrección de la crítica: **loguear SÍNCRONO antes del response** (en serverless el IIFE de fondo puede
no ejecutarse → se perdería justo lo que Juan quiere ver). Desacoplar "qué se compuso" (fiable) de
"resultado del envío" (best-effort).
- `lib/email.ts`: extraer `buildTranslationReadyEmail(data) → {subject, html}`; `sendTranslationReadyEmail` lo usa y envía.
- `delivery/route.ts`: construir contenido síncrono → `OrderEvent` síncrono con `payload.{subject,bodyHtml,channel,attachments,downloadUrl:primaryFileUrl,ok:null}` ANTES del return; envío en background actualiza `ok`. Borrar el OrderEvent genérico.
- Mostrar en panel: sección "Cliente y mensajes" lee `OrderEvent type LIKE 'notification.%.sent'` y renderiza asunto+cuerpo (sanitizado, tratar `bodyHtml` como no confiable → DOMPurify/escape).

## FASE 3 — Unificar cobro + auth ADMIN/PM (backend, seguridad) — PENDIENTE
- `lib/client-invoice.ts`: `setInvoicePaid(id, when)` (guarda de estado + idempotencia aquí).
- `bank/decision/route.ts`: la rama `invoice` de `setPaid` delega en `setInvoicePaid`. **Crítica:** que el fallo (factura no emitible) **no se trague** → avisar al usuario, no log silencioso. Decidir política de re-sellado con fecha distinta (hoy `setPaid` re-sella; el helper idempotente no).
- `invoices/[id]/paid`: borrar el endpoint huérfano (sin UI) y mover solo el helper; o gatearlo ADMIN/PM si se conserva. `git status` debe quedar limpio.
- Gate ADMIN/PM (patrón `gate()` de bank/decision) en endpoints de dinero hoy solo STAFF: `invoices/[id]/issue`, `quotes/[id]/mark-paid`, `finance/{close,margin,margin-approval,reconciliation}`. **Verificar matriz de roles antes** (no bloquear a Juan).

## FASE 5 (antes que la 4) — `OrderWorkspace` UI única — PENDIENTE
Crítica: **invertir orden 4↔5** (retirar rutas antes de crear la nueva = 404). Y `OrderActionPanel` es un
**monolito de 849 líneas**, NO tiene sub-paneles extraíbles → la "recomposición" es en realidad un refactor
(extraer Workflow/Documentos/Finanzas/Cliente/Upload del monolito). Presupuestarlo como tal.
- Crear `app/zona-traductor/pedido/[reference]/page.tsx` (Server Component, Prisma directo) + `components/OrderWorkspace.tsx`.
- Tema único **CLARO** (cream/parchment/encre/bleu/sepia), sin toggle. Cabecera sticky + zona de acción (siguiente acción + dropzone SIEMPRE visible + Entregar) + 6 secciones ancladas (no tabs): Estado/flujo · Documentos cliente · Subir/ver traducciones · Colaborador · Finanzas · Cliente+mensajes.
- Consumir el **proxy de descarga desde el principio** (no exponer URLs públicas de Blob en el panel nuevo).

## FASE 4 (después de la 5) — Retirar duplicados — PENDIENTE
- Borrar `ProjectCockpit.tsx` + ruta `proyecto/[reference]`; `workspace/[reference]` → redirect a `…/pedido/…#traduccion`.
- **Repuntar ~8 enlaces internos** a las rutas viejas: `KanbanBoard.tsx:198`, `PMQuickCreatePanel.tsx:349`, `OrderTableWithBulkActions.tsx:285`, `CollaboratorAssignmentPanel.tsx:526`, y 5 hrefs en `OrderActionPanel` (335/470/586/610/798).
- Lista de presupuestos: enlazar zona-traductor → `/admin/quotes` SOLO si COLLABORATOR puede entrar ahí (`/admin/quotes` usa `requireAdminPageAccess`; un colaborador sería expulsado). **Verificar antes.**

## FASE 6 — Defensa en profundidad — PENDIENTE
- zod por endpoint de dinero/estado; idempotencia (no-op si ya en destino); proxy `GET /api/orders/[reference]/documents/[id]/download` (auth panel / token firmado cliente) → deja listo enlazar el store `tj-privado` sin reescribir UI.

## Decisiones de Juan (no forzadas)
1. **5º panel** `app/admin/orders/[reference]` (espejo claro): reducir a lectura, dejar como está, o retirar. Recomendación: solo-lectura.
2. **Acceso COLLABORATOR a presupuestos**: ¿debe ver la lista de presupuestos? Decide si la pestaña de zona-traductor enlaza a `/admin/quotes` (ADMIN-gated) o mantiene su propia vista.

## Modelo de datos — NO fusionar
`Quote.paidAt` (presupuesto) · `Order.paidAt` (pedido) · `ClientInvoice.paidAt` (factura fiscal) = tres
hechos distintos. La duplicación es de **escritura** (dos endpoints sellan ClientInvoice.paidAt), no de modelo.
