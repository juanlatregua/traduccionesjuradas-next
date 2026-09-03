import type { Metadata } from "next";
import Link from "next/link";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import { getBrand } from "@/lib/invoice-brands";
import { verifyEmitterChain } from "@/lib/verifactu/records";

export const metadata: Metadata = { title: "Declaración responsable · Facturación", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

// DECLARACIÓN RESPONSABLE del sistema informático de facturación (art. 13 RD
// 1007/2023 y art. 15 Orden HAC/1177/2024): debe estar VISIBLE en el propio
// sistema. Este es el sitio. El texto lo valida Laborlex antes de la fecha de
// obligación (1-ene-2027 para la S.L.); los datos técnicos salen del sistema.
export default async function DeclaracionResponsablePage() {
  await authZonaTraductorOrRedirect();
  const brand = getBrand("traduccionesjuradas");
  const version = (process.env.VERCEL_GIT_COMMIT_SHA || "local").slice(0, 7);
  const provider = process.env.VERIFACTU_PROVIDER || null;
  const chain = await verifyEmitterChain(brand.cif);
  const [records, events] = await Promise.all([
    prisma.invoiceRecord.count(),
    prisma.invoiceEvent.count(),
  ]);
  const card = "rounded-2xl border border-slate-700 bg-slate-900/60 p-5";
  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <div>
          <Link href="/zona-traductor/facturas" className="text-xs font-semibold text-cyan-400 hover:underline">← Facturas</Link>
          <h1 className="mt-1 text-2xl font-semibold text-white">Declaración responsable del sistema de facturación</h1>
          <p className="text-sm text-slate-400">Real Decreto 1007/2023, artículo 13 · Orden HAC/1177/2024, artículo 15. Visible en el sistema como exige la norma.</p>
        </div>

        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identificación del sistema</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-slate-500">Nombre</dt><dd className="text-slate-100">Facturación traduccionesjuradas.net</dd>
            <dt className="text-slate-500">Código</dt><dd className="font-mono text-slate-100">TJNET-SIF</dd>
            <dt className="text-slate-500">Versión</dt><dd className="font-mono text-slate-100">{version}</dd>
            <dt className="text-slate-500">Tipología</dt><dd className="text-slate-100">Sistema informático de facturación integrado en la plataforma de pedidos (uso propio del productor; no se comercializa a terceros en esta versión)</dd>
            <dt className="text-slate-500">Uso múltiple</dt><dd className="text-slate-100">No en esta versión (un único obligado tributario emisor)</dd>
            <dt className="text-slate-500">Modalidad</dt><dd className="text-slate-100">{provider ? `VERI*FACTU — remisión a la AEAT mediante ${provider} (colaborador social)` : "Registros de facturación encadenados con huella; remisión a la AEAT pendiente de alta del proveedor"}</dd>
          </dl>
        </div>

        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Productor</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-slate-500">Razón social</dt><dd className="text-slate-100">{brand.emitterName}</dd>
            <dt className="text-slate-500">NIF</dt><dd className="font-mono text-slate-100">{brand.cif}</dd>
            <dt className="text-slate-500">Domicilio</dt><dd className="text-slate-100">{brand.address}, {brand.city}</dd>
          </dl>
        </div>

        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Funcionalidades y garantías</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-300">
            <li>Por cada factura emitida se genera un registro de facturación de alta; por cada anulación, un registro de anulación. Ambos llevan huella SHA-256 encadenada con la del registro anterior del mismo emisor (algoritmo de la especificación de la AEAT, verificado contra su ejemplo oficial).</li>
            <li>Las facturas emitidas no se modifican ni se borran: la corrección se hace mediante factura rectificativa y la baja mediante registro de anulación.</li>
            <li>Registro de eventos del sistema: emisión, registro, remisión, cobro, rectificación, anulación, importación e intentos de modificación rechazados.</li>
            <li>Conservación de registros y eventos en la base de datos de producción con copias de seguridad, accesibles y legibles desde este sistema.</li>
            <li>El código QR de cotejo y la frase «Factura verificable en la sede electrónica de la AEAT» se imprimen únicamente cuando el registro ha sido aceptado por la AEAT.</li>
          </ul>
        </div>

        <div className={card}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado ahora mismo</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
            <dt className="text-slate-500">Registros de facturación</dt><dd className="font-mono text-slate-100">{records}</dd>
            <dt className="text-slate-500">Eventos</dt><dd className="font-mono text-slate-100">{events}</dd>
            <dt className="text-slate-500">Cadena del emisor {brand.cif}</dt>
            <dd className={chain.brokenAt === -1 ? "text-emerald-300" : "text-red-300"}>
              {chain.count} registro(s) · {chain.brokenAt === -1 ? "íntegra" : `ROTA en el índice ${chain.brokenAt + 1}`}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-slate-500">Las facturas emitidas antes del 3 de septiembre de 2026 se conservan como libro de facturas emitidas con el sistema anterior; la cadena arranca en esa fecha.</p>
        </div>

        <p className="text-xs text-slate-500">Firma y lugar: pendiente de validación del texto por la gestoría (Laborlex) y de la fecha de obligación. El productor declara que el sistema cumple lo dispuesto en el artículo 29.2.j) de la Ley 58/2003 y en el Reglamento aprobado por el RD 1007/2023, en los términos descritos.</p>
      </div>
    </div>
  );
}
