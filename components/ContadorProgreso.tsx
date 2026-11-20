"use client";

// Progreso del contador de TraduCAT para un escaneado (staff). Pregunta cada 7 s
// mientras el trabajo sigue vivo y para en cuanto termina, falla o se abandona.
import { useEffect, useState } from "react";

type Status = {
  ok: boolean;
  activo: boolean;
  estado: string | null;
  paginasHechas: number | null;
  paginasTotal: number | null;
  palabrasContador: number | null;
  palabrasHaiku: number | null;
  aplicado: boolean;
  aviso: { differs?: boolean; diffPct?: number } | null;
};

const VIVOS = new Set(["pendiente_envio", "en_cola", "contando"]);
const POLL_MS = 7_000;

export default function ContadorProgreso({
  documentId,
  currentWords,
  onUse,
}: {
  documentId: string;
  currentWords?: number;
  onUse?: (words: number) => void;
}) {
  const [s, setS] = useState<Status | null>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch(`/api/zona-traductor/contador/${encodeURIComponent(documentId)}`, { cache: "no-store" });
        const data: Status = await res.json();
        if (stop) return;
        if (data.ok) setS(data);
        if (data.ok && data.estado && VIVOS.has(data.estado)) {
          timer = setTimeout(tick, POLL_MS);
        }
      } catch {
        if (!stop) timer = setTimeout(tick, POLL_MS);
      }
    };
    tick();
    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
    };
  }, [documentId]);

  if (!s || !s.activo || !s.estado) return null;

  if (VIVOS.has(s.estado)) {
    const total = s.paginasTotal || 0;
    return (
      <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-cyan-300" aria-live="polite">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
        {s.estado === "contando" && total > 0
          ? `Contando palabras… ${s.paginasHechas || 0} de ${total} páginas`
          : "Contando palabras… en cola"}
        <span className="text-slate-500">· provisional: Haiku</span>
      </div>
    );
  }

  if (s.aplicado && s.palabrasContador != null) {
    const differs = !!s.aviso?.differs;
    return (
      <div className={`mt-1 flex flex-col items-end gap-0.5 text-[10px] ${differs ? "text-amber-300" : "text-emerald-300"}`}>
        <span title="Cifra del contador de TraduCAT; la de Haiku queda como referencia">
          Contador: {s.palabrasContador} palabras (Haiku {s.palabrasHaiku ?? "—"}
          {differs ? `, ${s.aviso?.diffPct} %` : ""})
        </span>
        {onUse && currentWords !== s.palabrasContador && (
          <button
            type="button"
            onClick={() => onUse(s.palabrasContador!)}
            className="rounded border border-emerald-500/50 px-1 text-emerald-200 hover:bg-emerald-500/10"
          >
            Usar {s.palabrasContador}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-1 text-[10px] text-slate-400" title="El contador no terminó: la cifra es la estimación de Haiku">
      Contador no disponible: cifra de Haiku (estimación)
    </div>
  );
}
