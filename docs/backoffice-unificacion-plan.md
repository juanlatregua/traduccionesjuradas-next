# PLAN FINAL DEFINITIVO — Unificación del backoffice (DUEÑO) + zona scoped (TRADUCTOR EXTERNO)

> Documento de referencia. Origen: sesión 2026-06-11. Incorpora el diseño de
> arquitectura objetivo Y la revisión adversarial verificada contra el código.
> Read-only en esta sesión: el plan está listo para arrancar ejecución en la
> próxima. NO ejecutar en caliente.

---

## Resumen ejecutivo (5 líneas)

El backoffice está partido en dos navegaciones solapadas (`/admin/*` panel viejo, `/zona-traductor/*` donde vive el negocio) que son **100% del dueño**: el nombre "zona-traductor" es engañoso, no hay nada scoped a un externo. El objetivo es (A) **un backoffice unificado bajo `/admin/*`** para Juan con el hilo completo lead→cotización→adjudicación→cobro→entrega→factura, y (B) una **zona scoped real para traductores externos** (`/colaborador/*` + el `/encargo/[token]` actual) donde cada uno vea SOLO sus encargos. **Corrección crítica frente al diseño inicial:** la "asignación de texto libre" de admin NO es código muerto — es la única vía que avisa al CLIENTE ("en proceso" + nº de jurado) y transiciona a `EN_TRADUCCION`; `select-bid` y el FR-directo gestionan al COLABORADOR y las finanzas pero NO tocan nada cara-cliente. Por eso la unificación correcta es **fusionar ambas responsabilidades en el acto de adjudicar**, no borrar una; hacerlo al revés degrada la notificación al cliente, sobre todo en francés (donde Juan es el traductor).

---

## 1. Diagnóstico verificado (con evidencia de código)

Dos roles mezclados en dos navegaciones que arrancaron en momentos distintos y nunca se fusionaron. `/admin/*` es el panel viejo (UI clara, sin `layout.tsx` propio, `components/AdminNav.tsx`); `/zona-traductor/*` es donde vive el negocio (UI oscura en `app/zona-traductor/layout.tsx`, `components/ZonaTraductorNav.tsx`). Ambas son del DUEÑO: `authZonaTraductorOrRedirect()` acepta cualquier `isStaffEmail()` y `getAllOrdersForStaff()` carga TODOS los pedidos sin filtro por colaborador. **No existe scoping por traductor en ninguna parte.**

### Solapes confirmados

| Concepto | `/admin/*` | `/zona-traductor/*` | Patología |
|---|---|---|---|
| Pedidos | `/admin/orders` + `AdminOrderDetailPanel` | `/zona-traductor/control` + `OrderActionPanel` (6 tabs) | Dos listas, dos detalles, dos UX para el mismo `Order` |
| Presupuestos | `/admin/quotes` (+`/new`) | `/zona-traductor/presupuesto` | Dos builders con **modelo de precio distinto** (§7) |
| Colaboradores | `/admin/collaborators` (lista no accionable) | `CollaboratorAssignmentPanel` enterrado en un tab de Control | El directorio no acciona; el motor real está escondido |

### El corte de raíz: DOS sistemas de asignación COMPLEMENTARIOS (no duplicados)

Esta es la corrección más importante del plan, verificada línea a línea:

- **`/api/orders/[reference]/assign` (cara-CLIENTE + workflow).** Hace tres cosas que ningún otro path hace:
  1. `findTranslatorProfile(assignedTo)` → resuelve `swornNumber` → `sendTranslationStartedAssignedEmail(...)`: el correo "su traducción está en proceso, asignada a Juan Silva Moreno, jurado nº 3850, ETA X" (`assign/route.ts:66-77`).
  2. Transiciona a `EN_TRADUCCION` si el pedido está `PAID`, lo que **dispara el SMS "en proceso" al cliente** (`assign/route.ts:50-59`).
  3. Crea `OrderEvent client.translation_started_notified` (`assign/route.ts:79-93`).

