"use client";

import { useState } from "react";
import { findTranslatorProfile, formatTranslatorCredential, getTranslatorProfiles } from "@/lib/translators";

type Props = {
  reference: string;
  currentAssignedTo?: string | null;
  currentDueDate?: string | null;
};

export default function AssignOrderForm({ reference, currentAssignedTo, currentDueDate }: Props) {
  const [assignedTo, setAssignedTo] = useState(currentAssignedTo || "");
  const [dueDate, setDueDate] = useState(currentDueDate || "");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const selectedProfile = findTranslatorProfile(assignedTo);
  const translatorProfiles = getTranslatorProfiles();

  async function submit() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/orders/${reference}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignedTo: assignedTo.trim() || null,
          dueDate: dueDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Error al asignar.");
      }
      setMessage("Asignacion guardada.");
    } catch (err: any) {
      setMessage(err?.message || "Error al asignar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">
        Asignar traductor y fecha limite
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          list="translator-profiles"
          placeholder="Nombre del traductor"
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
        />
        <datalist id="translator-profiles">
          {translatorProfiles.map((profile) => (
            <option key={profile.id} value={profile.fullName}>
              {formatTranslatorCredential(profile)}
            </option>
          ))}
        </datalist>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
        />
      </div>
      {selectedProfile && (
        <p className="mt-2 text-xs text-amber-200">
          {formatTranslatorCredential(selectedProfile)}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="mt-3 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {loading ? "Guardando..." : "Guardar asignacion"}
      </button>
      {message && <p className="mt-2 text-xs font-semibold text-slate-200">{message}</p>}
    </div>
  );
}
