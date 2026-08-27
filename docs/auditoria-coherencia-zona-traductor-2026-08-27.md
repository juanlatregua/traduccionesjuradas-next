# Auditoría de coherencia — zona traductor (27-ago-2026)

Pregunta única: ¿se puede enseñar el backoffice a un jurado de lavori como suite de presupuestos/pedidos/facturas sin explicarle nada?
Agente guardian-flujos (solo lectura) sobre `main` (c36f0e3 + fb0aca5). Números de línea = ese estado del repo.

## Rutas verificadas (27-ago-2026)
✓ `components/AdminNav.tsx` · ✓ `components/ZonaTraductorNav.tsx` · ✓ `components/ZonaTraductorSubNav.tsx` · ✓ `app/zona-traductor/layout.tsx` (no existe `app/admin/layout.tsx`)
✓ `app/admin/quotes/{page,new/page,[id]/page,[id]/editar/page}.tsx` · ✓ `app/admin/orders/{page,[reference]/page}.tsx` (redirect) · ✓ `app/admin/{inbox,collaborators,metricas,funnel,chat}/page.tsx`
✓ `app/zona-traductor/{page,presupuestos,presupuesto,expedientes,facturas,clientes,clientes/[email],pedido/[reference],periodos,ajustes,verificar}/page.tsx` · ✓ `control`, `tablero`, `proyecto/[reference]` ya son redirect; `workspace/[reference]` sigue vivo
✓ `components/{AdminQuoteDetailPanel,QuoteRowActions,QuoteEditForm,StaffExpedienteIntake,AdminOrdersList,AdminInboxPanel,BandejaEntrada,PMQuickCreatePanel,InvoiceManager,OrderTableWithBulkActions,TranslatorAgenda,ZonaTraductorThemeToggle}.tsx` · ✓ `components/order-workspace/{OrderStepper,OrderManagementActions}.tsx`
✓ `lib/{quotes,quote-messages,quote-serializer,workflow,order-actions,vigia,zona-traductor-data,admin-page-access,email}.ts` · ✓ `lib/i18n/area-cliente.ts` · ✓ `prisma/schema.prisma` (QuoteStatus:39-48, ClientInvoice.docKind:213, LavoriPriceRequest:802-828)

## Veredicto
**NO es vendible tal cual.** El ciclo central (lista → ficha → editar → volver) del presupuesto cruza de cáscara en los dos sentidos y la ficha no tiene nav: el traductor de lavori vería dos productos distintos en una misma sesión.
Tres cosas llamadas "presupuesto" con tres numeraciones y tres juegos de estados en la misma pantalla; el origen (puerta → solicitud lavori → presupuesto) se pierde en cuanto la solicitud queda atada.
Lo bueno: el pedido ya tiene UN detalle canónico y casi todo existe como componente; es mover y reenlazar, no construir.

## Las dos cáscaras
| | `/admin/*` (clara) | `/zona-traductor/*` (oscura) |
|---|---|---|
| Nav | Bandeja · Presupuestos · Pedidos · Métricas v2 · Funnel · Colaboradores · Chat AI | Pedidos · Presupuestos · Clientes · Facturas · Contabilidad · Ajustes |
| Lista | `/admin/quotes` (solo Quote; Eliminados; No aceptado) | `/zona-traductor/presupuestos` (solicitudes lavori + Quote + facturas docKind=quote; sin filtrar borrados) |
| Crear | `/admin/quotes/new` → redirige a la oscura | `/zona-traductor/presupuesto`; al crear salta a la clara |
| Ficha/editar | `/admin/quotes/[id]`, `/editar` — sin nav | no existe; «Abrir» cruza |
| Volver | → `/admin/quotes` | — |

