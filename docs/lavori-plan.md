# Lavori × módulo de gestión — plan de producto (2026-07-10)

**Encuadre.** Lavori (`/Users/nip/proyectos/lavori`) es el tablón PWA de los jurados (Drizzle/Neon + OTP Twilio + push, piloto n≈10, regla operativa: *no sobre-construir para n=10*). Su storm de monetización (`lavori/docs/storm-monetizacion-2026-06-22.md`) ya fijó el modelo: **el tablón es gratis para siempre; lo cobrable es la "herramienta de producción" a cuota fija 9-15 €/mes** (fundador 9 € congelado, Kit Digital como CAC≈0). La suite de gestión de traduccionesjuradas-net (presupuestar → cobrar → entregar → facturar → contabilidad/gestoría) **es exactamente esa capa cobrable**: el mismo problema que Juan ya se resolvió a sí mismo, vendido a jurados autónomos con el mismo perfil. Lavori es el canal de distribución (comunidad finita, autenticada por OTP y nº MAEC); la suite es el producto.

---

## 1. Inventario del módulo de gestión (traduccionesjuradas-net)

### 1.1 Modelos Prisma (`prisma/schema.prisma`)

| Modelo | Línea | Qué es |
|---|---|---|
| `ClientInvoice` | :198 | Factura/presupuesto emitido. Numeración `AA_NNN` única compartida (:200), `docKind` invoice\|quote (:202), simplificada RD 1619/2012 (:203), multimarca (:205), justificante de pago → `paidAt` (:209-213), líneas JSON (:226) |
| `Expense` | :240 | Libro de gastos: IVA soportado, `ivaDeducible` art. 96 LIVA (:252), retención IRPF 111/190 (:253-254), justificante Blob (:259) |
| `RecurringInvoice` | :277 | Plantilla recurrente; cron genera BORRADORES, nunca emite (:274-276) |
| `BankDecision` | :305 | Decisiones sobre extracto bancario; solo `lineHash` SHA-256, sin datos crudos — privacidad por diseño (:270-273) |
| `Quote` + `QuoteLine` + `QuotePayment` | :414 / :472 / :491 | Presupuesto formal: par de idiomas, descuentos, token público, coste de traductor (`supplierUnitCost` :478), margen (:451), métodos de pago (:452) |
| `Customer` | :378 | Cliente + intermediario (autorelación) + portal |
| `Order` | :101 | Pedido/encargo — hub del workflow |
| `Collaborator` / `CollaboratorAssignment` | :727 / :747 | Traductores externos y asignaciones |

### 1.2 Libs — contabilidad y facturación (~2.400 líneas)

- `lib/client-invoice.ts` (346) — ciclo de vida factura: `suggestNextInvoiceNumber` :37, borradores :194-219, `issueInvoice` :221 (sella número+fecha), `setInvoicePaid` :265, `deleteInvoice` :294, `importIssuedInvoice` :312 (importación retroactiva).
- `lib/invoice-math.ts` (42) / `lib/expense-math.ts` (28) — cálculo puro de totales, IVA, IRPF.
- `lib/invoice-pdf.ts` (373) — `generateInvoicePdf` :137 con jsPDF; marca inyectada vía `getBrand`.
- `lib/invoice-brands.ts` (50) — `BRANDS` :21: perfiles de emisor **con CIF/IBAN de HBTJ hardcodeados** (:26-44).
- `lib/reconcile-invoices.ts` (265) — pedidos cobrados sin factura: `listPaidUnbilledOrders` :40, emisión en lote `issueInvoicesForOrders` :170, corte `LAST_303_CLOSE` por env :11.
- `lib/bank-parse.ts` (87) + `lib/csv.ts` — parser CSV bancario con detección de columnas (`parseBankCsv` :55).
- `lib/bank-reconcile.ts` (268) — motor de conciliación **puro** sobre snapshot (`reconcile` :61, `computeLineHash` :23, tolerancia :13): casa ingresos↔facturas/pedidos y cargos↔gastos, detecta huecos y ambiguos.
- `lib/tax-drafts.ts` (112) — borradores fiscales como **funciones puras**: `build303` :19, `build111` :41, `build130` :57 (¡el 130 es de autónomos: ya está hecho para el cliente destino!).
- `lib/expenses.ts` (72) — CRUD gastos; `lib/ai/extract-expense.ts` — `extractExpenseFromDocument` :36 (Claude: foto/PDF de factura → gasto estructurado).
- `lib/recurring-invoice.ts` (162) — `runMonthlyRecurringDrafts` :146.
- `lib/period-grouping.ts` (260) — agregación mes/trimestre/año TZ Madrid (`groupByPeriod` :126).
- `lib/finance.ts` (342) — margen y coste de colaborador por pedido (`getFinanceSnapshot` :267).

