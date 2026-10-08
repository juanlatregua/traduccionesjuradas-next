// Filtros nuevos de Pedidos (los que cuelgan de los KPIs y chips de la cabecera). Compartido con el export CSV.
import { isOrderInBooks } from "@/lib/bizum-ledger";
import { isTestTitle } from "@/lib/panel-metrics";
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
      // Mismo criterio que el Panel: cobrados y sin pedidos de prueba.
      return o.paymentStatus === "PAID" && !isTestTitle(o.title);
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