- **`/api/orders/[reference]/select-bid` (cara-COLABORADOR + finanzas).** Marca la oferta `ACCEPTED` + `isWinning`, rechaza las demás, y vía `applyAcceptedQuoteSideEffects` fija `supplierCostCents`, `marginPct`, `amountCents` (precio cliente = coste×(1+margen)+IVA) y `dueDate`, genera el evento de factura proveedor, y notifica al colaborador (`select-bid/route.ts:75-139`). **NO escribe `Order.assignedTo`, NO resuelve el nº de jurado, NO manda el correo "en proceso" al cliente, NO transiciona a `EN_TRADUCCION`.**

- **FR-directo (`/api/orders/[reference]/quote-request-batch`, líneas 58-109).** Para francés (80% del negocio, Juan es el traductor) hace upsert `ACCEPTED` sin concurso. **Tampoco** llama a `select-bid` ni avisa al cliente.

**Consecuencia operativa:** hoy, incluso para sus propios pedidos FR, Juan necesita el "Asignar" de admin para que el cliente reciba el aviso con su nº de jurado. Borrarlo (como proponía el diseño inicial) deja a los pedidos de francés sin notificación al cliente. Los dos sistemas **se complementan**: uno cara-colaborador/finanzas, otro cara-cliente/workflow.

### `Order.assignedTo` NO es huérfano (verificado)

- `KanbanBoard.tsx:46,52,193` filtra columnas y muestra "👤 {assignedTo}".
- `ProjectCockpit.tsx:89-92,247` edita `assignedTo` por ítem vía `patchItem`.
- `findTranslatorProfile(assignedTo)` → nº de jurado del cliente. `CollaboratorAssignment.isWinning` NO se propaga a esos consumidores.

Migrar la "fuente de verdad" a `isWinning` exige reescribir Kanban + Cockpit + resolución del nº de jurado. Es riesgo **medio-alto**, no bajo.

---

## 2. Arquitectura objetivo

### (A) Backoffice del DUEÑO — nav única bajo `/admin/*`

`/admin/*` es la URL semánticamente correcta para "dueño/admin"; "zona-traductor" pasa a significar SOLO la zona scoped del externo (B). Nav única de 7 secciones:

```
/admin
├── /admin/bandeja        ← Inicio: lo accionable hoy (incluye expedientes entrantes)
├── /admin/pedidos        ← Lista + workspace único (§4)
│   └── /admin/pedidos/[reference]
├── /admin/presupuestos   ← Builder unificado + lista
│   └── /admin/presupuestos/[id]
├── /admin/colaboradores  ← Directorio ACCIONABLE
├── /admin/facturacion    ← Facturas · Recurrentes · Contabilidad (sub-tabs)
├── /admin/analitica      ← Métricas v2 · Funnel · Chat AI (sub-tabs)
└── /admin/tablero        ← Kanban
```

### Mapeo viejo → nuevo (inventario completo y verificado)

| Ruta vieja | Ruta nueva | Acción |
|---|---|---|
| `/zona-traductor` (Bandeja) | `/admin/bandeja` | Mover `BandejaEntrada` |
| `/admin/orders` + `/zona-traductor/control` | `/admin/pedidos` | Fusionar. Base = la de `control` (rica: KPIs/filtros). Descartar `AdminOrdersList` |
| `/admin/orders/[ref]` + `/zona-traductor/workspace/[ref]` + `/zona-traductor/proyecto/[ref]` | `/admin/pedidos/[reference]` | Fusionar en UN workspace (§4). Eliminar `AdminOrderDetailPanel` SOLO tras fusionar responsabilidades de asignación (§5 Fase 1) |
| `/admin/quotes` + `/admin/quotes/new` + `/zona-traductor/presupuesto` | `/admin/presupuestos` | Fusionar builder (§7) |
| `/admin/quotes/[id]` | `/admin/presupuestos/[id]` | Mover `AdminQuoteDetailPanel` |
| `/admin/collaborators` | `/admin/colaboradores` | Mover + accionable (§ Fase 4) |
| `/zona-traductor/facturas` | `/admin/facturacion?tab=facturas` | Mover `InvoiceManager` |
| `/zona-traductor/recurrentes` | `/admin/facturacion?tab=recurrentes` | Mover (gate ADMIN/PM) |
| `/zona-traductor/contabilidad` | `/admin/facturacion?tab=contabilidad` | Mover (gate ADMIN/PM) |
| `/admin/metricas` | `/admin/analitica?tab=metricas` | Mover |
| `/admin/funnel` | `/admin/analitica?tab=funnel` | Mover |
| `/admin/chat` | `/admin/analitica?tab=chat` | Mover |
| `/zona-traductor/tablero` | `/admin/tablero` | Mover `KanbanBoard` |
| `/zona-traductor/expedientes` | `/admin/bandeja` (sección) | Absorber |
| **`/zona-traductor/verificar`** | **`/admin/verificar`** (gate OTP) | **NO omitir** — es el gate OTP que redirige tras verificar. Hay que migrarlo o el flujo OTP queda colgando hacia `/zona-traductor` |

