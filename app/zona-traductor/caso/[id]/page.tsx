import type { Metadata } from "next";
import { notFound } from "next/navigation";
import FichaVista from "@/components/mesa/FichaVista";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { mesaV2On } from "@/lib/mesa/flag";
import { cargarFicha, ganadora } from "@/lib/mesa/datos";
import { hitosDelCaso, idsPosibles, sesionesDe } from "@/lib/caso/hitos";
import { baseUrlStaff } from "@/lib/caso/vista";

export const metadata: Metadata = {
  title: "Zona traductor — Ficha del caso",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FichaCasoPage({ params }: { params: { id: string } }) {
  if (!mesaV2On()) notFound();
  await authZonaTraductorOrRedirect();
  const ficha = await cargarFicha(params.id);
  if (!ficha) notFound();
  const { caso } = ficha;
  const posiblesIds = idsPosibles(caso.eventos);
  const posibles = posiblesIds.length ? await prisma.caso.findMany({ where: { id: { in: posiblesIds } }, select: { id: true, ref: true, estado: true } }) : [];
  const hitos = hitosDelCaso({
    origen: caso.origen,
    sesiones: sesionesDe(caso.analyses),
    inbound: caso.inbound,
    priceRequests: caso.priceRequests,
    quotes: caso.quotes,
    orders: caso.orders.map((o) => ({ ...o, traductor: ganadora(o.collaboratorAssignments)?.collaborator.fullName || o.assignedTo })),
    eventos: caso.eventos,
  });
  return <FichaVista ficha={ficha} hitos={hitos} posibles={posibles} baseUrl={baseUrlStaff()} />;
}