## BLOQUE 1 — ALTA
**1.1 La ficha vive en la otra cáscara y sin menú.** Evidencia: `zona-traductor/presupuestos/page.tsx:291` (`/admin/quotes/${id}`); `admin/quotes/[id]/page.tsx:35` «Volver» → `/admin/quotes`; ficha y `/editar` sin nav; `QuoteEditForm.tsx:145` y `StaffExpedienteIntake.tsx:838` saltan a la clara. Entradas cruzadas desde oscuro: `pedido/[reference]/page.tsx:401`, `order-workspace/OrderManagementActions.tsx:157`, `clientes/[email]/page.tsx:257,280`, `periodos/page.tsx:160`, `AdminInboxPanel.tsx:225`, `QuoteRowActions.tsx:52`, `lib/email.ts:124`. Cambio: crear `app/zona-traductor/presupuestos/[id]/page.tsx` y `/[id]/editar/page.tsx` con los mismos `AdminQuoteDetailPanel` y `QuoteEditForm` (repintar); `/admin/quotes/[id]` y `/editar` → redirect; «Volver» → `/zona-traductor/presupuestos`; corregir los 10 href.
**1.2 Todas las acciones están en la clara.** Lista oscura solo Ver PDF / Detalle / Pedido (`presupuestos/page.tsx:283-305`); clara: Abrir / No aceptado / Eliminar / Restaurar (`QuoteRowActions.tsx:40-90`), Eliminados (`admin/quotes/page.tsx:106-107`); ficha clara: enviar/reenviar/pagado/en curso/entregado/no aceptado/recibo/WhatsApp/idioma PDF (`AdminQuoteDetailPanel.tsx:261-399`). Lista oscura no filtra `deletedAt` (`:46`) y pinta "Eliminado" (`:236`) sin restaurar. Cambio: `QuoteRowActions` en la oscura + `deletedAt: null` + `?view=deleted`; `/admin/quotes` → redirect.
**1.3 Tres "presupuestos".** `LavoriPriceRequest` (`presupuestos/page.tsx:169-213`, `LEAD-…`, SENT|PRICED|ACCEPTED, schema:812), `Quote` (8 estados), `ClientInvoice docKind="quote"` (`:311-370`, serie P·AA_NNN, `InvoiceManager.tsx:478`, `lib/invoice-pdf`). Cambio: quitar creación de `docKind=quote` (`InvoiceManager.tsx:476-480`), existentes solo lectura en "Histórico"; la solicitud lavori = etapa Solicitud del mismo listado.
**1.4 Saltos ciegos de origen.** (a) Puerta sin listado; `?session=` solo por email/vigía (`lib/funnel-digest.ts`, `lib/vigia.ts`, `api/puerta/request-quote`). (b) Lista solo `quoteId: null` (`:94`) → al atarse desaparece; la ficha no menciona solicitud/traductor/precio/plazo (`AdminQuoteDetailPanel.tsx` sin lavori|lead|coste; serializer solo `supplierUnitCost`). (c) Quote → Pedido OK (`:523`); Pedido → Quote cruza. (d) Pedido → Factura va a la lista (`pedido/[reference]/page.tsx:648`); `ClientInvoice` sin `quoteId`. (e) Bandeja → Quote sí; Quote → Bandeja no. Cambio: sección **Origen** en la ficha desde `getQuoteByIdForAdmin` (`lib/quote-db.ts`) + `lavoriPriceRequest.findFirst({ quoteId })`; `OrderFinancePanel` → factura concreta.

## BLOQUE 2 — MEDIA
| Concepto | Dónde | Discrepancia |
|---|---|---|
| Quote EXPIRED | `lib/quotes.ts:69`, `AdminQuoteDetailPanel.tsx:89`, `area-cliente.ts:300`, `presupuestos/page.tsx:234` | "Expirado"; "No aceptado" solo con `lostReason` y solo en la clara; email "Presupuesto expirado" (`quote-messages.ts:160`) |
| Quote IN_PROGRESS | `lib/quotes.ts:67` vs `area-cliente.ts:299` | "En progreso" vs "En proceso"; `statusLabel` duplicado `AdminQuoteDetailPanel.tsx:80-92` |
| Cliente | `app/q/[token]/page.tsx:178` | ve mapa interno (Borrador/En progreso/Expirado) → usar `area-cliente.quoteStatus` |
| Pedido | `AdminOrdersList.tsx:36-40,269`, `OrderTableWithBulkActions.tsx:64-66`, `lib/workflow.ts:147-155`, `area-cliente.ts:289`, `OrderStepper.tsx:11-17`, `TranslatorAgenda.tsx:31-38` | 4 familias; "PAID" en inglés; "Traducido entregado" vs "Traducido y entregado"; badge "Presupuesto" en pagados |
| Solicitud lavori | `presupuestos/page.tsx:181-189` vs `lib/vigia.ts:261` | unificar: Solicitud enviada / Con precio / Aceptada |
- `/admin/orders` duplica Pedidos + salto doble (`AdminOrdersList.tsx:290`). `PMQuickCreatePanel.tsx:118`, `BandejaEntrada.tsx:136` → `/admin/quotes/new` (redirect) → apuntar al builder.
- Sin equivalente oscuro: inbox (`ZonaTraductorNav.tsx:91`), collaborators (ya oscuro dentro de la clara: `admin/collaborators/page.tsx:22-26`), metricas, funnel, chat.
- Dos puertas OTP misma cookie: `lib/admin-page-access.ts:16` → `/acceso`; `lib/zona-traductor-data.ts:503,509` → `/zona-traductor/verificar`.
- Builder «← Expedientes» fijo (`presupuesto/page.tsx:132`). Badge "Presupuestos" del nav = DRAFT + expedientes (`zona-traductor-data.ts:550-556`), no PRICED sin quote.

