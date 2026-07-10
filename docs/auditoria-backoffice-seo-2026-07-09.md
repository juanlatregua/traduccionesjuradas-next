# Auditoría backoffice + SEO/AEO — 2026-07-09

**Método:** 4 agentes READ-ONLY en paralelo (guardián de flujos, seguridad, datos huérfanos, seo-aeo) + análisis de exports GSC (Coverage + Performance, 8-abr→7-jul) + verificación manual de los hallazgos más graves (traductor/notificar, order-reminders, HCCH). Nadie editó durante el barrido.

**Veredicto global: APRUEBA CON CAMBIOS.** El esqueleto de chokepoints (pago, creación de pedidos, facturación) aguanta — todos los cobros pasan por `updateOrderPayment`, sin fugas contables, y **cero P0 de seguridad** (gates de intermediario, OTP, admin, webhooks con firma: presentes). Las fugas reales: documentos sin fuente única, un carril de entrega sin guardas, la serie fiscal sin tipo de documento, y 3 UIs de pedido + 2 de quote que obligan a cablear cada mejora varias veces.

**Ya ejecutado en esta misma sesión (no entra en el plan):** merge #147 (3 posts FR de 308→200, falta reindexar en GSC — Juan) · Argelia→apostilla verificada HCCH y desplegada (hcch-table + chatbot + 6 páginas de contenido, commit `67a2def`).

---

## BLOQUE P0 — rompe el flujo de negocio o corrompe datos

### P0-1 · Funnel: pedido pagado con documento invisible (raíz del incidente Josué TJ-20260708-62ZI)
`createOrderFromSession` (`lib/orders.ts:138-188`) no emite `order.source_document_uploaded` ni crea `OrderDocumentItem`; solo enlaza `DocumentAnalysis.orderId`, que **ninguna pantalla de trabajo lee**. Todas las vistas (cockpit `pedido/[reference]/page.tsx:33`, colaborador `lib/collaborators.ts:355`, admin) leen SOLO eventos + documentItems. Cada pedido del funnel repite el fallo: cobras y el traductor no ve qué traducir.

**Fix (punto exacto):** en `lib/orders.ts:189`, junto a `linkDocumentAnalysesToOrder`, añadir `wireSessionDocsToOrder(order.id, docs)` que (1) cree `OrderDocumentItem` por doc (misma forma que `populateOrderItemsFromQuote`, `lib/orders.ts:248-259`) y (2) emita el evento `order.source_document_uploaded` (mismo payload que `app/api/orders/[reference]/documents/route.ts:151-165`, el único emisor legítimo hoy). Idempotente por `fileUrl` (el webhook reintenta). Los `docs: OrderDocument[]` ya llegan con `fileUrl/filename/mimeType/detectedType/sourceLang/targetLang/quotedCents`.

**Cierra también P1-3:** aplicar el mismo emisor de evento en `populateOrderItemsFromQuote` (`lib/orders.ts:240`) — hoy los pedidos nacidos de presupuesto crean `OrderDocumentItem` pero NO el evento, así que **el colaborador externo no ve los documentos por su enlace `/encargo/[token]`** (solo lee eventos).

### P0-2 · `/api/traductor/notificar`: carril de entrega paralelo sin guardas
`app/api/traductor/notificar/route.ts` (verificado línea a línea): exige staff ✓, pero acepta `clientEmail` y `downloadUrl` **arbitrarios del body** (líneas 47-51), no comprueba `paymentStatus` y no pasa por `updateDeliveryState`/`transitionWorkflowState` (solo registra un evento de notificación). El carril canónico sí exige PAID (`app/api/orders/[reference]/delivery/route.ts:77`). Lo expone `TranslatorNotifyForm` en la Bandeja (`OrderActionPanel.tsx:477`).

**Riesgo:** enviar la jurada adjunta a un impago con un clic, y el pedido queda sin entregar en el sistema (la Bandeja lo sigue mostrando accionable). **Fix:** delegar en `/delivery` o eliminar el formulario.

### P0-3 · Serie fiscal AA_NNN sin tipo de documento
`ClientInvoice` no distingue factura de presupuesto (`prisma/schema.prisma:200-235`); contabilidad suma todos los `ISSUED` (`app/zona-traductor/contabilidad/page.tsx:23-24`). Los presupuestos emitidos como ClientInvoice (26_011/030/033/041/045 + colisión 26_010) contaminan facturado/303/export gestoría — **ya ha exigido reajuste manual dos trimestres seguidos**.

