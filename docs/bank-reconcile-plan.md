I have everything verified. Two material corrections to the persisted specs surfaced from the code: (1) `Order` has **no `brand` field** (only `ClientInvoice` and `Expense` do), and (2) `issueInvoicesForOrders` takes `{references, dateMode, numbersByReference?}`, not `{references}` alone. I'll fold both into the plan.

Here is the consolidated plan.

---

# Plan de implementación — Conciliación bancaria (#8)

## (a) Enfoque elegido y por qué

**Híbrido B-base + tabla mínima `BankDecision`** (el veredicto del juez).

Motor **stateless** (Enfoque B) como núcleo: el extracto BBVA se sube, se parsea en cliente, se cruza al vuelo contra `ClientInvoice(ISSUED)` / `Order(PAID)` / `Expense` y se descarta. **Sin** persistir el extracto. Encima, **una única tabla de excepciones** (`BankDecision`) que guarda **solo** el hash de la línea + qué decidió el staff (`IGNORED` / `MATCHED_MANUAL`) + una nota. No guarda importe, ni concepto crudo, ni contraparte, ni saldo.

Por qué este y no los puros:

- **Mata el único defecto que duele de B** (olvidar lo revisado): la comisión bancaria recurrente, la cuota de SS, el traspaso interno y los Bizum se marcan **una vez** y no reaparecen cada trimestre. Coste: ~15 líneas de schema + un `findMany`.
- **Evita los tres defectos graves de A**:
  1. *No hay libro de caja paralelo sumable* → cero riesgo de doble conteo con #2/#5 y con la comisión que `finance` ya registra. `BankDecision` no tiene `amountCents`; nadie puede agregarla por error.
  2. *No hay puntero polimórfico sobre movimientos persistidos* que degrade un cuadre a pendiente sin explicación.
  3. *GDPR mínimo*: un SHA-256 no es dato bancario en claro. No metemos conceptos/ordenantes de terceros en una BD pública con ~77 endpoints.
- **Adopta lo bueno de A** donde importa: no-auto-confirmación cuando hay >1 candidato (se pregunta), y `note` para auditar la decisión.
- **B es ampliable hacia el híbrido sin reescritura; A no es reducible a B sin tirar su tabla.** El híbrido es B + delta, no A − features.

Encaje con el lema de Juan ("que cuadre y que no falte nada"): los **huecos** los dan ambos enfoques (visibles hasta que se actúa); la **memoria de excepciones** la da `BankDecision`; el **"no falta nada"** literal lo da el checksum de saldo del extracto.

---

## (b) Migración Prisma exacta (SQL aditivo)

Modelo nuevo en `prisma/schema.prisma` (aditivo, no toca ningún modelo existente):

```prisma
// Solo decisiones del staff sobre líneas bancarias del extracto. NO almacena el
// extracto crudo (sin importe, concepto, contraparte ni saldo) → sin doble caja
// ni dato bancario de terceros en claro. Privacidad por diseño.
// lineHash = SHA-256(yyyy-mm-dd(fecha) | amountCents | norm(concepto)) — se
// recalcula en cliente/servidor en cada subida y se cruza contra esta tabla.
model BankDecision {
  id          String   @id @default(cuid())
  brand       String   @default("traduccionesjuradas")
  lineHash    String   @unique
  status      String   // IGNORED | MATCHED_MANUAL
  matchedType String?  // invoice | order | expense  (solo si MATCHED_MANUAL)
  matchedId   String?
  note        String?  // "comisión banco", "traspaso interno", "cuota SS", ...
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now()) @updatedAt

  @@index([brand])
}
```

**No hay FK** a `Order`/`ClientInvoice`/`Expense`: si el destino de un `MATCHED_MANUAL` se borra, el peor caso es que la línea reaparezca como hueco en la siguiente subida (idéntico a A pero sin tabla de movimientos huérfanos que limpiar). Es aceptable y no requiere `onDelete` en tres modelos.

