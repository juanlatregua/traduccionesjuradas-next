"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Collaborator = {
  id: string;
  fullName: string;
  email: string;
  languages: string[];
  supplierType: string;
};

type Assignment = {
  id: string;
  status: string;
  collaboratorId: string;
  quotedPriceCents: number | null;
  quotedDeadline: string | null;
  collaboratorNotes: string | null;
  rejectionReason: string | null;
  revisionReason: string | null;
  deliveredFileUrl: string | null;
  deliveredFilename: string | null;
  deliveredAt: string | null;
  adminNotes: string | null;
  collaborator: {
    fullName: string;
    email: string;
  };
};

type Props = {
  reference: string;
  langPair: string | null;
  assignments: Assignment[];
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  REQUESTED: { label: "Enviado", cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  QUOTED: { label: "Presupuestado", cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  ACCEPTED: { label: "Aceptado", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  QUOTE_REVISION_REQUESTED: { label: "Revisión solicitada", cls: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  REJECTED: { label: "Rechazado", cls: "bg-red-500/20 text-red-300 border-red-500/30" },
  DELIVERED: { label: "Entregado", cls: "bg-lime-500/20 text-lime-300 border-lime-500/30" },
};

function parseLangFromPair(langPair: string | null): string | null {
  if (!langPair) return null;
  // Try "fr → es", "fr-es", "fr - es" patterns
  const separators = ["→", "->", "-", "–"];
  for (const sep of separators) {
    if (langPair.includes(sep)) {
      const part = langPair.split(sep)[0].trim().toLowerCase();
      if (part.length >= 2 && part.length <= 3) return part;
    }
  }
  return null;
}

export default function CollaboratorAssignmentPanel({ reference, langPair, assignments }: Props) {
  const router = useRouter();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorsError, setCollaboratorsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [revisingId, setRevisingId] = useState<string | null>(null);
  const [selectingBidId, setSelectingBidId] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/collaborators", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          const lang = parseLangFromPair(langPair);
          if (lang) {
            const filtered = data.collaborators.filter((c: Collaborator) =>
              c.languages.some((l) => l.toLowerCase() === lang || l.toLowerCase().includes(lang))
            );
            setCollaborators(filtered.length > 0 ? filtered : data.collaborators);
          } else {
            setCollaborators(data.collaborators);
          }
        } else {
          setCollaboratorsError("Error al cargar colaboradores.");
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setCollaboratorsError("Error al cargar colaboradores. Recarga la página.");
        }
      });
    return () => controller.abort();
  }, [langPair]);

  async function handleBroadcast() {
    setBroadcastMsg(null);
    setError(null);
    if (!window.confirm("Solicitar presupuesto a TODOS los colaboradores activos del idioma del pedido (FR se asigna directo a Juan Silva). ¿Continuar?")) {
      return;
    }
    setBroadcasting(true);
    try {
      const res = await fetch(`/api/orders/${reference}/quote-request-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al solicitar cotizaciones.");
        return;
      }
      setBroadcastMsg(
        data.direct
          ? "FR asignado directo a Juan Silva (sin concurso)."
          : `Cotización solicitada a ${data.notified?.length ?? 0} colaborador(es).`
      );
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleSendAssignment(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedId) {
      setError("Selecciona un colaborador.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/orders/${reference}/collaborator-assignment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collaboratorId: selectedId,
          adminNotes: adminNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al enviar encargo.");
        return;
      }
      setSelectedId("");
      setAdminNotes("");
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSending(false);
    }
  }

  async function handleResendEmail(assignmentId: string) {
    const confirmed = window.confirm("¿Reenviar el email de encargo al colaborador?");
    if (!confirmed) return;
    setActionLoading(assignmentId);
    try {
      const res = await fetch(`/api/orders/${reference}/collaborator-assignment/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend-email" }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al reenviar email.");
        return;
      }
      setError(null);
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleAction(assignmentId: string, action: "accept" | "reject", reason?: string, priceCents?: number | null) {
    if (action === "accept") {
      const priceLabel = priceCents ? `${(priceCents / 100).toFixed(2)} €` : "precio desconocido";
      const confirmed = window.confirm(
        `¿Confirmas aceptar el presupuesto de ${priceLabel}?\nEsto generará una factura de proveedor.`
      );
      if (!confirmed) return;
    }
    setActionLoading(assignmentId);
    try {
      const res = await fetch(`/api/orders/${reference}/collaborator-assignment/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al procesar acción.");
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevisionRequest(assignmentId: string) {
    setActionLoading(assignmentId);
    try {
      const res = await fetch(`/api/orders/${reference}/collaborator-assignment/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request-revision", reason: revisionReason }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al solicitar revisión.");
        return;
      }
      setRevisingId(null);
      setRevisionReason("");
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSelectBid(assignmentId: string, priceCents: number | null) {
    const priceLabel = priceCents ? `${(priceCents / 100).toFixed(2)} €` : "precio desconocido";
    const confirmed = window.confirm(
      `¿Elegir esta oferta (${priceLabel})?\nSe aceptará esta y se rechazarán el resto de presupuestos del pedido.`
    );
    if (!confirmed) return;
    setSelectingBidId(assignmentId);
    try {
      const res = await fetch(`/api/orders/${reference}/select-bid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "Error al elegir la oferta.");
        return;
      }
      setError(null);
      router.refresh();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSelectingBidId(null);
    }
  }

  // Fase 2: ofertas en concurso (QUOTED), ordenadas por precio y plazo.
  const quotedBids = assignments
    .filter((a) => a.status === "QUOTED" && a.quotedPriceCents !== null && a.quotedPriceCents > 0)
    .sort((a, b) => {
      const priceDiff = (a.quotedPriceCents as number) - (b.quotedPriceCents as number);
      if (priceDiff !== 0) return priceDiff;
      const aD = a.quotedDeadline ? new Date(a.quotedDeadline).getTime() : Infinity;
      const bD = b.quotedDeadline ? new Date(b.quotedDeadline).getTime() : Infinity;
      return aD - bD;
    });
  const suggestedBidId = quotedBids.length > 0 ? quotedBids[0].id : null;

  return (
    <div className="space-y-6">
      {/* Fase 2: comparativa de ofertas en concurso */}
      {quotedBids.length > 1 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Ofertas en concurso ({quotedBids.length})
          </p>
          <div className="mt-3 space-y-2">
            {quotedBids.map((a) => {
              const isSuggested = a.id === suggestedBidId;
              return (
                <div
                  key={`bid-${a.id}`}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${
                    isSuggested
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-950/70"
                  }`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {a.collaborator.fullName}
                      {isSuggested && (
                        <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
                          Sugerida
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      {a.quotedPriceCents !== null && (
                        <strong className="text-slate-200">{(a.quotedPriceCents / 100).toFixed(2)} €</strong>
                      )}
                      {a.quotedDeadline && (
                        <> · Plazo {new Date(a.quotedDeadline).toLocaleDateString("es-ES")}</>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectBid(a.id, a.quotedPriceCents)}
                    disabled={selectingBidId !== null}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {selectingBidId === a.id ? "Procesando..." : "Elegir y calcular precio"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Existing assignments */}
      {assignments.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
            Encargos enviados
          </p>
          <div className="mt-3 space-y-3">
            {assignments.map((a) => {
              const statusInfo = STATUS_LABELS[a.status] || STATUS_LABELS.REQUESTED;
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/70 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {a.collaborator.fullName}
                      </p>
                      <p className="text-xs text-slate-400">{a.collaborator.email}</p>
                    </div>
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {a.adminNotes && (
                    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
                      <span className="text-xs font-medium text-slate-400">Notas internas: </span>
                      <span className="text-xs text-slate-300">{a.adminNotes}</span>
                    </div>
                  )}

                  {a.status === "REQUESTED" && (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleResendEmail(a.id)}
                        disabled={actionLoading === a.id}
                        className="rounded-lg border border-blue-500/40 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-500/10 disabled:opacity-50"
                      >
                        {actionLoading === a.id ? "Reenviando..." : "Reenviar email"}
                      </button>
                    </div>
                  )}

                  {a.status === "QUOTED" && a.quotedPriceCents !== null && (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <p className="text-sm text-amber-200">
                        Precio: <strong>{(a.quotedPriceCents / 100).toFixed(2)} €</strong>
                        {a.quotedDeadline && (
                          <> · Plazo: <strong>{new Date(a.quotedDeadline).toLocaleDateString("es-ES")}</strong></>
                        )}
                      </p>
                      {a.collaboratorNotes && (
                        <p className="mt-1 text-xs text-slate-400">
                          Notas: {a.collaboratorNotes}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleAction(a.id, "accept", undefined, a.quotedPriceCents)}
                          disabled={actionLoading === a.id}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          Aceptar
                        </button>
                        {rejectingId !== a.id && revisingId !== a.id && (
                          <>
                            <button
                              type="button"
                              onClick={() => { setRevisingId(a.id); setRejectingId(null); }}
                              className="rounded-lg border border-orange-500/40 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/10"
                            >
                              Solicitar revisión
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRejectingId(a.id); setRevisingId(null); }}
                              className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                            >
                              Rechazar
                            </button>
                          </>
                        )}
                      </div>
                      {revisingId === a.id && (
                        <div className="mt-3 flex flex-col gap-2">
                          <textarea
                            value={revisionReason}
                            onChange={(e) => setRevisionReason(e.target.value)}
                            placeholder="Motivo de la revisión (opcional, se envía al colaborador)"
                            rows={2}
                            maxLength={500}
                            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleRevisionRequest(a.id)}
                              disabled={actionLoading === a.id}
                              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
                            >
                              Confirmar solicitud de revisión
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRevisingId(null); setRevisionReason(""); }}
                              className="text-xs text-slate-400 hover:text-slate-200"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                      {rejectingId === a.id && (
                        <div className="mt-3 flex flex-col gap-2">
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Motivo del rechazo (opcional)"
                            rows={2}
                            maxLength={500}
                            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs text-slate-200"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleAction(a.id, "reject", rejectReason)}
                              disabled={actionLoading === a.id}
                              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                            >
                              Confirmar rechazo
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRejectingId(null); setRejectReason(""); }}
                              className="text-xs text-slate-400 hover:text-slate-200"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {a.status === "QUOTE_REVISION_REQUESTED" && (
                    <div className="mt-3 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
                      <p className="text-sm text-orange-200">
                        Revisión de presupuesto solicitada
                      </p>
                      {a.quotedPriceCents !== null && (
                        <p className="mt-1 text-xs text-slate-400">
                          Precio anterior: <strong>{(a.quotedPriceCents / 100).toFixed(2)} €</strong>
                        </p>
                      )}
                      {a.revisionReason && (
                        <p className="mt-1 text-xs text-slate-400">
                          Motivo: {a.revisionReason}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-orange-300/70">
                        Esperando respuesta del colaborador...
                      </p>
                    </div>
                  )}

                  {a.status === "DELIVERED" && a.deliveredFileUrl && (
                    <div className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                      <p className="text-xs text-emerald-300">
                        Archivo entregado por {a.collaborator.fullName}
                        {a.deliveredAt && (
                          <span className="ml-2 text-emerald-400/60">
                            {new Date(a.deliveredAt).toLocaleString("es-ES")}
                          </span>
                        )}
                      </p>
                      <div className="mt-1.5 flex gap-2">
                        <a
                          href={a.deliveredFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-emerald-300 underline"
                        >
                          Descargar: {a.deliveredFilename || "Archivo entregado"}
                        </a>
                        <span className="text-slate-500">·</span>
                        <a
                          href={`/zona-traductor/pedido/${reference}`}
                          className="text-xs font-semibold text-cyan-300 underline"
                        >
                          Abrir pedido
                        </a>
                      </div>
                    </div>
                  )}

                  {a.status === "REJECTED" && a.rejectionReason && (
                    <p className="mt-2 text-xs text-red-300/70">
                      Motivo: {a.rejectionReason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fase 2: broadcast competitivo — pedir presupuesto a todos los del idioma */}
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
          Solicitar cotización a colaboradores
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Envía la petición de presupuesto a todos los colaboradores activos del idioma del pedido a la vez. El francés se asigna directo a Juan Silva.
        </p>
        {broadcastMsg && (
          <p role="status" className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {broadcastMsg}
          </p>
        )}
        <button
          type="button"
          onClick={handleBroadcast}
          disabled={broadcasting}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {broadcasting ? "Solicitando..." : "Solicitar cotización a todos"}
        </button>
      </div>

      {/* New assignment form */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-cyan-300">
          Enviar nuevo encargo
        </p>
        <form onSubmit={handleSendAssignment} className="mt-3 space-y-3">
          <div>
            <label htmlFor="collaborator-select" className="block text-xs font-medium text-slate-300">
              Colaborador
            </label>
            {collaboratorsError ? (
              <p role="alert" className="mt-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {collaboratorsError}
              </p>
            ) : (
              <select
                id="collaborator-select"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
              >
                <option value="">Seleccionar colaborador...</option>
                {collaborators.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.languages.join(", ").toUpperCase()}) — {c.supplierType}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label htmlFor="admin-notes" className="block text-xs font-medium text-slate-300">
              Notas para el colaborador (opcional)
            </label>
            <textarea
              id="admin-notes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Instrucciones especiales, urgencia, etc."
              className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending || !selectedId || !!collaboratorsError}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {sending ? "Enviando..." : "Enviar encargo"}
          </button>
        </form>
      </div>
    </div>
  );
}
