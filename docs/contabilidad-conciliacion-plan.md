# Plan contable: conciliación que cuadra + balance + borradores de impuestos

> Origen: sesión 2026-06-11. Juan, en la conciliación bancaria, no puede
> vincular ingresos a facturas ni cargos a gastos ya registrados (solo "Ignorar"
> o "Registrar gasto nuevo"), y no hay borradores de impuestos trimestrales.
> Objetivo final: balance por mes/trimestre + borradores 303/111/130 para
> presentar. Encaja en `/admin/facturacion` del backoffice unificado.

## Estado actual (verificado en código)

La conciliación (`lib/bank-reconcile.ts` + `components/BankReconcilePanel.tsx`) YA:
- Auto-empareja **ingresos ↔ facturas emitidas** y **cargos ↔ gastos** por importe/fecha (tolerancias).
- Para ambiguos pide elegir (`BankDecision MATCHED_MANUAL`).
- Persiste solo `BankDecision` (hash + decisión + `matchedType/matchedId`), **no el extracto** (privacidad). Re-cuadra tras cada acción.
- Contabilidad (`ContabilidadClient.tsx`) calcula por periodo: ingresos base, gastos base, **IVA a liquidar (303) = IVA repercutido − IVA soportado deducible**, resultado, e IRPF retenido (→ 111). Exporta CSV para la gestoría.

## Los 5 huecos (lo que te falta)

1. **Ingresos sin identificar → solo "Ignorar".** No puedes vincular un cobro a una **factura YA emitida**: el único flujo es "cobro sin factura → crear factura". Si emitiste la factura antes de que entre el dinero, no las enlazas.
2. **Cargos sin gasto → "Registrar gasto" crea uno NUEVO**, pero no puedes **vincular a un gasto ya registrado** (ni adjuntar la factura/recibo a uno existente). Falta ese workflow.
3. **Sin `paidAt`** en `ClientInvoice` ni `Expense` → no se marca **factura cobrada / gasto pagado**; el estado se infiere indirectamente del `BankDecision`.
4. **El coste del traductor es un `OrderEvent`, NO un `Expense`** (`lib/collaborators.ts` `applyAcceptedQuoteSideEffects`) → **los pagos a traductores no entran en contabilidad ni en el 303/111** (= hallazgo M3 del audit del backoffice).
5. **No hay borradores 303/130/111** → solo números en pantalla + CSV; la gestoría los monta a mano.

## Plan por bloques

### Bloque A — Conciliación que cuadra de verdad (riesgo BAJO-MEDIO)
1. Schema aditivo: `ClientInvoice.paidAt`, `Expense.paidAt`, `Expense.status` (`PENDING`/`PAID`).
2. **Ingresos:** añadir acción "**Vincular a factura existente**" (además de "Facturar"): selector de facturas emitidas no cobradas con importe ≈ → `BankDecision matchedType=invoice` + set `ClientInvoice.paidAt = fecha del movimiento`.
3. **Cargos:** añadir "**Vincular a gasto existente**" (además de "Registrar gasto"): selector de gastos del periodo no pagados → `BankDecision matchedType=expense` + set `Expense.paidAt`. Permitir adjuntar la factura/recibo (Blob) a un gasto existente.
4. **Índice inverso:** dado factura/gasto, saber si tiene movimiento vinculado → mostrar estado "cobrada"/"pagado" en las listas de Facturas y Gastos.

### Bloque B — El coste del traductor entra en contabilidad (M3, PRIORIDAD)
- `applyAcceptedQuoteSideEffects` → crear un `Expense` real (proveedor = colaborador, base = coste sin IVA, IRPF 15% si AUTONOMO) **además** del `OrderEvent`. Así los pagos a traductores cuadran en gastos / 303 / 111.
- Script único para migrar los `OrderEvent finance.supplier_invoice.updated` históricos a `Expense` (evitando duplicados).

### Bloque C — Balance + borradores de impuestos (el objetivo final)
1. **Balance por mes/trimestre:** ya se calcula; añadir una **vista/descarga de balance** (ingresos − gastos − IVA − IRPF − resultado) por periodo, presentable.
2. **Borrador 303 (IVA trimestral):** genera el desglose por casillas — IVA repercutido (facturas), IVA soportado deducible (gastos), resultado a ingresar/compensar. PDF + JSON.
3. **Borrador 111 (retenciones IRPF a proveedores):** suma de `irpfCents` practicado a colaboradores autónomos en el trimestre.
4. **Borrador 130 (pagos fraccionados IRPF), SI APLICA:** 20% del rendimiento neto acumulado del año − pagos previos − retenciones soportadas. (Depende del régimen de Juan; ver decisiones.)
5. **Modelo `TaxDraft { period, model, dataJson, totalCents, generatedAt }`** para guardar el borrador cerrado de cada trimestre.

## Decisiones que necesita Juan (de su gestoría)
- ¿Está en **modelo 130** (pagos fraccionados, estimación directa) o **exento** (p.ej. >70% de ingresos con retención)? → decide si generamos el 130.
- ¿**111** trimestral (retiene a colaboradores autónomos) y **190** anual?
- Confirmado del módulo fiscal: los borradores son **internos** (la gestoría presenta; no Verifactu; emisión retroactiva permitida).

## Encaje en el roadmap
- Bloque B es el **M3** del `backoffice-unificacion-plan.md` (Fase 6) — subir prioridad.
- Bloques A y C viven en `/admin/facturacion` (sub-tabs Facturas/Gastos/Contabilidad/Conciliación) del backoffice unificado.
- Schema aditivo (paidAt/status/TaxDraft) vía `prisma db push`, sin romper nada.
