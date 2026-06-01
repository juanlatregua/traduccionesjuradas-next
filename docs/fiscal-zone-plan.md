I have verified all the critical claims. Key confirmations:
- `issueOrUpdateInvoice` upsert `update` path does NOT set `issuedAt`, recalculates totals from gross, ignores `lineItemsJson` — confirms B2.1/A2.4.
- `issueInvoice(id)` accepts `opts.number` but NOT `issuedAt`, seals with `new Date()` — confirms the contradiction.
- `suggestNextInvoiceNumber()` has no `brand` filter — confirms transversal serie defect.
- `contabilidad/page.tsx:20` queries `{ status: "ISSUED" }` with no brand filter — confirms B2.2/B7.2.
- `authZonaTraductorOrRedirect(): Promise<string>` returns email — so role gating in the server page is resolvable.
- Upload route: prefix logic at line 62, only uses `reference`. No existing `prefix` field — confirms A5.x retrocompat.
- 7 tabs in nav confirmed. `vercel.json` crons confirmed.

I have everything. Now writing the consolidated plan.

---

# Plan de implementación consolidado — Módulo facturación HBTJ S.L.

Consolida SPEC #2 (Conciliación pedidos↔facturas), SPEC #7 (Facturas recurrentes Oracle) y SPEC #5 (Gastos completos), incorporando las correcciones de la revisión fiscal y la de correctness. Orden de implementación: **#2 → #7 → #5**.

Todas las rutas verificadas contra el repo el 2026-06-01. Hechos confirmados en código que cambian el plan respecto a los specs originales:
- `lib/client-invoice.ts` `issueOrUpdateInvoice`: el `update` del `upsert` **no** sella `issuedAt` y recalcula `baseCents/vatCents/totalCents` desde `totalsFromGross(amountCents, 0.21)` **sin tocar `lineItemsJson`**.
- `issueInvoice(id, {number})` sella con `new Date()` y **no** acepta `issuedAt`.
- `suggestNextInvoiceNumber()` NO filtra por `brand` (serie única global `26_NNN`).
- `app/zona-traductor/contabilidad/page.tsx:20` agrega `ClientInvoice status:ISSUED` **sin filtrar `brand`** → hoy las facturas `holabonjour` ya se suman al 303 de `traduccionesjuradas`.
- `authZonaTraductorOrRedirect(): Promise<string>` devuelve el email → el gating ADMIN/PM en el server page es viable.
- `app/api/upload/route.ts:62`: `prefix = reference ? "orders/${reference}" : "uploads"`; ningún caller envía `prefix` hoy.

---

## ⚠ DECISIONES DE JUAN — RESOLVER ANTES DE TOCAR CÓDIGO (bloqueantes transversales)

Estas tres preceden a cualquier commit. Las dos primeras bloquean #2 y #7; la tercera condiciona el alcance de #5.

- **⚠ D1 — ¿303 único para toda la S.L. o segregado por marca?** Hoy `contabilidad/page.tsx` mezcla `traduccionesjuradas` + `holabonjour` en un solo libro de ingresos/IVA (sin filtro `brand`). Hola Bonjour y Traducciones Juradas son la **misma S.L., mismo NIF** → lo normal es un **único 303**, en cuyo caso lo actual es correcto y solo hay que **documentarlo**. Si Juan declara por separado, contabilidad ya está mal HOY y #7 lo agrava. **Decisión necesaria: confirmar 303 único.** Recomendación: 303 único (mismo NIF) → no tocar la fuente de ingresos; añadir solo un **filtro/columna informativa por marca** en la vista (no en el agregado fiscal).

- **⚠ D2 — ¿Serie de numeración única o por marca?** `suggestNextInvoiceNumber` es global y `number` es `@unique` global. Si Juan lleva **una sola serie correlativa** para toda la S.L. (lo más simple, y lo que el código asume hoy), no se toca nada y se documenta en un ADR. Si quiere **series separadas** por marca (`HB_NNN` / `TJ_NNN`), hay cambio de schema (`@@unique([brand, number])` o campo `series`) + firma `suggestNextInvoiceNumber(brand)` que **ningún spec contempla** → sería trabajo extra previo a #7. Recomendación: serie única, documentada.

