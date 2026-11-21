import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HoyVista from "@/components/mesa/HoyVista";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { mesaV2On } from "@/lib/mesa/flag";
import { cargarMesa } from "@/lib/mesa/datos";

export const metadata: Metadata = {
  title: "Zona traductor — Hoy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HoyPage() {
  if (!mesaV2On()) notFound();
  await authZonaTraductorOrRedirect();
  const ahora = new Date();
  return <HoyVista mesa={await cargarMesa(ahora)} ahora={ahora} />;
}
