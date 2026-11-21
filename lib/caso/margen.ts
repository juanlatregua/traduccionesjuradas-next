// Margen de un pedido (regla «nunca puedo perder»): neto del presupuesto (total − IVA) menos el coste del jurado.
// Lógica pura, compartida por las dos fichas del caso. null = falta presupuesto o coste para calcularlo.
export function margenPedido(i: { quoteTotal: number | null; quoteVat: number | null; supplierCostCents: number | null }): { neto: number | null; margen: number | null } {
  const neto = i.quoteTotal != null ? i.quoteTotal - (i.quoteVat ?? 0) : null;
  const margen = neto != null && i.supplierCostCents != null ? neto - i.supplierCostCents / 100 : null;
  return { neto, margen };
}
