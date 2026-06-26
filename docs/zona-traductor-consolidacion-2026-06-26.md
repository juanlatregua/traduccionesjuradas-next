# Consolidación zona-traductor — plano único (2026-06-26)

Mapa verificado contra el código (workflow `mapa-completo-zona-traductor`). Fuente de verdad para la unificación.

## El problema
La misma tabla `Order` se ve de **6 formas**:
- **3 LISTAS**: Bandeja (`/zona-traductor`), Tablero/Kanban (`/tablero`), Control (`/control`).
- **3 DETALLES**: Landing (`/pedido/[ref]`), Workspace (`/workspace/[ref]`), Cockpit (`/proyecto/[ref]`).

Cada lista abre un detalle distinto: Bandeja→/pedido, Tablero→/proyecto, Control→/workspace. Por eso se pierde el hilo.

## El objetivo
- **UNA lista** = Bandeja (ya decidido en `ZonaTraductorNav`).
- **UN detalle** = Landing `/zona-traductor/pedido/[reference]` (la única con menú).
- Flujo: **Lista → Abrir → Landing → (todo ahí) → vuelta a la Lista.**

## La Landing debe absorber primero (todos los endpoints YA existen)
Del **Cockpit** (gestión): avanzar workflow, emitir factura, notificar envío postal, margen (ingreso − coste colaborador), desglose por documento, cobro WhatsApp/Bizum, enlace al presupuesto.
Del **Workspace** (producción): BORRADOR IA + descarga DOCX jurado, editor 2-columnas + autosave + checklist, subir documento fuente, visor del original/entrega.

## Regla de oro
**Ninguna pantalla se retira sin redirect 308** — hay 4 enlaces congelados en SMS/email del inbox de Juan:
- `lib/sms.ts:162` y `lib/collaborator-emails.ts:86` → `/control?q=ref`
- `lib/collaborator-emails.ts:270` y `lib/email.ts:696` → `/workspace/[ref]`

**La contabilidad NO se toca**: vínculo Order→factura estructural (FK `orderId @unique` + barrido `listPaidUnbilledOrders`).

## Pasos (orden por riesgo)
1. **BAJO** — Landing: bloque Finanzas con margen (getFinanceSnapshot ya importado) + enlace al Quote + CTA cobro WhatsApp. *(aditivo)*
2. **BAJO** — Landing: subir documento fuente (`POST /documents`). *(aditivo)*
3. **BAJO** — Retirar Tablero → redirect 308 a Bandeja. *(duplicado puro, sin enlaces inbox)*
4. **MEDIO** — Migrar GESTIÓN a Landing: avanzar workflow (`/workflow` vía `transitionWorkflowState`), emitir factura (`issueInvoice`), notify-shipment, document-items.
5. **MEDIO** — Retirar Cockpit → redirect a Landing.
6. **MEDIO-ALTO** — Migrar PRODUCCIÓN a Landing: WorkspaceEditor (2-col + autosave) + DraftGenerator (borrador IA + DOCX). Unificar visor con FileThumbnails.
7. **ALTO** — Retirar Workspace → repuntar `email.ts:696` + `collaborator-emails.ts:270` + internos + redirect 308.
8. **MÁS ALTO** — Retirar Control → repuntar `sms.ts:162` + `collaborator-emails.ts:86`; KPIs/agenda/bulk como panel resumen read-only (no segunda lista); redirect 308 preservando `?q`.
9. **BAJO** — (opcional) unificar auth de la Landing a `authZonaTraductorOrRedirect`.

## Enlaces internos a repuntar → `/pedido/[ref]`
`OrderActionPanel.tsx:461,577,601,789` · `OrderTableWithBulkActions.tsx:285` · `CollaboratorAssignmentPanel.tsx:526` · `KanbanBoard.tsx:198` · `ProjectCockpit.tsx:161,220`