Un único `BackofficeNav.tsx` reemplaza `AdminNav.tsx` + `ZonaTraductorNav.tsx`. Tema: el oscuro de zona-traductor, pero **probar regresión visual** de métricas/funnel/chat (hoy diseñados en claro, `/admin/*` no tiene `layout.tsx`; ver §3 M4).

### (B) Zona del TRADUCTOR EXTERNO scoped

```
/colaborador                       ← dashboard scoped (login OTP PROPIO, namespace separado)
├── login: email + OTP → match contra Collaborator.email (único)
├── lista: SOLO sus CollaboratorAssignment (WHERE collaborator.email = sesión)
└── /colaborador/encargo/[id]
/encargo/[token]                   ← SE MANTIENE INTACTO (emails ya enviados, sin registro)
```

**Qué VE:** sus `CollaboratorAssignment`, el documento a traducir, el par idiomático, el plazo. Cotiza (precio+plazo), acepta/rechaza, entrega archivo (misma maquinaria `submitCollaboratorQuote` / `submitCollaboratorDelivery`).

**Qué NO VE — precisión RGPD (corrección A4):** el traductor jurado **necesita** el documento para traducir, y ese documento contiene datos del cliente (nombre, DNI, dirección — penales/nacimiento/saldos). "No ve datos del cliente" es inviable como blanket; lo que se oculta son los **metadatos de contacto y comerciales**: email/teléfono del cliente, precio que Juan cobra, margen, facturas, contabilidad, métricas, otros pedidos, otros traductores. El documento sí se entrega (es el objeto del encargo). Definir explícitamente el conjunto de campos ocultos en la query/serializador.

---

## 3. Riesgos verificados a respetar en TODA la ejecución

| # | Riesgo | Evidencia | Mitigación obligatoria |
|---|---|---|---|
| C1 | `/assign` sostiene aviso "en proceso" + nº jurado al cliente (incl. FR-directo) | `assign/route.ts:50-93` vs `select-bid` (no lo hace) | Fusionar responsabilidades ANTES de deprecar (§5 Fase 1) |
| C2 | `assignedTo` alimenta Kanban + Cockpit + nº jurado | `KanbanBoard.tsx:46,52,193`, `ProjectCockpit.tsx:89-92` | Mantener `assignedTo` poblado; no migrar fuente de verdad sin reescribir consumidores |
| C3 | SMS/emails con `?q=` `?exp=` hardcoded; los 308 NO preservan query por defecto | `sms.ts:157` (`?q=`), `expediente.ts:50` (`?exp=`), `email.ts:78-79,418,449-450,535,787`, `auth-callback.ts:3` | Reescribir links en código a rutas nuevas; redirects con `:path*` y preservación de query |
| A2 | `getStaffRole` evalúa COLLABORATOR antes que ADMIN; discrepa con `isStaffEmail` (gate real) | `staff-access.ts:54-62` | Reconciliar rol vs gate; blindar contra auto-lockout de Juan (varios correos) |
| A3 | Cookie OTP única `staff_otp_verified` compartida dueño/colaborador | `staff-otp.ts:15` | Cookie/namespace separado obligatorio para `/colaborador` |
| A4 | "No ve datos cliente" inviable: el documento jurado los contiene | `getDocumentsFromOrder` | Especificar campos ocultos (contacto/precio) vs documento (sí se entrega) |
| M1 | `quoteSnapshotJson` tiene 8 productores/consumidores; cambiar modelo de precio del builder puede desincronizar | grep: `orders.ts`, `order-actions.ts`, `OrderActionPanel`, `BandejaEntrada`, etc. | Verificar sync snapshot antes de tocar la estructura de `Quote` |
| M3 | `applyAcceptedQuoteSideEffects` emite `OrderEvent finance.supplier_invoice.updated` pero NO crea registro `Expense` | `collaborators.ts:289-293`; `model Expense` existe (schema:222) | Subir prioridad: cerrar lazo a `Expense` (contabilidad incompleta mientras tanto) |
| M4 | Tema oscuro a todo `/admin/*` sin evaluar; `/admin/*` no tiene layout | no existe `app/admin/layout.tsx` | Probar métricas/funnel/chat bajo root oscuro |