**Aplicación** (runbook del proyecto — `prisma/CLAUDE.md`: **`db push`, nunca `migrate dev`**, P3006 con Prisma Postgres):

```bash
npx prisma db push      # aplica directo
npx prisma generate
```

SQL equivalente que `db push` ejecuta (puramente aditivo → cero riesgo destructivo):

```sql
CREATE TABLE "BankDecision" (
  "id"          TEXT NOT NULL,
  "brand"       TEXT NOT NULL DEFAULT 'traduccionesjuradas',
  "lineHash"    TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "matchedType" TEXT,
  "matchedId"   TEXT,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankDecision_lineHash_key" ON "BankDecision"("lineHash");
CREATE INDEX "BankDecision_brand_idx" ON "BankDecision"("brand");
```

Para dejar rastro de migración en repo (opcional, según runbook): crear `prisma/migrations/YYYYMMDDHHMMSS_bank_decision/migration.sql` con el SQL anterior y `npx prisma migrate resolve --applied ...`. Usar el skill `/migration` para el preview.

---

## (c) Archivos a crear/editar, en orden

**1. `prisma/schema.prisma`** *(editar)* — añadir modelo `BankDecision`. Luego `db push` + `generate`. Bloqueante de todo lo demás (los tipos de Prisma).

**2. `lib/csv.ts`** *(crear — refactor de extracción)* — mover desde `components/ImportInvoicesPanel.tsx` las funciones hoy privadas: `norm`, `detectDelimiter`, `splitCsvLine`, `toCents`, `mapHeader`. Añadir `parseDateFlexible(s)` (ISO **y** `DD/MM/YYYY`, `DD-MM-YYYY` de banca española). Sin cambio de comportamiento para el importador.

**3. `components/ImportInvoicesPanel.tsx`** *(editar)* — borrar las funciones extraídas e importarlas de `lib/csv.ts`. Refactor neutro; verificar que el preview de facturas sigue idéntico.

**4. `lib/bank-reconcile.ts`** *(crear — núcleo puro, testeable sin Prisma)* — tipos `BankTxn`, `ColumnMapping`, `AccountingSnapshot`, `ReconResult`, `Candidate`; `computeLineHash(txn)`; `detectColumns(headers)`; `parseBankCsv(text, mapping?)`; `reconcile(txns, snapshot, decisions)` (motor §d, función pura). Reutiliza `DEFAULT_RECONCILIATION_TOLERANCE_CENTS` de `lib/finance.ts` y las primitivas de `lib/csv.ts`.

**5. `app/api/bank/reconcile/route.ts`** *(crear)* — `POST { rows: BankTxn[], mapping? }`. `runtime="nodejs"`. Gating `requireStaffAccess(req)` (igual que `/api/invoices/import` y `/api/expenses`). `MAX_ROWS = 5000`. Carga snapshot con Prisma directo (mismas queries que la page: `ClientInvoice{status:ISSUED}`, `Order{paymentStatus:PAID}`, `Expense`) + `BankDecision.findMany`, llama `reconcile()`, devuelve `ReconResult`. **No escribe nada.**

**6. `app/api/bank/decision/route.ts`** *(crear)* — `POST { lineHash, status, matchedType?, matchedId?, note? }` → upsert por `lineHash` (idempotente). `DELETE { lineHash }` → revertir (volver a evaluar). Gating: lectura/marca para `ADMIN|PM` (como `canIssue` en la page); resto 403. Es el **único** endpoint que persiste, y solo decisiones.

**7. `components/BankReconcilePanel.tsx`** *(crear — client component)* — upload/paste CSV → `parseBankCsv` en cliente → **paso de mapeo de columnas** (selects pre-rellenados por `detectColumns`) → preview tabla → botón "Cuadrar N movimientos" → `POST /api/bank/reconcile` → 5 secciones (§e). Botones de acción enlazan a #2/#5 y a `/api/bank/decision`. Estilo `slate-900/40 rounded-xl border` idéntico a los paneles vecinos.

