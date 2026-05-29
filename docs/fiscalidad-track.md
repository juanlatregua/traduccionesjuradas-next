# Track fiscal / contabilidad — paralelo a v2

**Arrancado:** 2026-05-29 · **Naturaleza:** workstream **separado de v2**.

## Encuadre
v2 es la capa **client-facing** (captación → puerta → acompañamiento → idioma → lanzamiento 1-sept),
y su alcance es sagrado. Este track es **ops internas en zona-traductor**: contabilidad, márgenes,
facturación. **No toca el funnel ni el modelo de pedido core de forma destructiva** — todo additivo —,
así que ambos avanzan en paralelo sin chocar. Es imprescindible: la tarea fiscal/contable es obligatoria
para el negocio.

## Hecho (sin/with migración aditiva)
- **Factura cliente numerada** (`ClientInvoice`, `FAC-AAAA-NNNNN`, persistida + IVA congelado). Sustituye
  el `F-{ref}` sin valor legal. Ruta `invoice-pdf` ya la emite.
- **Coste de colaborador → margen automático**: el endpoint `finance/margin` detecta el coste de proveedor
  sumando los `CollaboratorAssignment.quotedPriceCents` aceptados/entregados (antes se reescribía a mano).
- **Pago manual de presupuesto** (Bizum/transferencia) → registra `QuotePayment` + dispara el pedido.

## Siguiente — sin migración
1. **OrderFinancePanel**: mostrar el `autoSupplierCostCents` detectado (prefill del campo de coste) y el
   origen (auto/manual). Pequeño, alto valor de usabilidad.
2. **Lista de facturas emitidas** en zona-traductor/admin: tabla de `ClientInvoice` (número, pedido, base,
   IVA, total, fecha) con filtro por periodo.
3. **Export contable** (CSV/XLSX) para la gestoría: por periodo, con base imponible, IVA repercutido,
   IRPF retenido a proveedores, total neto. Hoy el export es operativo, no contable.

## Siguiente — con migración aditiva (enseñar SQL antes)
4. **Persistir snapshots financieros** en tablas consultables (margen, IRPF, conciliación) en vez de solo
   `OrderEvent` JSON → permite informes por periodo sin parsear eventos.
5. **`SupplierInvoice` persistente** (factura del proveedor/colaborador): estado, IRPF, lote mensual,
   numeración. Hoy vive como evento.
6. **Informes fiscales por periodo**: IVA trimestral (repercutido vs soportado), IRPF por proveedor/mes,
   conciliación facturas emitidas ↔ cobros.

## Principio
Todo additivo. Nada de este track bloquea ni reescribe el camino client-facing de v2. Cada migración se
previsualiza (SQL) antes de aplicar a prod.
