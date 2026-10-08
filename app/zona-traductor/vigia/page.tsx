import type { Metadata } from "next";
import Link from "next/link";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { buildVigia, renderAccionesHtml } from "@/lib/vigia";

export const metadata: Metadata = {
  title: "Zona traductor — Gestión de hoy",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VigiaPage() {
  await authZonaTraductorOrRedirect();
  const v = await buildVigia(7);
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 text-slate-100">
      <Link href="/zona-traductor" className="text-sm text-cyan-300 hover:underline">← Zona traductor</Link>
      <h1 className="mt-3 text-2xl font-semibold">Gestión de hoy</h1>
      <p className="mt-1 text-sm text-slate-400">
        Una fila por persona o pedido. «Ya lo traté» la oculta 4 días; «Posponer 7 d», una semana.
      </p>
      <div
        className="mt-5 rounded-2xl bg-white p-5 text-slate-800"
        dangerouslySetInnerHTML={{ __html: v.acciones.length ? renderAccionesHtml(v.acciones) : "<p>Nada pendiente.</p>" }}
      />
      {v.ocultos.length > 0 && (
        <details className="mt-4 text-sm text-slate-400">
          <summary className="cursor-pointer">Ocultos ({v.ocultos.length}): tratados, pospuestos o avisados hace poco</summary>
          <ul className="mt-2 list-disc pl-5">
            {v.ocultos.map((o, i) => (
              <li key={i}>{o.quien} — {o.motivo}</li>
            ))}
          </ul>
        </details>
      )}
    </main>
  );
}
