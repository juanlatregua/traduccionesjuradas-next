import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readExpedienteToken } from "@/lib/expediente-token";
import { FileText } from "lucide-react";

export const metadata: Metadata = {
  title: "Estado de tu expediente | Traducciones Juradas",
  robots: { index: false, follow: false },
};

export default async function ExpedienteStatusPage({ params }: { params: { token: string } }) {
  const ref = readExpedienteToken(params.token);

  const docs = ref
    ? await prisma.documentAnalysis.findMany({
        where: { sessionToken: `exp:${ref}` },
        orderBy: { createdAt: "asc" },
        select: { id: true, fileName: true, createdAt: true, clientName: true },
      })
    : [];

  // notFound() en vez de renderizar el aviso: así responde 404 de verdad y un
  // token caducado deja de recrawlearse como 200 (soft 404). El mensaje con la
  // salida por WhatsApp vive ahora en el not-found.tsx de este segmento.
  if (!ref || docs.length === 0) {
    notFound();
  }

  const created = docs[0].createdAt;

  return (
    <main className="min-h-screen bg-parchment">
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-bleu">Expediente {ref}</p>
        <h1 className="mt-2 font-baskerville text-3xl text-encre">Estado de tu expediente</h1>

        <div className="mt-6 rounded-xl border border-bleu/20 bg-bleu/[0.04] p-5">
          <p className="font-semibold text-bleu">Recibido — preparando tu presupuesto</p>
          <p className="mt-1 text-sm text-graphite">
            Hemos recibido {docs.length} documento{docs.length === 1 ? "" : "s"} el{" "}
            {created.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}. Te
            enviaremos el presupuesto detallado por email lo antes posible.
          </p>
        </div>

        <h2 className="mt-8 mb-3 font-semibold text-encre">Documentos recibidos</h2>
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-lg border border-cream bg-card px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-bleu" />
              <span className="truncate text-sm text-encre" title={d.fileName}>{d.fileName}</span>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-sm text-graphite">
          ¿Alguna duda? Escríbenos por{" "}
          <a href="https://wa.me/34951333614" className="text-bleu underline">WhatsApp</a> o llama al 951 333 614.
        </p>
      </section>
    </main>
  );
}
