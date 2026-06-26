import type { Metadata } from "next";
import { authZonaTraductorOrRedirect } from "@/lib/zona-traductor-data";
import { prisma } from "@/lib/prisma";
import StaffExpedienteIntake from "@/components/StaffExpedienteIntake";

export const metadata: Metadata = {
  title: "Zona traductor — Presupuesto",
  description: "Crea un presupuesto manual o sube los documentos de un expediente.",
  robots: { index: false, follow: false },
};

const s = (raw?: string | string[]) =>
  (Array.isArray(raw) ? raw[0] : raw || "").trim();

function parseLangPair(raw: string) {
  const [source, target] = raw.toLowerCase().split("-");
  return source && target ? { source, target } : { source: "", target: "" };
}

export default async function ZonaTraductorPresupuestoPage({
  searchParams,
}: {
  searchParams: {
    exp?: string;
    customerEmail?: string;
    customerName?: string;
    customerPhone?: string;
    sourceLang?: string;
    targetLang?: string;
    langPair?: string;
    lineDescription?: string;
    lineAmount?: string;
    deliveryType?: string;
  };
}) {
  await authZonaTraductorOrRedirect();

  const expRef = typeof searchParams.exp === "string" ? searchParams.exp : null;

  // Prefill del builder manual (deep-links desde el panel del pedido, PM, etc.).
  const pair = parseLangPair(s(searchParams.langPair));
  const builderInitial = {
    customerName: s(searchParams.customerName) || undefined,
    customerEmail: s(searchParams.customerEmail) || undefined,
    customerPhone: s(searchParams.customerPhone) || undefined,
    sourceLang: s(searchParams.sourceLang) || pair.source || undefined,
    targetLang: s(searchParams.targetLang) || pair.target || undefined,
    deliveryType:
      s(searchParams.deliveryType).toUpperCase() === "PAPER_SHIP"
        ? ("PAPER_SHIP" as const)
        : undefined,
    lineDescription: s(searchParams.lineDescription) || undefined,
    lineAmount: s(searchParams.lineAmount) || undefined,
  };
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
            Presupuesto{expRef ? ` de expediente · ${expRef}` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {expRef
              ? "Expediente del cliente. Los documentos se están analizando automáticamente. Revisa la tabla y genera el presupuesto."
              : "Crea un presupuesto manual (lead de WhatsApp/teléfono) o suelta los documentos del cliente abajo para extraer tipo, idioma, palabras y precio automáticamente."}
          </p>
        </header>

        <StaffExpedienteIntake
          initialDocs={initialDocs}
          initialCustomer={initialCustomer}
          initialData={expRef ? undefined : builderInitial}
          expedienteRef={expRef}
        />
      </div>
    </div>
  );
}