### 1.3 Libs — presupuesto → cobro → entrega (~3.000 líneas)

`lib/quotes.ts` (267), `quote-math.ts` (120), `quote-pdf.ts` (275), `quote-validators.ts` (166), `quote-stripe.ts` (71) + `quote-stripe-webhook.ts` (238), `quote-messages.ts` (225), `quote-to-order.ts` (124); workflow de pedidos: `lib/orders.ts` (934), `workflow-server.ts` (367), `order-actions.ts` (227), `collaborators.ts` (367), `translator-delivery.ts` (32); datos backoffice `zona-traductor-data.ts` (626); portal cliente `client-portal.ts` (72).

### 1.4 Pantallas (`app/zona-traductor/`)

| Ruta | Líneas | Contenido |
|---|---|---|
| `facturas/page.tsx` | 87 | + `components/InvoiceManager.tsx` (825): CRUD, emisión, PDF, cobro, justificante |
| `contabilidad/page.tsx` | 114 | + `ContabilidadClient.tsx` (838, **incluye gastos y borradores 303/111/130**), `BankReconcilePanel.tsx` (434), `ReconcilePanel.tsx` (331), `ImportInvoicesPanel.tsx` (231), `ExcludedOrdersPanel.tsx` (86) |
| `periodos/page.tsx` | 497 | facturación por mes/trimestre (pedidos+presupuestos) |
| `recurrentes/page.tsx` | 59 | + `RecurringInvoiceManager.tsx` |
| `presupuesto/page.tsx` | 100 | builder de presupuestos (segmentación multi-doc, PDF, envío) |
| `pedido/[reference]/page.tsx` | 623 | detalle de encargo (workflow, entrega, factura) |
| `clientes/page.tsx` + `[email]/page.tsx` | 111 + 307 | carpeta de cliente: presupuestos, facturas, acceso |

### 1.5 APIs y jobs

- Facturas: `app/api/invoices/route.ts` (143), `[id]/route.ts` (143), `[id]/pdf` (90), `[id]/paid` (95), `[id]/issue` (29), `import` (39), `customers` (46).
- Gastos: `app/api/expenses/route.ts` (46), `[id]` (55), `extract` (58, IA).
- Banco: `app/api/bank/reconcile/route.ts` (75), `bank/decision` (106).
- Cron: `app/api/cron/recurring-invoices/route.ts` (26).
- Gestoría: `app/api/admin/invoices/export/route.ts` (101, CSV de emitidas), `admin/expenses/export` (76); `scripts/export-invoices-gestoria.mjs` (paquete trimestral PDFs+CSV).
- Presupuestos: 15 rutas bajo `app/api/quotes/` (~1.900 líneas: emisión, envío, recordatorios, checkout público, webhook Stripe).

**Volumen total del producto candidato: ~9.000-10.000 líneas ya escritas y en producción real** (cierre 2T-2026 de HBTJ hecho con él).

---

## 2. Mapa de acoplamiento — con el signo cambiado

Los compradores **son traductores jurados**: lo específico del gremio deja de ser deuda y pasa a ser feature.

**VALE tal cual (dominio jurado compartido):** par de idiomas (`langPair`, `sourceLang/targetLang`), `holderNames` (titulares de certificados), entrega digital+papel con envío, presupuesto por documento/palabra, colaboradores/overflow, borrador 130 (autónomos), gastos con IRPF de colaboradores, export gestoría trimestral.

**GENÉRICO ya desacoplado (se copia sin tocar):** `invoice-math`, `expense-math`, `tax-drafts`, `period-grouping`, `bank-parse`+`csv`, `bank-reconcile` (motor puro sobre snapshot), `quote-math`, `ai/extract-expense`, `invoice-pdf`/`quote-pdf` (marca inyectada). Ninguno importa Order/Prisma salvo los CRUD.

**SOBRA (específico de la web de captación — NO se porta):** funnel/puerta y `OrderSession`, pricing-engine público, SEO/blog/ciudades, chatbot, `DocumentAnalysis` pipeline, Redsys/PayPal, `reconcile-invoices.ts` (atado al ciclo pedido-web→factura, aunque el concepto "cobrado sin facturar" sí vale), `finance.ts` (márgenes PM sobre pedidos web).

**HAY QUE ARRANCAR (supuestos single-tenant):**
- Emisor hardcodeado: `lib/invoice-brands.ts:21-45` (CIF B93712784, IBAN de HBTJ). Multimarca ≠ multi-tenant: mismo NIF.
- Numeración `AA_NNN` global única (`client-invoice.ts:37`, `schema.prisma:200`) — sin series por emisor ni por usuario.
- **Ningún modelo fiscal tiene `userId`/`tenantId`** (`ClientInvoice`, `Expense`, `RecurringInvoice`, `BankDecision`).
- Roles por listas de emails en env con defaults hardcodeados (`lib/staff-access.ts:1-9`); auth NextAuth Google + OTP staff (`lib/staff-auth.ts:20`).
- Email por Graph con tenant Azure de HBTJ (`lib/azure-mail.ts`), Blob store único, `LAST_303_CLOSE` por env (`reconcile-invoices.ts:11`).