**Fix (antes del cierre 3T, ~sept):** campo `docKind` (invoice|quote) con migración aditiva + filtro en contabilidad/exports, o dejar de emitir presupuestos por el módulo de facturas (para eso está Quote + `buildQuotePdfBuffer`). Decisión de Juan.

---

## BLOQUE P1 — incoherencias y duplicaciones reales

### Flujos
- **P1-4 · Quote ↔ Order sin sincronía de estado:** entregar por el pedido deja el Quote en PAID para siempre (`mark-delivered` solo sella Quote; `updateDeliveryState` solo Order). Colgar la sincronía inversa en el flujo de entrega (Order entregado → Quote DELIVERED).
- **P1-5 · Dos botones "aceptar cotización" con efectos distintos en el MISMO panel:** `select-bid` transiciona EN_TRADUCCION y avisa al cliente; `collaborator-assignment accept` NO (`CollaboratorAssignmentPanel.tsx:172` vs `:252`). Según el botón, el cliente se entera o no. Converger en una función.
- **P1-14 · Alerta staff de recordatorios de cobro muere en silencio:** `order-reminders/route.ts` llama `sendSMS({channel:"whatsapp"})` directo; sin `TWILIO_WHATSAPP_FROM` devuelve `{ok:false}` que se descarta sin log (verificado: el try/catch solo caza throws). Usar `sendNotification` (fallback WA→SMS) o `sendStaffAlertSMS`.

### Duplicaciones de UI (cablear todo ×3)
- **P1-8 · Tres UIs de gestión del mismo pedido:** `OrderActionPanel` en Bandeja (840 líneas) vs detalle `/zona-traductor/pedido/[ref]` vs `/admin/orders/[ref]` (`AdminOrderDetailPanel`). Ya divergen (P1-5, P1-6). Dirección: Bandeja = lista + enlace al detalle canónico; admin redirige.
- **P1-9 · Carril huérfano `tablero`+`proyecto`:** tercer detalle de pedido (`ProjectCockpit`) alcanzable solo desde un tablero que no está en la nav. Candidato a redirect (patrón `/admin/quotes/new`).
- **P1-10 · Presupuestos partidos entre temas:** builder en zona-traductor (oscuro) → gestión en `/admin/quotes` (claro, otra nav). El builder incluso salta con `window.location.href` (`StaffExpedienteIntake.tsx:548`). Unificar pestaña y tema.
- **P1-6 · Dos endpoints+emails+formularios para "mensaje libre al cliente":** `send-client-message` vs `notify-custom`. Fusionar en `notify-custom` (ya soporta adjuntos).
- **P1-7 · Parser "documentos desde eventos" copiado 4 veces** (cockpit, workspace, área cliente, collaborators). Es el mecanismo que falló en P0-1: un helper único en `lib/`.

### Gates
- **P1-12 · Tres gates staff con exigencias distintas:** zona-traductor exige sesión+OTP; `/admin` y TODAS las mutaciones (`requireStaffAccess`) aceptan sesión Google sola → el OTP es teatro que solo añade fricción. Unificar en un gate.
- **P1-13 · Emitir factura (consume numeración fiscal) menos protegido que marcar cobrada:** `invoices/[id]/issue` acepta cualquier staff; `paid` exige ADMIN/PM. Misma regla en todo el módulo.

### Seguridad (sin P0; deuda principal)
- **P1-S1 · Blobs Vercel públicos con PII** — inventario completo de los 7 puntos de subida (`entrega/[token]/upload:89`, `payment-proof:162`, `documents:144`, `upload:108`, funnel, traduccion-automatica:226, `quote-pdf:270`). Quien tenga la URL descarga PII sin sesión, para siempre. Mitigar con `access:"private"` + URL firmada corta. (Deuda RGPD conocida, ahora con mapa.)

---

## BLOQUE P2 — fricción, pulido y endurecimiento

- **P2-1 seg ·** `getClientIp` confía en `x-forwarded-for[0]` spoofable → bypass de rate-limits por IP. Usar `x-vercel-forwarded-for`.
- **P2-2 seg ·** `documents/register` acepta `blobUrl` externo sin validar host propio (SSRF suave/envenenamiento). Validar prefijo del blobstore.
- **P2-3 seg ·** `documents/upload` público a blob público con gate trivial (`gdprConsent` del propio cliente) → abuso de almacenamiento. Token de sesión de funnel.
- **P2-4 seg ·** scoping de área cliente por email sensible a mayúsculas (falla cerrado, pero inconsistente — lowercasear).
- **P2-15 ·** Historial de comunicación partido: `MessageLog` (presupuesto) vs `OrderEvent` (pedido) — la conversación pre-pago desaparece de la vista del pedido.
- **P2-16 ·** `mark-delivered` registra la entrega como `type:"PAID_CONFIRMATION"` — datos que mienten.
- **P2-17 ·** Dos pantallas cliente para el mismo pedido (`/pedido/[ref]` con token vs `/area-cliente/pedido/[ref]` con sesión): dos auth defendible, dos implementaciones no. Extraer vista compartida.
- **P2-18 ·** `countWords` propio en el estimador vs `billableWordCount` (sin el flag bilingüe ÷2) → dos precios para el mismo PDF según la puerta.
- **P2-19 ·** Deep-links al workspace legado en emails vivos (`lib/email.ts:749`, `collaborator-emails.ts:270`) — apuntarán a la pantalla equivocada cuando se consolide.
- **P2-20 ·** `customers/deliver` no deja ficha documental (aceptable para entrega directa; documentarlo).