**Inmutables:** `/encargo/[token]` y `/api/encargo/[token]/*` NO se tocan (el token ES la auth; los emails enviados los usan). Gate ADMIN/PM en facturación/contabilidad/recurrentes se conserva.

---

## 4. Workspace de PEDIDO único (`/admin/pedidos/[reference]`)

Base: fusión de `OrderActionPanel` (6 tabs) + `WorkspaceEditor` + `ProjectCockpit`.

| Paso | Pieza | Estado |
|---|---|---|
| 1. Entra lead/pedido | `Order` + `DocumentAnalysis` (puerta web) / **WhatsApp / manual** (M2) | ✅ web / ⚠ falta entrada manual lead |
| 2. Pedir cotización | tab Asignar → `CollaboratorAssignmentPanel` → `quote-request-batch` (broadcast; FR=directo) | ✅ (enterrado) |
| 3. Traductor cotiza | `/encargo/[token]` → `submitCollaboratorQuote` → QUOTED + aviso a Juan | ✅ |
| 4. Adjudicar | `select-bid` → ACCEPTED + `applyAcceptedQuoteSideEffects` | ✅ (Fase 1 margen ya hecha) |
| **4-bis. Avisar al cliente** (en proceso + nº jurado) + EN_TRADUCCION | lógica de `/assign` | **❌ FALTA fusionar en el acto de adjudicar (C1)** |
| 5. Precio cliente = coste×(1+margen)+IVA | tab Finanzas | ⚠ coexiste con builder (§7) |
| 6. Presupuesto cliente | `/admin/presupuestos` (Quote + PDF + WhatsApp) | ✅ |
| 7. Cliente paga → marcar pagado | mark-paid / `quote-to-order` | ✅ |
| 8. Traductor entrega | `submitCollaboratorDelivery` → `deliveredFileUrl`/DELIVERED | ✅ |
| 9. Juan revisa + aprueba entrega | — | ❌ FALTA |
| 10. Entrega al cliente | `Order.finalDeliveryFileUrl` (manual, disperso) | ⚠ disparo manual |
| 11. Factura cliente | `ClientInvoice` / `InvoiceManager` | ✅ |
| 12. Gasto/factura traductor | `Expense` | ⚠ solo OrderEvent, NO `Expense` (M3) |

---

## 5. Plan de migración por fases (orden corregido)

**Principio:** nada de big-bang. Cada fase deja el sistema funcional. NO tocar `/encargo/[token]` ni los endpoints que sostienen emails ya enviados.

### Fase 0 — Coherencia de datos + reescritura de links (riesgo BAJO, impacto ALTO)
- **Objetivo:** dejar el dato coherente antes de mover rutas.
- Unificar modelo de precio del builder (§7 b/c) — **verificar sync con `quoteSnapshotJson` (M1)** antes de tocar la estructura de `Quote`.
- **Reescribir los links hardcoded (C3)** a rutas nuevas en código futuro: `sms.ts:157`, `email.ts:78-79,418,449-450,535,787`, `emails/expediente.ts:50`, `auth-callback.ts:3`.
- Mergear `feat/presupuesto-coherente-palabras` (botones de estado ya gateados, §7a).
- **Archivos:** `components/QuickQuotePanel.tsx`, `components/StaffExpedienteIntake.tsx`, `lib/quotes.ts`, `lib/sms.ts`, `lib/email.ts`, `lib/emails/expediente.ts`, `lib/auth-callback.ts`.
- **Riesgo:** bajo (sin mover rutas).

