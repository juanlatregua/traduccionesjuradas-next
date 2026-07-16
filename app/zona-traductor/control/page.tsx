import { redirect } from "next/navigation";

// El Resumen/control se fusionó con la Bandeja en la pestaña Pedidos: eran dos
// vistas del mismo dataset con dos sistemas de filtrado paralelos. Nada se
// pierde (KPIs, filtros, tabla/bulk y export CSV viven ahora en /zona-traductor,
// vista Tabla). El redirect conserva los filtros de enlaces viejos (SMS/email).
export default function ZonaTraductorControlPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (key === "modo") continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) params.set(key, v);
  }
  // El control era la vista de tabla: aterriza en la lectura equivalente.
  if (!params.has("vista")) params.set("vista", "tabla");
  redirect(`/zona-traductor?${params.toString()}`);
}
