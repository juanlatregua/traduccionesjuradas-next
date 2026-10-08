// Filtros nuevos de Pedidos (los que cuelgan de los KPIs y chips de la cabecera). Compartido con el export CSV.
import { isOrderInBooks } from "@/lib/bizum-ledger";
import { isPorCobrar, isPorEntregar } from "@/lib/pedidos-kpis";

/** Pago al traductor pendiente: cobrado, en libros, con coste de traductor y sin su factura pagada. */
export function isPagoProveedorPendiente(o: any): boolean {
  return (
    o.paymentStatus === "PAID" &&
    isOrderInBooks(o) &&
    (o.financeSnapshot?.marginSupplierCostCents ?? 0) > 0 &&
    o.financeSnapshot?.supplierInvoiceStatus !== "PAID"
  );
}

/** undefined si `filtro` no es uno de los nuevos. */
export function matchesHeaderFilter(o: any, filtro: string): boolean | undefined {
  switch (filtro) {
    case "cobrados":
      return o.paymentStatus === "PAID";
    case "por-entregar":
      return isPorEntregar(o);
    case "por-cobrar":
      return isPorCobrar(o);
    case "pago-proveedor-pendiente":
      return isPagoProveedorPendiente(o);
    default:
      return undefined;
  }
}