---

## 3. Choque de stacks y opciones de integración

| | traduccionesjuradas-net | lavori |
|---|---|---|
| ORM/BD | Prisma 6 + PostgreSQL | Drizzle + Neon |
| Auth | NextAuth (Google) + OTP staff propio | OTP teléfono (Twilio) contra lista blanca, sesión opaca |
| Notif. | Graph (email) + Twilio SMS | web-push (PWA) |
| Pagos | Stripe + Redsys | — |

**(A) App hermana con SSO desde lavori** (repo nuevo, p.ej. `gestion.lavori.es`; el tablón enlaza con token firmado). Pros: no toca el repo del tablón, conserva Prisma. Contras: segundo deploy+BD+dominio+auth-bridge que mantener, y es infraestructura nueva para 10 usuarios → **viola "no sobre-construir para n=10"**. Esfuerzo medio-alto, riesgo operativo alto para una persona.

**(B) Módulo dentro del repo lavori, reescrito sobre Drizzle.** Lo que se reescribe es solo la capa de persistencia (CRUDs: `client-invoice`, `expenses`, `recurring-invoice`, `quotes` — son finos); los motores de cálculo (§2 genérico, ~1.000 líneas puras) y la UI React/Tailwind se **copian casi tal cual**. Multi-usuario trivial desde el día 1: `userId` = jurado del tablón, ya autenticado por OTP; numeración por usuario+año. Un solo deploy, una BD, una marca. Esfuerzo medio, riesgo bajo. **Right-sized.**

**(C) Instancias single-tenant por jurado** (un deploy/BD/Blob por cliente). Cero trabajo de multi-tenancy, pero operación ×N (migraciones, backups, incidencias) insostenible para una persona, y **no esquiva Verifactu** (sigue siendo software de facturación distribuido a terceros). Descartar.

---

## 4. Verifactu — EL gate (verificado 2026-07-10)

