import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import StaffExpedienteIntake from "@/components/StaffExpedienteIntake";

export const metadata: Metadata = {
  title: "Zona traductor — Presupuesto de expediente",
  description: "Sube los documentos de un expediente y genera un presupuesto.",
  robots: { index: false, follow: false },
};

export default async function ZonaTraductorPresupuestoPage({
  searchParams,
}: {
  searchParams: { exp?: string };
}) {
  await authZonaTraductorOrRedirect();

  const expRef = typeof searchParams.exp === "string" ? searchParams.exp : null;
  let initialDocs: { documentId: string; fileName: string }[] | undefined;
  let initialCustomer: { name?: string; email?: string; phone?: string } | undefined;

  if (expRef) {
    const rows = await prisma.documentAnalysis.findMany({
      where: { sessionToken: `exp:${expRef}` },
      orderBy: { createdAt: "asc" },
      select: { id: true, fileName: true, clientName: true, clientEmail: true, clientPhone: true },
    });
    if (rows.length > 0) {
      initialDocs = rows.map((r) => ({ documentId: r.id, fileName: r.fileName }));
      initialCustomer = {
        name: rows[0].clientName || undefined,
        email: rows[0].clientEmail || undefined,
        phone: rows[0].clientPhone || undefined,
      };
    }
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-6">
          <a href="/zona-traductor/expedientes" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Expedientes
          </a>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            Presupuesto de expediente{expRef ? ` · ${expRef}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {expRef
              ? "Expediente del cliente. Los documentos se están analizando automáticamente. Revisa la tabla y genera el presupuesto."
              : "Suelta los documentos del cliente. Se extraen tipo, idioma, palabras y precio automáticamente (los PDFs con texto van por la vía barata). Revisa y genera el presupuesto."}
          </p>
        </header>

        <StaffExpedienteIntake initialDocs={initialDocs} initialCustomer={initialCustomer} />
      </div>
    </div>
  );
}
