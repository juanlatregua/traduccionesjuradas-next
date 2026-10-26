// Filtro de gestión por actividad (balance de Contabilidad). Solo para la vista de
// gestión: lo fiscal (303, 349, libro, gestoría, VeriFactu) usa siempre todas las marcas.

export type Activity = "todo" | "traduccion" | "clases";

export const ACTIVITY_OPTIONS: { value: Activity; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "traduccion", label: "Traducción" },
  { value: "clases", label: "Clases" },
];

const ACTIVITY_BRAND: Record<Exclude<Activity, "todo">, string> = {
  traduccion: "traduccionesjuradas",
  clases: "holabonjour",
};

// Sin marca (cobros de pedidos sin factura) = traducción: los pedidos son de la web.
export function matchesActivity(brand: string | null | undefined, activity: Activity): boolean {
  if (activity === "todo") return true;
  return (brand || "traduccionesjuradas") === ACTIVITY_BRAND[activity];
}

export function filterByActivity<T extends { brand?: string | null }>(rows: T[], activity: Activity): T[] {
  return activity === "todo" ? rows : rows.filter((r) => matchesActivity(r.brand, activity));
}