## BLOQUE 3 — BAJA
- `ZonaTraductorThemeToggle` (`zona-traductor/page.tsx:13`) sobra con cáscara única.
- Jerga interna: "Flujo WhatsApp… `src=wa`" (`zona-traductor/page.tsx:163-181`); "neto 75/25 sugerido" (`presupuestos/page.tsx:195`).
- `workspace/[reference]` accesible; `as any` en `admin/quotes/[id]/page.tsx:43`, `orders: any` en `AdminQuoteDetailPanel.tsx:520`.

## Plan por sesiones
**S1 — Presupuesto en una cáscara (sin dependencias).** `/zona-traductor/presupuestos/[id]` y `/[id]/editar` reusando `AdminQuoteDetailPanel` + `QuoteEditForm` (repintar); `QuoteRowActions` + filtro `deletedAt` + Eliminados en la oscura; `/admin/quotes`, `/[id]`, `/[id]/editar` → redirect; 10 href de 1.1 + `lib/email.ts:124`; builder vuelve a la lista oscura (o `?back=`); badge nav suma PRICED sin quote.
**S2 — Un concepto (depende de S1).** Sección Origen (1.4); solicitudes como etapa Solicitud (incluidas atadas, plegadas); congelar `docKind=quote`; borrar `statusLabel` duplicado; `EXPIRED="No aceptado"`, `IN_PROGRESS="En proceso"`; `/q/[token]` con mapa cliente; email `quote-messages.ts:160`.
**S3 — Pedidos y factura (independiente de S2).** `/admin/orders` → redirect a `/zona-traductor?vista=tabla` tras comprobar filtros y `/api/orders/export` en `ZonaTraductorFilters`/`OrderTableWithBulkActions`; un mapa de estados staff; `OrderFinancePanel` → factura concreta; retirar badge "Presupuesto" en pagados.
**S4 — Resto de /admin.** inbox → `/zona-traductor/bandeja` primera pestaña; collaborators → Ajustes; metricas/funnel/chat → Ajustes → Métricas; borrar `AdminNav`, `ThemeToggle`, `workspace/[reference]`; `/acceso` → redirect a `/verificar`. Regla: `grep -rn '"/admin/' app components lib` = 0 salvo redirects.

## AL TERMINAR — build + checklist en dev
`npm run build` · `npx tsc --noEmit --skipLibCheck` · `npm run test:unit`.
1. Presupuestos → ficha → Editar → Guardar → Volver aterriza en la lista oscura con la misma nav.
2. Crear desde builder (manual, `?lead=`, `?exp=`, `?session=`) → ficha oscura con sección Origen.
3. Pedido ↔ Presupuesto ↔ Factura ida y vuelta sin cambiar de tema.
4. No aceptado / Eliminar / Restaurar desde la lista oscura.
5. `/admin/quotes`, `/admin/orders`, `/admin/quotes/[id]` responden 307 a la zona.
6. `grep -rn "AdminNav" components app` = 0.
7. `/q/[token]` y área cliente enseñan "No aceptado"/"En proceso", nunca "Borrador".

## Hecho el mismo día, fuera del plan
- fb0aca5: documentos de un lead automático de la puerta (`expedienteRef puerta:<token>`) entran en el builder.
- df5cb6d: `Quote.deliveryTerm` (plazo en bloque Entrega de PDF/q/ficha/WhatsApp, editable; backfill 44), transferencias con BIC + direcciones desde `PAYMENT_ACCOUNTS`, sección «Documentos del cliente» en la ficha.