### Fase 1 — FUSIONAR responsabilidades de asignación (riesgo MEDIO, impacto MUY ALTO) — CORREGIDA
- **Objetivo:** que adjudicar (`select-bid`) y el FR-directo **también** avisen al cliente (en proceso + nº jurado) y transicionen a `EN_TRADUCCION`, ANTES de retirar el texto libre.
- **Orden obligatorio (no invertir):**
  1. Extraer la lógica cara-cliente de `assign/route.ts` (resolución `swornNumber`, `sendTranslationStartedAssignedEmail`, transición `EN_TRADUCCION`, `OrderEvent`) a una función reutilizable, p. ej. `lib/orders.ts` → `notifyClientTranslationStarted(order, winner)`. El `Collaborator` ganador ya tiene `swornNumber` (schema:682).
  2. Llamarla desde `select-bid` y desde el FR-directo de `quote-request-batch`, escribiendo también `Order.assignedTo` = nombre del ganador (mantiene Kanban/Cockpit vivos, C2).
  3. SOLO entonces: sustituir el bloque texto-libre de `AdminOrderDetailPanel.tsx:146-174` por `CollaboratorAssignmentPanel` y marcar `/api/orders/[ref]/assign` como deprecated (no borrar el endpoint).
- **Archivos:** `app/api/orders/[reference]/select-bid/route.ts`, `app/api/orders/[reference]/quote-request-batch/route.ts`, `lib/orders.ts`, `lib/collaborators.ts`, `components/AdminOrderDetailPanel.tsx`.
- **Riesgo:** medio (toca notificación al cliente; probar FR-directo y concurso end-to-end con un pedido de prueba).

### Fase 2 — Workspace de pedido único (riesgo MEDIO)
- **Objetivo:** un solo lugar con el hilo completo.
- Crear `/admin/pedidos/[reference]` montando `OrderActionPanel` + `WorkspaceEditor` + `ProjectCockpit`.
- Redirects `/admin/orders/[ref]`, `/zona-traductor/workspace/[ref]`, `/zona-traductor/proyecto/[ref]` → `/admin/pedidos/[ref]` (308, con `:path*` y query preservada).
- Borrar `AdminOrderDetailPanel.tsx` SOLO con el redirect verificado y la Fase 1 cerrada.
- **Archivos:** nuevo `app/admin/pedidos/[reference]/page.tsx`, `components/OrderActionPanel.tsx`, `components/WorkspaceEditor.tsx`, `components/ProjectCockpit.tsx`, `next.config.js`.
- **Riesgo:** medio.

### Fase 3 — Nav única + mover el resto (riesgo MEDIO)
- **Objetivo:** una sola navegación.
- `BackofficeNav.tsx` único; mover facturas/recurrentes/contabilidad → `/admin/facturacion`; métricas/funnel/chat → `/admin/analitica`; tablero → `/admin/tablero`; `verificar` → `/admin/verificar` (A1).
- Tabla de redirects 308 en `next.config.js` para TODAS las rutas viejas, con query preservada (C3).
- **Probar regresión de tema oscuro (M4)** en métricas/funnel/chat.
- Retirar `AdminNav.tsx` + `ZonaTraductorNav.tsx`.
- **Archivos:** nuevo `components/BackofficeNav.tsx`, `app/admin/layout.tsx` (nuevo), rutas movidas, `next.config.js`.
- **Riesgo:** medio.

