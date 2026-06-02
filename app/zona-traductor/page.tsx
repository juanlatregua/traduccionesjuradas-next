import type { Metadata } from "next";
import AutoRefresh from "@/components/AutoRefresh";
import BandejaEntrada from "@/components/BandejaEntrada";
import ZonaTraductorNav from "@/components/ZonaTraductorNav";
import { authZonaTraductorOrRedirect, loadBandejaState } from "@/lib/zona-traductor-data";

export const metadata: Metadata = {
  title: "Zona traductor — Bandeja",
  description: "Gestion interna de pedidos para traductor y administracion.",
  robots: { index: false, follow: false },
};

export default async function ZonaTraductorBandejaPage() {
  const email = await authZonaTraductorOrRedirect();
  const { orders, pedidosAccionables } = await loadBandejaState();

  return (
    <div className="min-h-screen bg-slate-950">
      <ZonaTraductorNav modoActivo="bandeja" pedidosAccionables={pedidosAccionables} />
      <AutoRefresh intervalMs={20000} idleMs={30000} />
      <BandejaEntrada orders={orders} staffEmail={email} />
    </div>
  );
}
