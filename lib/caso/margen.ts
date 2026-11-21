// Margen de un pedido (regla «nunca puedo perder»): neto del presupuesto (total − IVA) menos el coste del jurado.
// Lógica pura, compartida por las dos fichas del caso. null = falta presupuesto o coste para calcularlo.
export function margenPedido(i: { quoteTotal: number | null; quoteVat: number | null; supplierCostCents: number | null }): { neto: number | null; margen: number | null } {
  const neto = i.quoteTotal != null ? i.quoteTotal - (i.quoteVat ?? 0) : null;
  const margen = neto != null && i.supplierCostCents != null ? neto - i.supplierCostCents / 100 : null;
  return { neto, margen };
}

/** Varios pedidos vivos de un mismo presupuesto: el neto es del presupuesto entero, así que el coste es la suma
 * (null si a alguno le falta) y el margen se enseña una sola vez, en el primero. */
export function costeDelPresupuesto(pedidos: { supplierCostCents: number | null }[]): number | null {
  return pedidos.some((p) => p.supplierCostCents == null) ? null : pedidos.reduce((s, p) => s + (p.supplierCostCents as number), 0);
}