**Normativa:** RD 1007/2023 (Reglamento de requisitos de los sistemas informáticos de facturación, SIF) + Orden HAC/1177/2024. **Plazos vigentes tras el RDL 15/2025 (BOE 3-dic-2025):** obligación de uso el **1-ene-2027** para contribuyentes de IS y el **1-jul-2027** para autónomos/profesionales (era 2026; se aplazó un año). **PERO los productores/comercializadores de SIF están obligados desde el 29-jul-2025** a ofrecer solo sistemas adaptados, con declaración responsable — el aplazamiento NO les aplica. Fuentes: [nota informativa AEAT](https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/nota-informativa-ampliacion-plazo-adaptacion-facturacion.html) · [Noticias Jurídicas](https://noticias.juridicas.com/actualidad/noticias/20735-nueva-prorroga:-verifactu-no-sera-obligatorio-hasta-2027-para-sociedades-y-otros-contribuyentes/) · [inza.blog sobre RDL 15/2025](https://inza.blog/2025/12/04/modificacion-de-plazos-de-obligatoriedad-de-adopcion-de-verifactu/).

Consecuencias, sin edulcorar:

1. **En cuanto se vende a un tercero un software que GENERA facturas, Juan es productor de SIF** y debe cumplir YA (registros de facturación inalterables encadenados por hash, huella, QR de cotejo en factura, log de eventos, modo VERI*FACTU con envío a AEAT o modo verificable firmado, declaración responsable, sanciones de hasta 150.000 €). Hoy el módulo es **exactamente lo contrario**: borradores editables, `deleteInvoice` (`client-invoice.ts:294`), importación retroactiva (`:312`), sin hash, sin QR, sin registro de eventos. Tal cual, encaja en la definición de "software de doble uso" que el reglamento persigue. Adaptarlo es un proyecto serio de semanas, no un flag.
2. **HBTJ es S.L. → obligada a usar un SIF conforme para SÍ MISMA desde el 1-ene-2027.** El trabajo Verifactu hay que hacerlo igual, se venda o no. Esto convierte el gate en inversión de doble uso, pero no lo adelanta gratis.
3. **La línea limpia que permite un MVP legal HOY:** los **presupuestos NO son facturas** (docKind quote queda fuera del reglamento), y un **libro registro de facturas ya emitidas fuera** (registro/importación, sin generar la factura) es software contable, no SIF. Gastos, conciliación bancaria, borradores 303/130 y export gestoría tampoco son SIF. → El MVP puede vender todo eso sin tocar el reglamento, y dejar la EMISIÓN de facturas para una fase con Verifactu nativo o integrando un SIF tercero homologado por API.

**Otros gaps de producto (honestos):** RGPD — Juan pasa a ser encargado del tratamiento de los clientes de cada jurado → DPA, lista de subencargados (Vercel, Neon, Twilio, Anthropic, Stripe), registro de actividades; el storm ya avisó de que la AEPD es estricta con datos de autónomos. Soporte y onboarding (importar el año en curso; `importIssuedInvoice` ayuda). Backups/export de datos por usuario (portabilidad = confianza en un gremio de rivales). Facturar el propio servicio. Kit Digital: financia al jurado, pero ser agente digitalizador es otro expediente burocrático — no para n=10.

---

## 5. Opciones de empaquetado y recomendación

| Opción | Esfuerzo | Riesgo | Veredicto |
|---|---|---|---|
| (A) App hermana SSO, SaaS aparte | Alto (meses) | Operativo alto (2º sistema) | Solo si el piloto valida y n crece; hoy sobre-construye |
| **(B) Módulo "Gestión" dentro de lavori** | **Medio (semanas, alcance recortado)** | **Bajo** | **Recomendada** |
| (C) Instancias por jurado | Bajo unitario, ×N total | Insostenible 1 persona + Verifactu igual | Descartar |

**Recomendación: B, con el alcance de la Fase 1 recortado para esquivar Verifactu.** Lavori ya resuelve lo caro (identidad OTP+MAEC, canal, confianza del grupo) y un solo sistema es lo único que una persona con un negocio de traducción activo puede operar; los motores de cálculo se copian y solo se reescriben CRUDs finos sobre Drizzle. Además encaja milimétricamente con el modelo del storm: tablón gratis, herramienta a 9 €/mes fundador — y la señal de preventa (≥4/10) se obtiene ANTES de invertir el proyecto Verifactu.

**Precio orientativo (coherente con el storm):** 9 €/mes fundador congelado de por vida para el piloto, 12-15 €/mes después; un solo SKU (la suite entera, la emisión Verifactu se añade a la misma cuota cuando exista); tablón/perfil/avisos gratis siempre; Kit Digital como financiación del jurado, no como canal propio.

---

## 6. Ruta MVP (opción B, n≈10)

**Fase 0 — en traduccionesjuradas-net (1-2 semanas, útil pase lo que pase)**
Delimitar el core portable: parametrizar el emisor (sacar CIF/IBAN de `invoice-brands.ts` a datos), y tratar los módulos puros (§2) como frontera estable. Nada de refactor grande: HBTJ necesitará su propio Verifactu en ene-2027, este trabajo sirve doble.

**Fase 1 — piloto en el repo lavori (3-4 semanas de código)**
Tablas `gestion_*` en Drizzle con `userId` (numeración por usuario+año). Portar, por este orden:
1. **Presupuestos** (builder simplificado + PDF + estado enviado/aceptado/cobrado) — de `quote-math`/`quote-pdf`; sin Stripe: cada jurado cobra en su cuenta, se marca cobrado a mano.
2. **Gastos con IA** (`extract-expense` tal cual: foto de factura → gasto) + libro de gastos.
3. **Libro registro de facturas emitidas** (registro/importación, estilo `importIssuedInvoice` — NO generación de factura).
4. **Conciliación bancaria CSV** (`bank-parse` + `bank-reconcile`, ya puros) y **borradores 303/130** (`tax-drafts`, ya puro) + **export gestoría trimestral** (CSV+zip).

**Fase 2 — medir (4 semanas, reglas del storm)**
Preventa fundador por WhatsApp (≥4/10 = GO) + uso real. Documento plan-fundador escrito. Cero UI de pago hasta la señal.

**Fase 3 — solo con señal de pago: EMISIÓN de facturas Verifactu-nativa**
Registro de facturación inmutable con hash encadenado + QR + modo VERI*FACTU (envío AEAT; más simple que el modo verificable firmado), declaración responsable, DPA/RGPD formal. Resuelve a la vez la obligación propia de HBTJ (1-ene-2027). Alternativa de arranque: emitir vía SIF tercero homologado por API y quedarse la capa de gestión.

**Qué NO hacer:** repo/SSO aparte ni multi-tenancy "de verdad" (sobre-construye para n=10); Stripe Connect/Redsys para cobros de terceros; multimarca por jurado; migrar traducciones a Drizzle o unificar stacks; agregadores bancarios PSD2; ser agente digitalizador Kit Digital; y sobre todo **no prometer ni vender emisión de facturas antes de que exista el cumplimiento Verifactu** — es la única pieza con sanción de seis cifras.
