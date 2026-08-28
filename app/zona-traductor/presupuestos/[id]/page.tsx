import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import AdminQuoteDetailPanel from "@/components/AdminQuoteDetailPanel";
import ZonaTraductorSubNav from "@/components/ZonaTraductorSubNav";
import { authZonaTraductorOrRedirect, countExpedientesPendientes } from "@/lib/zona-traductor-data";
import { getQuoteByIdForAdmin } from "@/lib/quote-db";
import { serializeQuote } from "@/lib/quote-serializer";

export const metadata: Metadata = {
  title: "Zona traductor — Presupuesto",
  robots: { index: false, follow: false },
};

/**
 * S1 de la auditoría de coherencia (27-ago-2026): la ficha del presupuesto vivía
 * SOLO en /admin/quotes/[id], con tema claro y sin la navegación de la zona. Se
 * salía de la lista oscura y se aterrizaba en otra aplicación para volver a
 * entrar. Ahora la ficha vive aquí, en la misma cáscara que la lista, y
 * /admin/quotes/[id] redirige. El panel es EL MISMO componente: no se duplica.
 */
export default async function PresupuestoFichaPage({ params }: { params: { id: string } }) {
  await authZonaTraductorOrRedirect();
  const expedientesPendientes = await countExpedientesPendientes();

  const quote = await getQuoteByIdForAdmin(params.id);
  if (!quote) notFound();
  const serialized = serializeQuote(quote);
  if (!serialized) notFound();
  const numero = (serialized as any).quoteNumber || "";

  return (
    <div className="min-h-screen bg-slate-950">
      <main className="mx-auto max-w-6xl px-4 py-8">
        <ZonaTraductorSubNav
          tabs={[
            { href: "/zona-traductor/presupuestos", label: "Carpeta" },
            { href: "/zona-traductor/expedientes", label: "Expedientes", badge: expedientesPendientes },
          ]}
        />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/zona-traductor/presupuestos"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Presupuestos
            </Link>
            <span className="text-slate-600">·</span>
            <h1 className="font-mono text-sm font-bold text-cyan-300">{numero}</h1>
          </div>
          <Link
            href={`/zona-traductor/presupuestos/${params.id}/editar`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            <Pencil className="h-4 w-4" />
            Editar datos y líneas
          </Link>
        </div>
        {/* El panel se pintó para el tema claro; sobre el fondo oscuro se sirve
            en su propia tarjeta blanca para no reescribirlo entero en este paso.
            Repintarlo es S2: aquí lo que se arregla es la NAVEGACIÓN, que era el
            motivo real de perderse. */}
        <div className="rounded-2xl bg-cream p-1 shadow-xl">
          <AdminQuoteDetailPanel initialQuote={serialized as any} />
        </div>
      </main>
    </div>
  );
}
