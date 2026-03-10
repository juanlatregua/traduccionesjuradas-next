import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAssignmentByToken, getDocumentsFromOrder } from "@/lib/collaborators";
import CollaboratorQuoteForm from "@/components/CollaboratorQuoteForm";
import CollaboratorDeliveryForm from "@/components/CollaboratorDeliveryForm";

export const metadata: Metadata = {
  title: "Encargo de traducción",
  robots: { index: false, follow: false },
};

function resolveIp() {
  const h = headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return h.get("x-real-ip") || "unknown";
}

type Props = {
  params: { token: string };
};

export default async function EncargoPage({ params }: Props) {
  const ip = resolveIp();
  const rl = await checkRateLimit({
    key: `encargo-page:${params.token}:${ip}`,
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (!rl.ok) {
    return (
      <main className="min-h-screen bg-parchment px-4 py-10">
        <section className="mx-auto max-w-2xl rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          Has superado el límite de consultas. Espera unos minutos e inténtalo de nuevo.
        </section>
      </main>
    );
  }

  const assignment = await getAssignmentByToken(params.token);
  if (!assignment) {
    notFound();
  }

  const documents = getDocumentsFromOrder(assignment.order);

  return (
    <main className="min-h-screen bg-parchment px-4 py-10">
      <section className="mx-auto max-w-3xl rounded-3xl border border-cream bg-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-bleu">
          Encargo de traducción jurada
        </p>
        <h1 className="mt-2 text-2xl font-bold text-encre">
          {assignment.order.title}
        </h1>
        <p className="mt-1 text-sm text-sepia">
          Referencia: <strong>{assignment.order.reference}</strong>
          {assignment.order.langPair && (
            <> · Par: <strong>{assignment.order.langPair}</strong></>
          )}
        </p>
        <p className="mt-1 text-sm text-sepia">
          Hola, <strong>{assignment.collaborator.fullName}</strong>
        </p>

        {assignment.adminNotes && (
          <div className="mt-4 rounded-xl border border-cream bg-cream/50 px-4 py-3 text-sm text-sepia">
            <p className="font-semibold text-encre">Notas del encargo:</p>
            <p className="mt-1">{assignment.adminNotes}</p>
          </div>
        )}

        {/* Documents */}
        <div className="mt-6">
          <h2 className="text-base font-semibold text-encre">Documentos del cliente</h2>
          {documents.length === 0 ? (
            <p className="mt-3 text-sm text-sepia">
              No hay documentos adjuntos. Si necesitas los documentos, contacta con el equipo.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {documents.map((doc, idx) => (
                <li
                  key={`${doc.url}-${idx}`}
                  className="flex items-center justify-between rounded-xl border border-cream bg-white px-4 py-3"
                >
                  <span className="text-sm text-encre">{doc.name}</span>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-bleu/40 px-3 py-1.5 text-xs font-semibold text-bleu hover:bg-cream"
                  >
                    Descargar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Status-dependent content */}
        <div className="mt-8">
          {assignment.status === "REQUESTED" && (
            <CollaboratorQuoteForm token={params.token} />
          )}

          {assignment.status === "QUOTE_REVISION_REQUESTED" && (
            <div>
              <div className="mb-4 rounded-xl border border-orange-200 bg-orange-50 px-6 py-5">
                <p className="text-lg font-semibold text-orange-900">
                  Revisión de presupuesto solicitada
                </p>
                {assignment.revisionReason && (
                  <p className="mt-2 text-sm text-orange-700">
                    <strong>Comentario:</strong> {assignment.revisionReason}
                  </p>
                )}
                {assignment.quotedPriceCents !== null && (
                  <p className="mt-2 text-sm text-orange-700">
                    Tu presupuesto anterior fue de{" "}
                    <strong>{((assignment.quotedPriceCents || 0) / 100).toFixed(2)} €</strong>
                    {assignment.quotedDeadline && (
                      <> con plazo{" "}
                        <strong>
                          {new Date(assignment.quotedDeadline).toLocaleDateString("es-ES")}
                        </strong>
                      </>
                    )}
                    . Por favor, envía un nuevo presupuesto ajustado.
                  </p>
                )}
              </div>
              <CollaboratorQuoteForm
                token={params.token}
                defaultPrice={
                  assignment.quotedPriceCents
                    ? ((assignment.quotedPriceCents) / 100).toFixed(2)
                    : undefined
                }
                defaultDeadline={
                  assignment.quotedDeadline
                    ? new Date(assignment.quotedDeadline).toISOString().split("T")[0]
                    : undefined
                }
                defaultNotes={assignment.collaboratorNotes || undefined}
              />
            </div>
          )}

          {assignment.status === "QUOTED" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-5 text-center">
              <p className="text-lg font-semibold text-blue-900">
                Presupuesto enviado
              </p>
              <p className="mt-2 text-sm text-blue-700">
                Tu presupuesto de{" "}
                <strong>{((assignment.quotedPriceCents || 0) / 100).toFixed(2)} €</strong>
                {" "}con plazo{" "}
                <strong>
                  {assignment.quotedDeadline
                    ? new Date(assignment.quotedDeadline).toLocaleDateString("es-ES")
                    : "—"}
                </strong>
                {" "}ha sido enviado. Estamos revisándolo y te notificaremos cuando haya una respuesta.
              </p>
            </div>
          )}

          {assignment.status === "ACCEPTED" && (
            <CollaboratorDeliveryForm token={params.token} />
          )}

          {assignment.status === "REJECTED" && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-5 text-center">
              <p className="text-lg font-semibold text-red-900">
                Encargo no aceptado
              </p>
              {assignment.rejectionReason && (
                <p className="mt-2 text-sm text-red-700">
                  Motivo: {assignment.rejectionReason}
                </p>
              )}
              <p className="mt-2 text-sm text-red-700">
                Gracias por tu tiempo. No dudes en contactarnos para futuros encargos.
              </p>
            </div>
          )}

          {assignment.status === "DELIVERED" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 text-center">
              <p className="text-lg font-semibold text-emerald-900">
                Entrega completada
              </p>
              <p className="mt-2 text-sm text-emerald-700">
                Archivo entregado: <strong>{assignment.deliveredFilename}</strong>
                {assignment.deliveredAt && (
                  <> el {new Date(assignment.deliveredAt).toLocaleDateString("es-ES")}</>
                )}
              </p>
              <p className="mt-2 text-sm text-emerald-700">
                Gracias por tu trabajo.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
