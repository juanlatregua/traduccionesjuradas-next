// Monta el menú central (ZonaTraductorNav) en TODA la zona traductor para que
// NUNCA se pierda al entrar en una pestaña. El nav se oculta solo en /verificar.
// #zona-traductor-root mantiene el tema oscuro por defecto.
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import { loadBandejaState } from "@/lib/zona-traductor-data";

export default async function ZonaTraductorLayout({ children }: { children: React.ReactNode }) {
  let pedidosAccionables = 0;
  try {
    pedidosAccionables = (await loadBandejaState()).pedidosAccionables;
  } catch {
    // sin sesión (p.ej. /verificar) o error de datos: el nav se oculta igual.
  }
  return (
    <div id="zona-traductor-root">
      <ZonaTraductorNav pedidosAccionables={pedidosAccionables} />
      {children}
    </div>
  );
}