- **⚠ D3 — Régimen IVA de las clases de francés de Hola Bonjour (caso Oracle, #7).** SPEC #7 asume 21% "porque traducción jurada es 21%" — trasladar el tipo de una actividad a otra distinta. La enseñanza de idiomas puede ir **exenta (Art. 20.Uno.9º LIVA)**, a **21%**, o ser operación con **inversión del sujeto pasivo** si el destinatario no está establecido. El PO `ES210004396` sugiere Oracle Ibérica (entidad española → operación interior). **Decisión necesaria con la gestoría.** Implicación: si es exenta, (a) la plantilla debe permitir `vatRate=0`, (b) el PDF necesita la **leyenda legal de exención**, (c) la S.L. entra en **prorrata** de IVA soportado → impacta el 303 de TODO el negocio (afecta también a #5). El plan deja la plantilla `vatRate` configurable y marca el PDF/leyenda como punto abierto.

- **⚠ D4 — Estatus Verifactu (RD 1007/2023, vigente para sociedades desde 1-ene-2026).** ¿Es esta web el **sistema de facturación oficial** (requeriría registros encadenados con hash, marca temporal, inalterabilidad) o es una **herramienta interna de borrador** y el sistema oficial es la gestoría/Excel de Juan? Si es lo segundo (probable), el `issuedAt` retroactivo de #2 es un problema de **descuadre con la gestoría**, no de Verifactu directo, y el lote retroactivo es viable con cautelas. Si la web fuera el sistema oficial, emitir en lote con fecha retroactiva y numeración no correlativa por fecha **contradice el encadenamiento** y habría que rediseñar. **Decisión necesaria antes de mergear #2.** El campo `origin` de #2 es auditoría interna, NO un registro de evento Verifactu.

---

# FEATURE #2 — Conciliación pedidos ↔ facturas

## (a) Migración Prisma (aditiva)

Modelo `ClientInvoice`, único campo nuevo:

```prisma
origin String? // "lazy_pdf" | "reconcile_batch" | "manual" | "import" | "draft" — solo auditoría
```

SQL aplicado por `prisma db push` (NO `migrate dev`, NO SQL manual):

```sql
ALTER TABLE "ClientInvoice" ADD COLUMN "origin" TEXT;
```

No se añade índice sobre `origin` (cardinalidad baja). No hay cambios en `Order` ni `BillingData`. Tras el push: `prisma generate` **antes** de referenciar `origin` en lib (si no, el build falla).

> ⚠ D2: si Juan elige serie por marca, ESTA es la migración donde además habría que cambiar `@unique` a `@@unique([brand, number])`. Con serie única, no.

## (b) Archivos a crear/editar (orden)

1. **`prisma/schema.prisma`** (editar) — añadir `origin String?` a `ClientInvoice`. Luego `prisma db push` + `prisma generate`.

2. **`lib/client-invoice.ts`** (editar) — tres cambios:
   - `issueOrUpdateInvoice`: añadir params opcionales `issuedAt?: Date | null` y `origin?: string | null`. En `create`: `issuedAt: input.issuedAt ?? new Date()`, `origin: input.origin ?? "manual"`. En `update`: añadir `issuedAt` al objeto `data` **solo si se pasa explícito** (`...(input.issuedAt ? { issuedAt: input.issuedAt } : {})`) y `origin` igual. Envolver el `prisma.clientInvoice.upsert` en `try/catch` para capturar `P2002` (colisión de `number @unique` desde el upsert, no solo desde el `clash`-check previo) y relanzar como error legible para el reintento del lote.
   - `getOrCreateClientInvoice`: pasar `origin: "lazy_pdf"` (NO pasar `issuedAt` → mantiene `now()`, comportamiento del cliente intacto).
   - `issueInvoice(id, opts)`: **añadir `opts.issuedAt?: Date | null`**; si se pasa, sellar con esa fecha en vez de `new Date()`. Necesario para resolver la contradicción A2.4 (DRAFTs de pedidos cobrados deben sellarse con `paidAt`, no con hoy).

3. **`lib/reconcile-invoices.ts`** (crear) — `type PaidUnbilledOrder`, `type BatchIssueResult`, y:
   - `listPaidUnbilledOrders(opts)`: query `Order` con `paymentStatus:"PAID"`, `amountCents: { gt: 0 }`, `OR:[{ clientInvoice: null }, { clientInvoice: { status:"DRAFT" } }]`, filtro de periodo sobre `paidAt` (o `createdAt` si `base:"created"`), `include: { billing:true, clientInvoice:{ select:{ id:true, status:true } } }`. Devolver por fila `hasBilling`, `hasNif` (de `billing.nif`), `draftInvoiceId`, `paidAt`, marca `sinFechaCobro` si `paidAt==null` (M2.7).
   - `issueInvoicesForOrders(input)`: **bucle secuencial** (`for...of await`, NO `Promise.all`). Por referencia: cargar pedido; si `!=PAID` → fallo; si ya `ISSUED` → `ok:true` skipped; **branch obligatorio DRAFT**: `if (draftInvoiceId) issueInvoice(draftInvoiceId, { number, issuedAt })` else `issueOrUpdateInvoice({ ..., issuedAt, origin:"reconcile_batch" })`. **Reintento P2002**: hasta 3 intentos recalculando `suggestNextInvoiceNumber` entre cada uno. Try/catch por pedido (no aborta el lote).

4. **`app/api/reconcile/orders/route.ts`** (crear) — `GET`. `requireStaffAccess` (sin gating de rol; lectura). Params `?year=&q=&m=&base=paid|created`. Devuelve `{ ok, rows, totalAmountCents, count }`. `runtime="nodejs"`.

5. **`app/api/reconcile/orders/issue/route.ts`** (crear) — `POST`. `requireStaffAccess` + **gating ADMIN/PM** (`getStaffRole(access.email)`). Body `{ references[], dateMode, numbersByReference? }`. Validar `references` no vacío, ≤200, strings no vacíos; `dateMode` en enum. Rate limit `reconcile-issue:${email}` 10/10min. Delega en `issueInvoicesForOrders`. 200 con fallos parciales por pedido. `runtime="nodejs"`.

6. **`components/ReconcilePanel.tsx`** (crear) — client component. Props `{ rows, totalAmountCents, canIssue }`. Tabla con checkbox, ref, cliente, fecha cobro, importe (total + base sugerida), badges `sin datos fiscales`/`sin NIF`/`tiene borrador`/`sin fecha de cobro`. "Seleccionar todos" excluye filas no emitibles (`!hasNif` o `sinFechaCobro`). Radio `dateMode`. Botón "Emitir (N)" deshabilitado si `!canIssue`. **Mostrar el detalle `issued`/`failed` por pedido en un bloque persistente ANTES de recargar** (M2.8); ofrecer botón "Actualizar" manual en vez de `reload()` automático que borra el resumen.

7. **`app/zona-traductor/contabilidad/page.tsx`** (editar) — importar `listPaidUnbilledOrders`; calcular rol con `getStaffRole(await authZonaTraductorOrRedirect())` → `canIssue`; añadir `listPaidUnbilledOrders({ base:"paid" })` al `Promise.all` (línea 19); montar `<ReconcilePanel>` **antes** de `<ContabilidadClient>` con encabezado "Pedidos cobrados sin factura emitida".

8. **SIN CAMBIO**: `components/ContabilidadClient.tsx`, `app/api/admin/invoices/export/route.ts` (fuente de ingresos sigue siendo `ClientInvoice ISSUED` → cero doble conteo por construcción).

## (c) Decisiones fiscales resueltas (con correcciones de la revisión)

- **Fuente de ingresos = `ClientInvoice ISSUED`**, no pedidos PAID. Correcto (Art. 63 RIVA: libro de facturas expedidas exige factura numerada).
- **`issuedAt = paidAt`** se sostiene SOLO porque el negocio cobra por adelantado (el pago es anticipo, Art. 75.Dos LIVA ≈ devengo). **Documentar esta hipótesis**; frágil si algún pedido se entrega antes de cobrar.
- **⚠ Correlatividad y periodos cerrados (corrección crítica vs spec original):** NO basta con "avisar". **Bloquear** `dateMode:"paid"` cuando `paidAt` cae en un trimestre ya liquidado. Requiere un dato nuevo: **fecha de cierre del último 303 presentado** (constante de config editable, p.ej. `LAST_303_CLOSE`). Si `paidAt < LAST_303_CLOSE` → forzar `dateMode:"today"` o exigir confirmación explícita "presentaré complementaria de TX". Para huecos antiguos, `dateMode:"today"` (factura del periodo actual con número/fecha actuales) es la **opción por defecto**, no la secundaria. ⚠ Decisión de Juan: qué fecha poner en `LAST_303_CLOSE`.
- **Sin NIF = NO se factura (corrección crítica):** eliminar el fallback `fiscalName="Cliente"` del spec. En lote, **saltar todo pedido sin NIF del cliente** (no solo sin `fiscalName`) y reportar "Faltan datos fiscales". Factura a empresa/autónomo sin NIF es nula (Art. 6.1.d-e RD 1619/2012). Juan rellena `BillingData` y emite uno a uno.
- **DRAFT con líneas manuales (corrección crítica B2.1):** el branch `issueInvoice(draftId)` es **obligatorio**, no recomendado. El upsert de `issueOrUpdateInvoice` recalcularía base/IVA desde el total bruto dejando `lineItemsJson` viejo → factura cuyas líneas no cuadran con el total. `issueInvoice` respeta las líneas del borrador. Para esos DRAFTs se pasa `issuedAt` (resuelto en cambio 2 de lib).
- **No-doble-conteo:** garantizado por `orderId @unique` + fuente única ISSUED. ⚠ pende de D1 (que el 303 sea único para la S.L.).
- **REFUNDED/CANCELLED:** fuera de la query (`paymentStatus:"PAID"`). Correcto, no se factura un reembolso.

## (d) Checklist de verificación #2

- [ ] `prisma db push` → preview sin `DROP`/`ALTER...DROP`; `prisma generate`.
- [ ] `npx tsc --noEmit --skipLibCheck` (ignorar errores preexistentes `@prisma/client`/`@/content`).
- [ ] Regresión camino perezoso: descargar PDF de un pedido PAID en dev → `getOrCreateClientInvoice` sigue sellando con `now()`, `origin:"lazy_pdf"` (verificar `app/api/orders/[reference]/invoice-pdf/route.ts`).
- [ ] Pedido PAID sin factura → aparece en panel → emitir → desaparece y aparece en "Facturas del periodo" con fecha = `paidAt`.
- [ ] Pedido PAID **con DRAFT de líneas manuales** → emitir por el branch `issueInvoice` → PDF conserva las líneas, total cuadra, sellado con `paidAt`.
- [ ] Pedido **sin NIF** → no seleccionable en "todos", reportado como fallo si se fuerza.
- [ ] Pedido con `paidAt` en trimestre cerrado (< `LAST_303_CLOSE`) → `dateMode:"paid"` bloqueado / forzado a `today`.
- [ ] Simular dos refs que resuelven al mismo número → reintento P2002 no aborta el lote.
- [ ] Detalle `issued/failed` por pedido visible tras el lote (no borrado por reload).

---

# FEATURE #7 — Facturas recurrentes (Oracle mensual)

> ⚠ Bloqueado por D2 (serie) y D3 (régimen IVA clases). No codificar hasta resolverlas.

## (a) Migración Prisma (aditiva) — **solo `db push`, sin SQL manual**

> **Corrección crítica vs spec (B7.1):** el spec original mezclaba `db push` + `migration.sql` manual + `migrate resolve` (flujos mutuamente excluyentes que dejan el historial mintiendo). **Usar SOLO `prisma db push` + `prisma generate`.** Eliminar todo el bloque SQL manual y el `migrate resolve`. Deja que `db push` genere el DDL.

Modelo nuevo en `prisma/schema.prisma` (tras `Expense`):

```prisma
model RecurringInvoice {
  id                     String   @id @default(cuid())
  label                  String
  active                 Boolean  @default(true)
  brand                  String   @default("traduccionesjuradas")
  clientName             String?
  fiscalName             String
  nif                    String?
  address                String?
  city                   String?
  postalCode             String?
  country                String   @default("España")
  email                  String?
  conceptTemplate        String?
  poNumber               String?
  langPair               String?
  lineItemsJson          Json?
  vatRate                Float    @default(0.21)
  dayOfMonth             Int      @default(1)
  lastGeneratedPeriod    String?
  lastGeneratedInvoiceId String?
  notes                  String?
  createdAt              DateTime @default(now())
  updatedAt              DateTime @default(now()) @updatedAt

  @@index([active])
}
```

## (b) Archivos a crear/editar (orden)

1. **`prisma/schema.prisma`** (editar) — añadir `RecurringInvoice`. `prisma db push` + `prisma generate`.

2. **`lib/recurring-invoice.ts`** (crear):
   - `periodKey(d?): string` ("YYYY-MM").
   - `resolveConcept(template, period)`: resolver `{MES}`/`{AÑO}`/`{MES_AÑO}` en español. **Parsear el período con `Number(period.slice(5,7))` + array de nombres de mes, NUNCA `new Date(period)`** (M7.8: `new Date("2026-03")` es UTC y cae en febrero en TZ negativas).
   - CRUD: `create/update/delete/list/getRecurringTemplate`. Validar `fiscalName` y `label` no vacíos; **clamp `dayOfMonth` a 1..28**.
   - `generateDraftForPeriod(templateId, opts)`: releer plantilla fresca; idempotencia `lastGeneratedPeriod === period`; **guard `Array.isArray(lineItemsJson)`** antes de pasar a `createDraftInvoice` (A7.4 — pasar `lines` crudas, NO re-normalizar: `createDraftInvoice` ya llama `normalizeLines` internamente); mapear a `DraftInvoiceInput` con `orderId:null`, `concept = resolveConcept(...)`; actualizar `lastGeneratedPeriod`+`lastGeneratedInvoiceId` **tras** crear con éxito. **`force` no debe duplicar (A7.3):** si ya existe un DRAFT vivo de ese periodo (`lastGeneratedInvoiceId` aún DRAFT), avisar/bloquear o sustituirlo, nunca crear un segundo borrador del mismo mes.
   - `runMonthlyRecurringDrafts(now?)`: recorrer `active:true`; gate `now.getDate() >= dayOfMonth && lastGeneratedPeriod !== periodKey(now)`.

3. **`app/api/recurring-invoices/route.ts`** (crear) — `GET` (list) + `POST` (create). Gating **ADMIN/PM**. `runtime="nodejs"`.

4. **`app/api/recurring-invoices/[id]/route.ts`** (crear) — `PATCH` + `DELETE`. Gating **ADMIN/PM**.

5. **`app/api/recurring-invoices/[id]/generate/route.ts`** (crear) — `POST` `{ period?, force? }` → `generateDraftForPeriod`. Gating **ADMIN/PM**. NUNCA emite; devuelve el DRAFT.

6. **`app/api/cron/recurring-invoices/route.ts`** (crear) — `GET` con `hasCronAuth(req)` (copiar literal de `app/api/cron/order-reminders/route.ts:8`). Llama `runMonthlyRecurringDrafts()`.

7. **`vercel.json`** (editar) — añadir al array `crons`. **Corrección del gate (A7.5):** si se usa `"0 6 1-5 * *"`, `dayOfMonth` debe ser ≤5 o nunca dispara; para soportar `dayOfMonth` 1..28 usar **`"0 6 * * *"`** (diario, el gate `lastGeneratedPeriod` evita duplicar). Recomendación: diario.
   ```json
   { "path": "/api/cron/recurring-invoices", "schedule": "0 6 * * *" }
   ```

8. **`components/ZonaTraductorNav.tsx`** (editar) — añadir `"recurrentes"` a `type ModoActivo` y a `TABS[]` entre `facturas` y `contabilidad`. (Pasa de 7 a 8 tabs — coherente con que #2 NO añade tab.)

9. **`app/zona-traductor/recurrentes/page.tsx`** (crear) — Server Component calcado de `facturas/page.tsx`: `authZonaTraductorOrRedirect`, `loadBandejaState`, `prisma.recurringInvoice.findMany`, serializar `lineItemsJson` con guard `Array.isArray`, `<ZonaTraductorNav modoActivo="recurrentes">` + `<RecurringInvoiceManager>`.

10. **`components/RecurringInvoiceManager.tsx`** (crear) — client component calcado de `InvoiceManager.tsx`. Campos extra: `label`, `active`, `conceptTemplate` (hint `{MES} {AÑO}`), `dayOfMonth`, `notes`. **Sin botón "Emitir"**; botón "Generar borrador de este mes" → `POST .../generate`; si `created:true`, enlace "Ver en Facturas". ⚠ si D3 = exenta, exponer `vatRate=0` y campo para la base legal de exención.

11. **`app/zona-traductor/contabilidad/page.tsx`** (editar, opcional) — enlace "→ Facturas recurrentes" junto a "+ Factura de otra actividad".

12. **SIN CAMBIO** en el camino de emisión: `POST /api/invoices/[id]/issue` → `issueInvoice()`. El DRAFT recurrente aparece solo en `facturas/page.tsx` (lista sin filtrar status) y se emite a mano.

## (c) Decisiones fiscales resueltas

- **Cron genera DRAFT, nunca emite.** Correcto: la asignación de número correlativo y el sellado son acto manual (Art. 6 RD 1619/2012, numeración sin huecos). Alineado con Verifactu (D4) y con que Juan lleva el contador maestro.
- **⚠ IVA de las clases (D3):** el plan deja `vatRate` configurable por plantilla. Si la gestoría confirma exención (Art. 20.Uno.9º), añadir leyenda legal al PDF y revisar prorrata. Para Oracle-ES la base imponible es 200€; el tipo depende de D3.
- **⚠ Serie (D2):** con serie única, OK reutilizar `suggestNextInvoiceNumber` global al emitir el DRAFT `holabonjour`. Con serie por marca, NO codificar #7 hasta tener `suggestNextInvoiceNumber(brand)`.
- **Devengo de tracto sucesivo (corrección, A2.4/spec #7):** la cuota mensual devenga el **último día del periodo** (Art. 75.Uno.7º LIVA). Como `issueInvoice` ahora acepta `issuedAt` (cambio hecho en #2), al emitir el DRAFT "MARZO 2026" el 10-abril, Juan debe poder sellar con **fin de mes del periodo** (31-mar), no con `new Date()`, para no declarar la cuota un trimestre tarde. Exponer ese `issuedAt` en el flujo de emisión del DRAFT recurrente.
- **Idempotencia** por `lastGeneratedPeriod` + gate del cron. `force` controlado para no duplicar (A7.3).

## (d) Checklist de verificación #7

- [ ] `prisma db push` (sin SQL manual, sin `migrate resolve`) → tabla `RecurringInvoice` en BD; `prisma generate`; `prisma.recurringInvoice` accesible.
- [ ] `npx tsc --noEmit --skipLibCheck`; `npm run build`.
- [ ] `CRON_SECRET` existe en Vercel (lo usan ya otros crons); sin él el cron devuelve 403 silencioso.
- [ ] STAFF puro (no ADMIN/PM) recibe 403 en rutas de plantilla.
- [ ] Crear plantilla Oracle (`brand=holabonjour`, `poNumber=ES210004396`, base 200€) → `POST .../generate` → DRAFT en `/zona-traductor/facturas` con concepto "MARZO 2026", IVA según D3, `brand=holabonjour`.
- [ ] `force:true` sobre un periodo ya generado NO crea segundo DRAFT.
- [ ] `dayOfMonth=10` con cron diario dispara el día 10 (no antes).
- [ ] `resolveConcept("...{MES} {AÑO}", "2026-03")` → "MARZO 2026" (verificar que no usa `new Date(period)`).
- [ ] Emitir el DRAFT a mano → asigna `AA_NNN`, permite `issuedAt = fin de mes del periodo`, PDF correcto.

---

# FEATURE #5 — Gastos completos (libro de recibidas + IRPF)

## (a) Migración Prisma (aditiva)

Modelo `Expense`, campos nuevos (todos opcionales o con default):

```prisma
supplierInvoiceNumber String?
irpfRetentionPct      Float   @default(0)
irpfCents             Int     @default(0)
payableCents          Int?
attachmentUrl         String?
attachmentKey         String?
attachmentName        String?
ivaDeducible          Boolean @default(true)   // ver corrección fiscal
```

Más un índice: `@@index([supplierNif])` (habilita agregar el 190 por perceptor y el 347).

SQL por `prisma db push`:

```sql
ALTER TABLE "Expense" ADD COLUMN "supplierInvoiceNumber" TEXT;
ALTER TABLE "Expense" ADD COLUMN "irpfRetentionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "irpfCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN "payableCents" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Expense" ADD COLUMN "attachmentKey" TEXT;
ALTER TABLE "Expense" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "Expense" ADD COLUMN "ivaDeducible" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "Expense_supplierNif_idx" ON "Expense"("supplierNif");
```

`db push` genera esto; no escribir el SQL a mano. `prisma generate` después.

## (b) Archivos a crear/editar (orden)

1. **`prisma/schema.prisma`** (editar) — campos nuevos + `@@index([supplierNif])`. `db push` + `generate`.

2. **`lib/expense-math.ts`** (crear, **módulo puro sin Prisma**) — espejo de `invoice-math.ts`:
   - `clampIrpfPct(v)`: whitelist **`{0, 0.07, 0.15}`** (tolera "15"→0.15, "7"→0.07; fuera → 0). **Corrección (A5.2/fiscal #7):** quitar `0.19` de este selector (es retención de arrendamiento/capital, modelo 115, no actividad profesional/111). Si Juan paga alquiler de local con retención, va en categoría separada etiquetada "Arrendamiento 19% (modelo 115)" — ⚠ decisión de Juan si hay alquiler.
   - `computeExpenseTotals(baseCents, vatRate, irpfPct)`: `vatCents=round(base*vatRate)`, `irpfCents=round(base*irpfPct)`, `totalCents=base+vatCents` (factura recibida), `payableCents=base+vatCents−irpfCents` (transferencia al proveedor).

3. **`lib/expenses.ts`** (editar) — `import { clampIrpfPct, computeExpenseTotals } from "@/lib/expense-math"`. Ampliar `ExpenseInput` con `supplierInvoiceNumber`, `irpfRetentionPct`, `attachmentUrl/Key/Name`, `ivaDeducible`. Reescribir `buildData` para usar `computeExpenseTotals` y persistir los campos nuevos. `totalCents` mantiene semántica base+IVA (no rompe agregados existentes). Validación: `irpfRetentionPct > 0 && !supplierNif` → `throw "La retención IRPF exige NIF del proveedor."`.

4. **`app/api/expenses/route.ts`** (editar, POST) y **`app/api/expenses/[id]/route.ts`** (editar, PATCH) — passthrough de los campos nuevos (`irpfRetentionPct ?? 0`, `ivaDeducible ?? true`, etc.). Mantener gating `requireStaffAccess` (no endurecer a ADMIN/PM).

5. **`app/api/upload/route.ts`** (editar) — aceptar campo opcional `prefix` en `formData`: `prefix = reference ? "orders/${reference}" : prefixField === "expenses" ? "expenses" : "uploads"`. Retrocompatible (ningún caller envía `prefix` hoy).

6. **`components/ContabilidadClient.tsx`** (editar):
   - `type AcExpense`: añadir `supplierInvoiceNumber`, `irpfCents`, `payableCents`, `attachmentUrl`, `attachmentName`, `ivaDeducible`.
   - Estado `gasto`: añadir `supplierNif`, `supplierInvoiceNumber`, `irpfPct` (default 0), `ivaDeducible` (default true), `attachment`.
   - Form: inputs NIF proveedor, Nº factura proveedor, `<select>` IRPF (**solo 0 / 0.15 / 0.07**), checkbox "IVA deducible", `input type=file` (PDF/imagen) que sube a `/api/upload` con `prefix=expenses`. **Subir el adjunto solo al guardar** y limpiar en `catch` para no dejar blobs huérfanos (M5.4).
   - Cálculo en vivo: Base / IVA / IRPF / Total factura / A pagar al proveedor — usando `computeExpenseTotals` **importado de `lib/expense-math` (NO de `lib/expenses`, que arrastra Prisma al bundle y rompe el build — A5.1)**.
   - Tabla: columnas Nº fact. prov., IRPF, A pagar, Justificante (enlace), badge "IVA no deducible" si aplica.
   - **Agregado del 303 (corrección fiscal):** `ivaLiquidar = inv.vat − (suma de exp.vat SOLO de gastos con `ivaDeducible=true`)`. Hoy resta todo el IVA soportado → sobre-deduce. Footer "IRPF retenido del periodo → modelo 111".

7. **`app/zona-traductor/contabilidad/page.tsx`** (editar) — mapeo `AcExpense`: añadir `supplierInvoiceNumber`, `irpfCents`, `payableCents: e.payableCents ?? e.totalCents`, `attachmentUrl`, `attachmentName`, `ivaDeducible`.

8. **`app/api/admin/expenses/export/route.ts`** (crear, recomendado — fuera de alcance estricto) — CSV libro de recibidas para gestoría: `Fecha;NºFacturaProveedor;Proveedor;NIF;Concepto;Base;%IVA;IVA;IVADeducible;%IRPF;IRPF;Total;APagar`. Aplicar `payableCents ?? totalCents`. ⚠ decisión de Juan si entra en este PR o uno aparte.

## (c) Decisiones fiscales resueltas (con correcciones)

- **`totalCents` = base+IVA (factura) vs `payableCents` = base+IVA−IRPF (transferencia):** distinción impecable. La retención no minora la factura; es pago a cuenta del IRPF del perceptor que HBTJ ingresa en el 111. `payableCents` es lo que se transfiere al colaborador.
- **`irpfRetentionPct` como fracción** (coherente con `vatRate`). Whitelist **solo `{0, 0.07, 0.15}`** (corrección A5.2): 15% general profesional, 7% nuevos autónomos. **0.19 fuera** (es 115/arrendamiento, no 111/profesional).
- **IRPF sin NIF bloqueado** (modelo 190 exige NIF del perceptor).
- **IRPF es ortogonal al IVA y al resultado:** no toca `vatCents` (303) ni `resultado=base−base`. Va al 111/190.
- **IVA deducible parcial (corrección fiscal #5-defecto2):** nuevo flag `ivaDeducible` (default true). Atenciones a clientes, comidas, regalos = IVA NO deducible (Art. 96 LIVA); el agregado del 303 resta solo el IVA de gastos `ivaDeducible=true`. ⚠ **si D3 = Hola Bonjour exenta → prorrata obligatoria**: este flag booleano es el mínimo viable, pero la prorrata real (porcentaje sobre IVA común) queda como **limitación documentada que requiere ajuste manual en gestoría**.
- **`vatRate=0` NO es cajón único (corrección fiscal #5-defecto3):** cuota SS / seguro exento / intracomunitario son distintos. La **adquisición intracomunitaria de servicios (SaaS UE)** NO es 0% sino **inversión del sujeto pasivo** (autorrepercutir IVA devengado+soportado en el 303 + modelo 349). Mínimo viable: una `category` "Intracomunitario ISP/349"; si se deja fuera, **documentar como limitación y avisar a Juan de que los SaaS extranjeros no se declaran solos**. ⚠ decisión de Juan sobre alcance.
- **Modelo 347:** `supplierNif` + `@@index([supplierNif])` lo habilitan (operaciones > 3.005,06€/año por NIF). **Capturar `supplierNif` en toda factura formal, no solo cuando hay retención** (corrección #5-defecto4), o los proveedores sin retención pero > 3.005€ romperían el 347 futuro.
- **Adjunto opcional**: gasto válido sin justificante; aviso suave en filas con `supplierInvoiceNumber` pero sin adjunto. `attachmentKey` se persiste para borrado futuro (no se implementa borrado de blob ahora — deuda menor documentada).
- **Redondeo** `round(base*pct)` por campo, consistente con el repo.

## (d) Checklist de verificación #5

- [ ] `prisma db push` → preview sin `DROP`; `prisma generate`.
- [ ] `npx tsc --noEmit --skipLibCheck`; `npm run build` — **verificar que `ContabilidadClient` NO importa de `lib/expenses`** (arrastraría Prisma al cliente); solo de `lib/expense-math`.
- [ ] Alta de gasto con IRPF 15% y NIF → `irpfCents`, `payableCents` correctos; cálculo en vivo cuadra.
- [ ] Gasto con IRPF pero sin NIF → bloqueado con error.
- [ ] Gasto con `ivaDeducible=false` → NO entra en `ivaLiquidar` del 303.
- [ ] Subir justificante PDF con `prefix=expenses` → blob en `expenses/...`; enlace en tabla abre el PDF; callers existentes de `/api/upload` (sin `prefix`) siguen en `uploads`/`orders/`.
- [ ] Fallo de red al guardar gasto → adjunto se limpia / no queda huérfano sin registro.
- [ ] Filas legacy (`payableCents=null`) → UI muestra `?? totalCents` sin romper.
- [ ] (Si se hace) CSV de gastos `/api/admin/expenses/export` con columnas IRPF/IVA deducible/A pagar.

---

## Resumen de orden global

1. **Decisiones D1–D4 con Juan/gestoría** (303 único, serie de numeración, régimen IVA clases, estatus Verifactu). D2 y D3 **bloquean #7**; D4 bloquea el merge de #2; D1 se documenta.
2. **#2 Conciliación** — incluye el cambio reusable en `issueInvoice`/`issueOrUpdateInvoice` (`issuedAt` opcional, P2002 en upsert) del que dependen #7 y la coherencia del 303.
3. **#7 Recurrentes** — reutiliza el `issuedAt` de #2 para el devengo de tracto sucesivo; solo `db push` (sin SQL manual ni `migrate resolve`); cron diario.
4. **#5 Gastos** — `lib/expense-math.ts` puro obligatorio; whitelist IRPF sin 19%; flag `ivaDeducible`; `supplierNif` siempre.

Archivos clave de referencia (rutas absolutas): `/Users/juan/Code/HBTJ/traduccionesjuradas-net/lib/client-invoice.ts`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/lib/invoice-math.ts`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/lib/expenses.ts`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/app/zona-traductor/contabilidad/page.tsx`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/components/ContabilidadClient.tsx`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/components/ZonaTraductorNav.tsx`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/app/api/upload/route.ts`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/app/api/cron/order-reminders/route.ts`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/prisma/schema.prisma`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/vercel.json`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/lib/staff-access.ts`, `/Users/juan/Code/HBTJ/traduccionesjuradas-net/lib/zona-traductor-data.ts`.