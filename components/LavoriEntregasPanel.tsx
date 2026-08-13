"use client";

// Panel de entregas llegadas por el puente lavori (Fase 2, opción B de Juan):
// la traducción NUNCA sale sola hacia el cliente — aquí se revisa (enlace al
// fichero) y un clic decide el carril:
// - Pedido digital: "Revisar y enviar al cliente" → /delivery con notifyClient
//   (email con adjuntos + factura si emitida + SMS "traducción lista").
// - Pedido en PAPEL: "Marcar lista para recoger" → /delivery SIN email; el
//   original físico se recoge por mensajería (el traductor indica dirección y
//   disponibilidad en la entrega) y el cliente se avisa con el flujo de envío.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type LavoriEntrega = {
  url: string;
  nombre: string;
  miembro: string;
  fecha: string; // ISO
  mimeType: string | null;
  recogida: string | null; // dirección + día/horario para la mensajería (papel)
  enviada: boolean;
};

export default function LavoriEntregasPanel({
  reference,
  entregas,
  paper,
}: {
  reference: string;
  entregas: LavoriEntrega[];
  paper: boolean;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pendientes = entregas.filter((e) => !e.enviada);
  const recogidas = entregas.map((e) => e.recogida).filter(Boolean) as string[];

  async function procesar() {
    if (pendientes.length === 0) return;
    const ok = window.confirm(
      paper
        ? `Se marcarán ${pendientes.length} archivo(s) como traducción lista (SIN email al cliente). El original viaja en papel: organiza la recogida con la mensajería.`
        : `Se enviarán ${pendientes.length} archivo${pendientes.length === 1 ? "" : "s"} al cliente ` +
            `(email con adjuntos + aviso de traducción lista). ¿Los has revisado?`
    );
    if (!ok) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state: "TRADUCIDO",
          notifyClient: !paper,
          files: pendientes.map((e) => ({
            url: e.url,
            filename: e.nombre,
            mimeType: e.mimeType,
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "No se pudo procesar la entrega.");
      }
      setDone(true);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Error al procesar la entrega.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
      <p className="text-xs font-semibold text-violet-300">
        Entregas del traductor vía lavori ({entregas.length})
        {paper ? " · pedido en PAPEL" : ""}
      </p>
      <ul className="mt-1.5 space-y-1">
        {entregas.map((e, i) => (
          <li key={i} className="text-sm text-slate-300">
            <a
              href={e.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:underline"
            >
              {e.enviada ? "✓" : "●"} {e.nombre}
            </a>{" "}
            <span className="text-xs text-slate-400">
              — {e.miembro} · {new Date(e.fecha).toLocaleDateString("es-ES")}
              {e.enviada ? (paper ? " · lista" : " · ya enviada al cliente") : " · SIN procesar"}
            </span>
          </li>
        ))}
      </ul>
      {recogidas.length > 0 && (
        <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2">
          <p className="text-xs font-semibold text-amber-300">Recogida por mensajería</p>
          {recogidas.map((r, i) => (
            <p key={i} className="text-xs text-amber-200/90">{r}</p>
          ))}
        </div>
      )}
      {pendientes.length > 0 && !done ? (
        <div className="mt-3 border-t border-violet-500/20 pt-3">
          <p className="mb-2 text-xs text-slate-400">
            {paper
              ? "Nada sale al cliente por email: revisa la copia, marca lista y organiza la recogida del original con la mensajería."
              : "Nada ha salido hacia el cliente: ábrelas, revísalas y envíalas con un clic."}
          </p>
          <button
            type="button"
            onClick={procesar}
            disabled={sending}
            className="rounded-lg bg-violet-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"
          >
            {sending
              ? "Procesando…"
              : paper
                ? `Marcar lista para recoger (${pendientes.length}, sin email)`
                : `Revisar y enviar al cliente (${pendientes.length})`}
          </button>
          {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
        </div>
      ) : (
        <p className="mt-3 border-t border-violet-500/20 pt-3 text-xs text-emerald-300">
          {done
            ? paper
              ? "Traducción marcada lista (sin email). Organiza la recogida y notifica el envío desde la ficha ✓"
              : "Entrega enviada al cliente ✓"
            : "Todas las entregas de lavori ya fueron procesadas."}
        </p>
      )}
    </div>
  );
}
