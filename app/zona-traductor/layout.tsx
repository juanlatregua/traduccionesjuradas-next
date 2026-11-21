// Monta el menú central (MesaNav) en TODA la zona traductor para que
// NUNCA se pierda al entrar en una pestaña. El nav se oculta solo en /verificar.
// #zona-traductor-root: fondo claro de la mesa.
import MesaNav from "@/components/mesa/MesaNav";
import { getStaffRole } from "@/lib/staff-access";
import {
  countPresupuestosAccionables,
  getZonaTraductorStaffEmail,
  loadBandejaState,
} from "@/lib/zona-traductor-data";

export default async function ZonaTraductorLayout({ children }: { children: React.ReactNode }) {
  // Auth ANTES de tocar la BD: sin staff verificado no hay badges que contar y
  // no se paga la carga de pedidos (la query más pesada de la zona). Las páginas
  // hijas hacen su propio gate con authZonaTraductorOrRedirect.
  const staffEmail = await getZonaTraductorStaffEmail();

  let pedidosAccionables = 0;
  let presupuestosAccionables = 0;
  if (staffEmail) {
    try {
      const [bandeja, presupuestos] = await Promise.all([
        loadBandejaState(),
        countPresupuestosAccionables(),
      ]);
      pedidosAccionables = bandeja.pedidosAccionables;
      presupuestosAccionables = presupuestos;
    } catch {
      // Un fallo de datos no debe tumbar toda la zona: el nav se pinta sin badges.
    }
  }

  return (
    <div id="zona-traductor-root" className="min-h-screen bg-[#F6F7F9] text-[#1F2933]">
      <MesaNav
        pedidosAccionables={pedidosAccionables}
        presupuestosAccionables={presupuestosAccionables}
        staffEmail={staffEmail}
        staffRole={getStaffRole(staffEmail)}
      />
      {children}
    </div>
  );
}