### Fase 4 — Colaboradores accionable (riesgo BAJO)
- **Objetivo:** pedir cotización desde la ficha.
- En `/admin/colaboradores`: botón "Pedir cotización / mandar doc" → abre `CollaboratorAssignmentPanel` contextualizado.
- **Archivos:** `app/admin/colaboradores/page.tsx`, `components/CollaboratorAssignmentPanel.tsx`.
- **Riesgo:** bajo.

### Fase 5 — Zona scoped del traductor externo (riesgo MEDIO; solo cuando se incorpore alguien)
- **Objetivo:** dashboard con login propio que ve SOLO sus encargos.
- `lib/collaborator-auth.ts` nuevo → `requireCollaboratorAccess()`: **cookie OTP separada** (`collaborator_otp_verified`, NO reusar `staff_otp_verified`, A3), busca `Collaborator` por email, **rechaza emails staff** y viceversa (A2/A3).
- Reconciliar `getStaffRole` (COLLABORATOR antes que ADMIN) con `isStaffEmail` (gate real) para que el gate de owner y el de colaborador sean mutuamente excluyentes (A2).
- `/colaborador` dashboard + `/api/colaborador/*` con `WHERE collaborator.email = sesión` en TODA query (nunca `getAllOrdersForStaff`).
- Serializador que oculta contacto/precio/margen y expone el documento (A4).
- `/encargo/[token]` se mantiene SIEMPRE.
- **No bloquea fases anteriores** (Juan es único usuario hoy).
- **Archivos:** nuevo `lib/collaborator-auth.ts`, `lib/staff-otp.ts` (cookie namespace), `lib/staff-access.ts` (reconciliar), nuevo `app/colaborador/*`, nuevo `app/api/colaborador/*`.
- **Riesgo:** medio (seguridad de aislamiento de sesión).

### Fase 6 — Cerrar lazos (riesgo BAJO-MEDIO) — subir M3 de prioridad
- **Objetivo:** cerrar calidad y contabilidad.
- Paso 9: revisión/aprobación de entrega del traductor antes de mandarla al cliente.
- Paso 10: botón "Entregar al cliente" en el workspace.
- **Paso 12 (subir prioridad, M3):** `CollaboratorAssignment` aceptada → crear registro `Expense` real (hoy solo `OrderEvent`). Contabilidad de proveedores incompleta mientras no se cierre; relevante por el incidente del "doc ruso" y la deuda P2 de reconciliación.
- **Archivos:** `lib/collaborators.ts` (`applyAcceptedQuoteSideEffects` → `Expense`), `app/admin/pedidos/[reference]/page.tsx`, `components/OrderActionPanel.tsx`.
- **Riesgo:** bajo-medio.

### M2 — Captación por WhatsApp / lead manual (transversal, encajar en Fase 2)
La captación principal de Juan es WhatsApp y el flujo del workspace arranca hoy en "puerta web". Añadir una entrada de **lead/pedido manual** (un mensaje de WhatsApp → `Order`) en `/admin/bandeja` o como acción "Nuevo pedido". Sin esto, el "hilo completo" no cubre el principal punto de entrada real.

---

## 6. Modelo de roles objetivo

```
OWNER (Juan + futuros internos)         COLLABORATOR (traductor externo)
─────────────────────────────────       ──────────────────────────────────
Acceso: NextAuth + OTP staff            Acceso: OTP propio, cookie SEPARADA
Fuente: isStaffEmail() / env            Fuente: tabla Collaborator (email único)
Datos: TODO el negocio                  Datos: WHERE collaborator.email = sesión
Rutas: /admin/*                         Rutas: /colaborador/* + /encargo/[token]
Roles internos: ADMIN/PM vs STAFF       (sin role nuevo; basta email + active)
```

Reconciliación obligatoria (A2/A3): `getStaffRole` evalúa COLLABORATOR antes que ADMIN/PM/STAFF y discrepa de `isStaffEmail` (que es el gate real binario). Antes de la Fase 5: garantizar que un email no pueda satisfacer ambos gates, y blindar contra auto-lockout de Juan (opera con `juansilva@`, `hola@`, etc.).

---

## 7. Deuda concreta encajada en fases (Fase 0/1)