**8. `app/zona-traductor/contabilidad/page.tsx`** *(editar)* — montar `<BankReconcilePanel canIssue={canIssue} />` como hermano de `<ReconcilePanel>` / `<ImportInvoicesPanel>` dentro del mismo `max-w-5xl`. La page no carga el snapshot bancario en SSR (depende del CSV) — el panel hace fetch al confirmar.

**9. `lib/__tests__/bank-reconcile.test.ts`** *(crear)* — `node --test` (`npm run test:unit`): hash determinista, parser `DD/MM/YYYY`, signo (columna única vs cargo/abono), match exacto, match `netOfFee`, `>1` candidato → ambiguo, checksum de saldo, dedupe defensivo, aplicación de `BankDecision`.

**Reutilizar sin tocar:** `lib/reconcile-invoices.ts` (#2), `app/api/expenses/route.ts` + `lib/expenses.ts` (#5), `lib/finance.ts` (tolerancia), `lib/staff-auth.ts` + `lib/staff-access.ts` (gating).

---

## (d) Algoritmo de matching final

**Normalización.** Cada línea → `BankTxn { bookingDate, valueDate?, description, amountCents (CON SIGNO: + ingreso / − cargo), balanceCents?, raw[] }`.

**Signo (heurística BBVA):**
- Columna única "Importe" → el signo del número manda (`-12,34` = cargo).
- Columnas separadas "Cargo/Adeudo/Debe" + "Abono/Haber/Ingreso" → `amountCents = credit − debit`.
- `> 0` ⇒ INGRESO (vs facturas/pedidos) · `< 0` ⇒ CARGO (vs gastos).

**Parámetros** (tolerancia reutilizada de `lib/finance.ts`):
- `TOLERANCE_CENTS = DEFAULT_RECONCILIATION_TOLERANCE_CENTS` (300, clamp 100–500 por env).
- `DATE_WINDOW_INCOME = 7d`, `DATE_WINDOW_EXPENSE = 14d`.
- `GATEWAY_FEE_MAX_PCT = 0.04` (Stripe ~1,5 %+0,25 € / Redsys ~0,4 %; el extracto trae el neto).

**Paso 0 — aplicar decisiones.** Para cada `txn` calcular `computeLineHash`. Si existe `BankDecision` con ese `lineHash`:
- `IGNORED` → a la sección "Ignorados (persistente)", no entra al motor.
- `MATCHED_MANUAL` → a "Cuadrados" con el `matchedType/matchedId` guardado, no se reevalúa.
El resto pasa al motor.

**INGRESO (`amountCents > 0`)** — primer hit gana, candidato no consumido:
1. **Factura emitida** (objetivo fiscal): `ClientInvoice.status=ISSUED` con `|txn − inv.totalCents| ≤ TOLERANCE` **y** `|bookingDate − inv.issuedAt| ≤ 7d`. Bonus de confianza si `description` contiene token del `inv.number` (AA_NNN) o del `fiscalName`/`nif` normalizado.
2. **Pedido pagado sin factura**: `Order.paymentStatus=PAID`:
   - exacto: `|txn − order.amountCents| ≤ TOLERANCE` y `|bookingDate − (order.paidAt ?? createdAt)| ≤ 7d`;
   - neto de comisión: `txn ∈ [order.amount·(1−0.04), order.amount]` ⇒ match con flag **`netOfFee`** (la diferencia es comisión de pasarela).
   - Bonus si `description` contiene `order.reference` o `clientName`.
   - Este caso ⇒ etiqueta **"cobro sin factura"** → alimenta #2.
3. Sin candidato ⇒ **"ingreso sin identificar"** (otra actividad, holabonjour, Bizum fuera del funnel).

**CARGO (`amountCents < 0`)** — trabajar con `abs = −amountCents`:
1. **Gasto registrado**: `Expense` con `|abs − exp.totalCents| ≤ TOLERANCE` **y** `|bookingDate − exp.date| ≤ 14d`. Bonus si `description` contiene `exp.supplier` normalizado.
2. Sin candidato ⇒ **"cargo sin gasto"** → alimenta #5.
3. **Estructurales ignorables** (regla, lista en `lib/bank-reconcile.ts`): patrones `traspaso` / `transferencia a cuenta propia` / `tarjeta` / `comision mantenimiento` / `liquidacion intereses` ⇒ sección **"Internos / financieros"**, no exigen gasto.

**Consumo determinista (sin doble match).** Ordenar candidatos por `(menor diffCents, luego menor distancia de fecha, luego id estable)` y consumir greedy: cada `ClientInvoice`/`Order`/`Expense` se consume **una vez**. Así dos líneas del mismo importe no roban el mismo candidato → reproducible entre recargas (esencial sin estado).

**Ambigüedad (de A).** Si para una línea hay **>1 candidato** dentro de tolerancia+ventana antes de consumir, **no se auto-confirma**: la línea muestra los candidatos para que Juan elija (botón "Es este" → `POST /api/bank/decision` con `MATCHED_MANUAL`). Evita emparejar la factura equivocada.

**Reglas no negociables (cierran los defectos compartidos):**
1. La diferencia por **comisión de pasarela NUNCA propone "registrar gasto"** (finance ya la contabiliza) — solo flag `netOfFee` informativo. Evita el doble conteo de la comisión.
2. **>1 candidato ⇒ no auto-confirma**, pregunta.
3. **Filtro por `brand`** en facturas y gastos (no cruzar holabonjour ↔ TJ). ⚠ **Order no tiene `brand`**: los pedidos se tratan como `traduccionesjuradas` por defecto; un ingreso de holabonjour sin factura TJ cae correctamente en "sin identificar". Ver (f).
4. **Devoluciones**: `−amount` cuyo `abs` casa con un `Order` previo (signo invertido) y/o `Order.paymentStatus=REFUNDED` en ventana ⇒ etiqueta "Devolución" en Internos, no exige gasto.
5. **Bizum**: patrón `/bizum/i` ⇒ etiqueta "Bizum" (señal de cobro fuera de pasarela; suele ir a "sin identificar").
6. **Checksum de saldo**: si hay columna `saldo`, validar `saldo[i] − saldo[i−1] == amountCents[i]`. Si rompe ⇒ banner "faltan movimientos o el orden no es cronológico". Esto *es* literalmente "que no falte nada".

**Salida** `ReconResult`: `matched[]` (con `kind`, `target`, `diffCents`, `flags`), `incomeNoInvoice[]` (con `candidateOrder?`), `chargeNoExpense[]`, `internal[]`, `unmatchedIncome[]`, `ambiguous[]` (con lista de candidatos), `ignoredPersisted[]`, y `totals { bankIn, bankOut, matchedIn, matchedOut, gapIn, gapOut, balanceCheck }`.

**Idempotencia:** el motor no escribe en Order/Invoice/Expense; solo lee. Re-correr reevalúa todo el snapshot fresco y reaplica `BankDecision`.

---

## (e) Enlace con #2 (facturar cobro) y #5 (registrar gasto)

Las acciones **reutilizan endpoints existentes** — cero lógica fiscal duplicada.

**#2 — Facturar el cobro** (sección "cobro sin factura"):
- La fila trae `candidateOrder` (un `Order PAID` sin `ClientInvoice` ISSUED).
- Botón "Facturar" llama al **mismo flujo que ya usa `<ReconcilePanel>`**: `lib/reconcile-invoices.ts → issueInvoicesForOrders({ references: [ref], dateMode: "paid" })`.
  - ⚠ Firma real: `{ references, dateMode: "paid" | "today", numbersByReference? }` (no `{references}` solo). Por defecto `dateMode:"paid"`; si el cobro cae en trimestre ya liquidado (`LAST_303_CLOSE`), la lib ya fuerza fecha de hoy y devuelve `dateAdjusted`.
  - Requiere `billing.nif + fiscalName`. Si faltan → la fila enlaza a la edición de billing del pedido en vez de emitir.
- Tras emitir → el panel re-hace `POST /api/bank/reconcile`: en la pasada fresca el hueco desaparece (ya hay `ClientInvoice ISSUED`).

**#5 — Registrar gasto** (sección "cargo sin gasto"):
- Botón "Registrar gasto" abre un formulario **prefijado**: `date = bookingDate`, `concept = description`, `supplier = counterparty?`.
- ⚠ `Expense` se introduce por **base + `vatRate`**, no por total (`lib/expenses.ts` calcula `vat`/`total`). Prefijar `vatRate = 0.21` (editable, incl. 0 para exento) y `baseCents = round(abs / (1 + vatRate))`. El staff confirma → `POST /api/expenses` (gateado, `createExpense`).
- Tras crear → re-`reconcile`: en la pasada fresca el cargo casa con el nuevo `Expense`.
- **Excepción dura**: la diferencia neto-vs-bruto de comisión de pasarela **no** ofrece este botón (regla 1 de §d) — solo se muestra como `netOfFee`.

**Decisiones manuales** (no #2/#5):
- "Marcar ignorado" (comisión banca, traspaso interno, cuota SS) → `POST /api/bank/decision { lineHash, status:"IGNORED", note }`. **Persiste** → no reaparece.
- Desambiguación ">1 candidato" → `POST /api/bank/decision { lineHash, status:"MATCHED_MANUAL", matchedType, matchedId }`.
- "Deshacer" → `DELETE /api/bank/decision { lineHash }`.

---

## (f) Qué necesito de Juan (⚠)

1. **⚠ Muestra real del CSV de BBVA** (2–3 filas anonimizadas, con cabecera). Decide lo crítico:
   - ¿columna **"Importe" única con signo** o par **"Cargo"/"Abono"** separado?
   - nombres exactos de cabecera (`F. Operación`, `Fecha valor`, `Concepto`, `Importe (€)`, `Saldo`...) para afinar el diccionario de `detectColumns`;
   - formato de fecha (`DD/MM/YYYY` confirmado), decimal (coma) y si trae fila de saldo inicial / totales a descartar;
   - si exporta CSV, XLS o "Excel" — el plan asume CSV (como el importador de facturas). Si solo hay XLS, añadir paso "guardar como CSV" o un parser XLSX (fuera de v1).
2. **⚠ Tolerancia**: ¿los 300 cents (3 €) por defecto valen, o sube por comisiones de pasarela frecuentes? (env `RECONCILIATION_TOLERANCE_CENTS`, clamp 100–500).
3. **⚠ Comisión de pasarela**: confirmar que **finance ya la registra** (lo dice la memoria del proyecto) → entonces regla 1 firme: nunca proponer gasto por la diferencia neta. Si NO la registra, cambia la decisión.
4. **⚠ Multi-marca**: el extracto de BBVA, ¿es de una cuenta **solo TJ** o **mixta TJ + holabonjour**? `Order` no tiene `brand`; si la cuenta es mixta, los cobros de holabonjour sin factura TJ caerán en "sin identificar" (correcto, pero conviene que Juan lo sepa). Si quiere distinguirlos finos, haría falta `brand` en `Order` (fuera de v1).
5. **Bizum/transferencias directas**: ¿hay cobros que entran por Bizum/transferencia **fuera del funnel** (sin `Order`)? Si son habituales, confirmar que el flujo esperado es "ingreso sin identificar → facturar a mano vía #2 si procede".
6. **Refunds**: confirmar que las devoluciones quedan reflejadas como `Order.paymentStatus=REFUNDED` (para la heurística de devolución).

---

## (g) Checklist de verificación

**Schema / migración**
- [ ] `BankDecision` añadido; `grep -niE "model Bank" prisma/schema.prisma` lo muestra.
- [ ] `npx prisma db push` aplica sin warning destructivo; `npx prisma generate` OK.
- [ ] (opcional) carpeta `prisma/migrations/..._bank_decision/` + `migrate resolve --applied`.

**Refactor CSV (neutro)**
- [ ] `lib/csv.ts` exporta `norm/detectDelimiter/splitCsvLine/toCents/mapHeader/parseDateFlexible`.
- [ ] `ImportInvoicesPanel` importa de `lib/csv.ts`; **preview de facturas idéntico** al de antes (probar con un CSV de facturas real).

**Motor**
- [ ] `npm run test:unit` verde: hash determinista; `DD/MM/YYYY`; signo (única vs cargo/abono); match exacto; `netOfFee`; `>1` candidato ⇒ ambiguo; consumo greedy no roba candidato; checksum de saldo; `BankDecision` aplicada (IGNORED no entra, MATCHED_MANUAL no se reevalúa).
- [ ] La comisión de pasarela **no** genera item en `chargeNoExpense`.

**API (gating idéntico al resto)**
- [ ] `/api/bank/reconcile`: 403 sin staff; `runtime="nodejs"`; `MAX_ROWS=5000`; **no escribe** (verificar que no muta Order/Invoice/Expense); devuelve `ReconResult`.
- [ ] `/api/bank/decision`: 403 sin `ADMIN|PM`; upsert idempotente por `lineHash`; DELETE revierte.

**UI** (`/zona-traductor/contabilidad`)
- [ ] `<BankReconcilePanel>` montado junto a Reconcile/Import; estilo `slate-900/40` consistente.
- [ ] Subir CSV de muestra de BBVA → mapeo auto-detectado correcto → preview marca filas con error.
- [ ] "Cuadrar" pinta las 5 secciones + banda de totales + checksum de saldo.
- [ ] "Facturar" en "cobro sin factura" emite vía `issueInvoicesForOrders` y, al re-cuadrar, el hueco desaparece.
- [ ] "Registrar gasto" en "cargo sin gasto" prefija base/IVA, postea a `/api/expenses` y, al re-cuadrar, el cargo casa.
- [ ] "Marcar ignorado" persiste: al re-subir el mismo extracto, la línea sigue en "Ignorados (persistente)".
- [ ] Línea ambigua: el selector de candidatos guarda `MATCHED_MANUAL` y no reaparece.

**Global**
- [ ] `npx tsc --noEmit --skipLibCheck` sin errores nuevos (ignorando los preexistentes de `@prisma/client`/`@/content`).
- [ ] `npm run build` OK.
- [ ] Sin datos bancarios crudos en BD: `BankDecision` no tiene `amountCents`/`concept`/`counterparty`/`balance` (confirmar en el schema final).

---

**Archivos a crear:** `lib/csv.ts`, `lib/bank-reconcile.ts`, `app/api/bank/reconcile/route.ts`, `app/api/bank/decision/route.ts`, `components/BankReconcilePanel.tsx`, `lib/__tests__/bank-reconcile.test.ts`.
**Archivos a editar:** `prisma/schema.prisma`, `components/ImportInvoicesPanel.tsx`, `app/zona-traductor/contabilidad/page.tsx`.
**Reutilizados sin tocar:** `lib/reconcile-invoices.ts` (#2), `app/api/expenses/route.ts` + `lib/expenses.ts` (#5), `lib/finance.ts`, `lib/staff-auth.ts`, `lib/staff-access.ts`.

**Dos correcciones materiales a los specs persistidos** (verificadas en código): (1) `Order` **no tiene `brand`** — solo `ClientInvoice` (L189) y `Expense` (L221); el filtro multi-marca aplica a facturas/gastos y los pedidos se asumen TJ. (2) `issueInvoicesForOrders` exige `{ references, dateMode, numbersByReference? }`, no `{references}` solo.