---

## SEO/AEO — estado y quick wins (con datos GSC 9-jul)

**GSC 3 meses:** 142 clics / 23.928 impr / CTR 0,59%. Indexadas ×2 (42→86). Impresiones crecen (6,2k→9,3k/mes), clics planos. España pos 36,7 CTR 0,54% vs Marruecos/NL/CH/BE pos 7-9 CTR 1,5-16%. Motor: blog (marroquíes 44 clics = ⅓ del total).

**Infra sana:** bots de cita abiertos ✓ · JSON-LD server-side global ✓ · párrafos AEO en las 10 landings de idioma ✓ · lector de requerimientos live ✓ · chatbot con tool-use+visión (roadmap A hecho) ✓ · RAG (B) e IA-producto (C) sin arrancar (a propósito).

**Quick wins [S] por orden:**
1. **Server-side los 2 schemas `afterInteractive`** (`app/preguntas-frecuentes/page.tsx:20-23` FAQPage, `app/traductores-jurados/page.tsx:28-31` Person) — hoy invisibles para bots de IA sin JS (verificado con curl).
2. **`/traducciones-juradas-baratas`: precio en la primera frase + title con 35€.** Cluster "baratas" ~750 impr pos 9-20 con 0 clics = la conversión más barata disponible.
3. **`homologacion-titulo-universitario.mdx`: añadir `faq:` frontmatter** (mecanismo FAQPage ya cableado) + párrafo-respuesta + 2-3 enlaces internos. 2.242 impr pos 21.
4. **Actualizar `public/llms.txt`:** faltan 12 posts y las 10 landings de idioma; re-fechar Argelia (en vigor desde hoy) y la verificación HCCH.

**[M]:** diferenciar la landing de **neerlandés** (3.021 impr pos 58, mayor demanda desatendida): contenido específico NL (uittreksel BRP, VOG, diplomas) + post de apoyo del cluster. Replicar en sueco (~850 impr)/rumano solo si responde.

**Descartado:** schema WebPage+dateModified standalone (ROI bajo) · RAG ahora (esfuerzo L sin evidencia de cuello de botella).

---

## Lo que está BIEN (no tocar)

- Pago: chokepoint único `updateOrderPayment`/`confirmManualPaymentWithSideEffects`; puente `runQuoteToOrderBridge` con exactamente 2 callers correctos. **Sin fugas contables.**
- `createOrder` es chokepoint real de creación; facturación siempre por `lib/client-invoice`.
- Seguridad: portal intermediario gate ✓, webhooks con firma ✓, suelo de precio server-side ✓, comprobante NO auto-marca PAID ✓, `dev-bypass` limitado a development ✓.
- `/admin/quotes/new` ya es redirect al builder — el patrón a repetir.

## Plan de ataque sugerido (sesiones con modelo barato)

1. **Sesión fixes-1 (P0 operativos):** P0-1 funnel wire + evento en `populateOrderItemsFromQuote` (cierra P1-3) + P0-2 notificar→delegar en /delivery + P1-14 sendNotification. *Pedir antes el OK de Juan al arreglo del funnel (ya pendiente desde 8-jul).*
2. **Sesión fixes-2 (SEO/AEO S):** los 4 quick wins + reindexación GSC de los 3 posts FR (Juan).
3. **Sesión fiscal (antes del 3T):** P0-3 `docKind` — necesita decisión de Juan (campo vs dejar de emitir presupuestos como ClientInvoice).
4. **Sesión consolidación UI (la grande):** P1-8/9/10/11 + P1-6/7 — un solo detalle de pedido, redirects para tablero/proyecto/admin-orders, mensajes unificados, parser único.
5. **Backlog:** P1-12/13 gates, P1-S1 blobs privados (RGPD), P2 seg, neerlandés [M].