- **(a) Botones de estado del presupuesto gateados** — ✅ hecho en `feat/presupuesto-coherente-palabras` (sin merge). `AdminQuoteDetailPanel` solo muestra transiciones válidas de `QUOTE_TRANSITIONS`. → **Fase 0 (merge).**
- **(b) QuickQuotePanel vs StaffExpedienteIntake con modelo de precio distinto** → **Fase 0.** `QuickQuotePanel.tsx:29-35` usa `unitPrice` = precio cliente directo, sin `supplierUnitCost` (margen invisible). `StaffExpedienteIntake.tsx:254-259` usa `unitPrice = coste×(1+margen)` con `supplierUnitCost`. Fix: ambos escriben la misma estructura (coste + margen) en `Quote`; "rápido" = un campo coste + margen prerrelleno, "detallado" = tabla por documento. **Verificar `quoteSnapshotJson` (M1).**
- **(c) Precio por palabras vs por documento** → **Fase 0.** En `StaffExpedienteIntake`, toggle por línea: por palabras (`words × €/palabra`, `words` ya viene del análisis IA) o por documento (fijo).
- **(d) "Asignar" texto libre** → **Fase 1 CORREGIDA.** NO es código muerto (C1). Se FUSIONA su lógica cara-cliente en `select-bid` + FR-directo, manteniendo `Order.assignedTo` poblado (C2), y solo después se retira de la UI dejando el endpoint deprecated.

---

## 8. Archivos clave (referencia de ejecución)

- **Nav:** `components/AdminNav.tsx`, `components/ZonaTraductorNav.tsx` → nuevo `components/BackofficeNav.tsx`; nuevo `app/admin/layout.tsx`.
- **Pedido:** `components/AdminOrderDetailPanel.tsx` (eliminar tras Fase 1), `components/OrderActionPanel.tsx` (base), `components/CollaboratorAssignmentPanel.tsx`, `components/WorkspaceEditor.tsx`, `components/ProjectCockpit.tsx`, `components/KanbanBoard.tsx`.
- **Asignación (FUSIONAR, no borrar):** `app/api/orders/[reference]/assign/route.ts` (extraer lógica cliente → deprecar), `app/api/orders/[reference]/select-bid/route.ts`, `app/api/orders/[reference]/quote-request-batch/route.ts`, `lib/orders.ts`, `lib/collaborators.ts`, `lib/translators.ts`.
- **Presupuestos:** `components/QuickQuotePanel.tsx`, `components/StaffExpedienteIntake.tsx`, `lib/quotes.ts`, `lib/quote-to-order.ts`; revisar `quoteSnapshotJson` en `lib/orders.ts`, `lib/order-actions.ts`, `components/OrderActionPanel.tsx`, `components/BandejaEntrada.tsx`.
- **Links hardcoded (C3):** `lib/sms.ts:157`, `lib/email.ts:78-79,418,449-450,535,787`, `lib/emails/expediente.ts:50`, `lib/auth-callback.ts:3`.
- **Auth/roles:** `lib/staff-access.ts`, `lib/staff-otp.ts` (cookie), `lib/zona-traductor-data.ts`, `lib/admin-page-access.ts` → nuevo `lib/collaborator-auth.ts`.
- **Contabilidad (M3):** `lib/collaborators.ts` (`applyAcceptedQuoteSideEffects` → `Expense`), `prisma/schema.prisma` (`model Expense`).
- **Intocable:** `app/encargo/[token]/*`, `app/api/encargo/[token]/*`.
- **Redirects:** `next.config.js` (308, `:path*`, query preservada).

---

## 9. Checklist de arranque para la próxima sesión

1. `bash scripts/project-map.sh` (protocolo obligatorio).
2. Mergear `feat/presupuesto-coherente-palabras`.
3. Empezar por **Fase 0** (coherencia + links) → **Fase 1 corregida** (fusionar asignación, NO borrar) con un pedido de prueba FR y uno de concurso end-to-end.
4. No avanzar a Fase 2 hasta confirmar que el cliente recibe "en proceso" + nº jurado desde `select-bid` y desde el FR-directo.
5. `npm run build` + checklist en dev tras cada fase.
