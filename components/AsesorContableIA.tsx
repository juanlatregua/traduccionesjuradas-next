"use client";

import { useEffect, useState } from "react";

type Link = { label: string; url: string };
type Alerta = { gravedad: "alta" | "media" | "baja" | "info"; titulo: string; explicacion: string; cifra: string; enlaces: string[]; links: Link[] };
type Analisis = { resumen: string; alertas: Alerta[]; propuestas: { titulo: string; accion: string; impacto_estimado: string }[]; preguntas_gestoria: string[] };
type Guardado = { analisis: Analisis; at: string; dossierHash: string; model: string; dossier: unknown };
type Turno = { pregunta: string; respuesta: string; links: Link[]; gestoria: boolean };

const GRAV_STYLE: Record<Alerta["gravedad"], string> = {
  alta: "border-rose-500/60 bg-rose-950/30 text-rose-200",
  media: "border-amber-500/60 bg-amber-950/20 text-amber-200",
  baja: "border-sky-500/50 bg-sky-950/20 text-sky-200",
  info: "border-slate-600 bg-slate-900 text-slate-300",
};
const GRAV_ORDER = { alta: 0, media: 1, baja: 2, info: 3 } as const;

const storeKey = (p: string) => `asesor-contable:v1:${p}`;

function readStore(p: string): Guardado | null {
  try {
    const raw = window.localStorage.getItem(storeKey(p));
    return raw ? (JSON.parse(raw) as Guardado) : null;
  } catch {
    return null;
  }
}
function writeStore(p: string, g: Guardado) {
  try {
    window.localStorage.setItem(storeKey(p), JSON.stringify(g));
  } catch {
    /* sin almacenamiento: se recalcula */
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "medium", timeStyle: "short" });
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* portapapeles bloqueado */
        }
      }}
      className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
    >
      {done ? "Copiado" : "Copiar"}
    </button>
  );
}

function Links({ links }: { links: Link[] }) {
  if (!links.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {links.map((l) => (
        <a key={l.url + l.label} href={l.url} target="_blank" rel="noreferrer" className="rounded bg-slate-800 px-2 py-0.5 text-xs text-cyan-300 hover:underline">
          {l.label}
        </a>
      ))}
    </div>
  );
}

export default function AsesorContableIA({ periods }: { periods: { value: string; label: string }[] }) {
  const [period, setPeriod] = useState(periods[0]?.value ?? "");
  const [saved, setSaved] = useState<Guardado | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [showDossier, setShowDossier] = useState(false);

  // Solo lee el último análisis guardado en este navegador: nunca llama a la IA al cargar.
  useEffect(() => {
    setSaved(readStore(period));
    setTurnos([]);
    setError(null);
    setAviso(null);
  }, [period]);

  async function call(payload: Record<string, unknown>) {
    const res = await fetch("/api/zona-traductor/contabilidad/asesor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo completar la consulta.");
    return data;
  }

  async function analizar() {
    setLoading(true);
    setError(null);
    setAviso(null);
    try {
      const d = await call({ action: "analizar" });
      const g: Guardado = { analisis: d.analisis, at: d.generatedAt, dossierHash: d.dossierHash, model: d.model, dossier: d.dossier };
      writeStore(period, g);
      setSaved(g);
      setTurnos([]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function preguntar(e: React.FormEvent) {
    e.preventDefault();
    const pregunta = q.trim();
    if (!pregunta || asking) return;
    setAsking(true);
    setError(null);
    try {
      const d = await call({
        action: "preguntar",
        pregunta,
        dossierHash: saved?.dossierHash,
        historial: turnos.slice(-4).map((t) => ({ pregunta: t.pregunta, respuesta: t.respuesta })),
      });
      if (d.dossierCambio) setAviso("Los datos han cambiado desde el último análisis: la respuesta usa las cifras de ahora. Vuelve a analizar para ver el resumen al día.");
      setTurnos((t) => [...t, { pregunta, respuesta: d.respuesta.respuesta, links: d.respuesta.links, gestoria: d.respuesta.consultar_gestoria }].slice(-6));
      setQ("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAsking(false);
    }
  }

  const a = saved?.analisis;
  const alertas = a ? [...a.alertas].sort((x, y) => GRAV_ORDER[x.gravedad] - GRAV_ORDER[y.gravedad]) : [];

  return (
    <section className="mt-6 rounded-xl border border-violet-700/50 bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Asesor contable (IA)</h2>
          <p className="text-xs text-slate-400">Calcula las cifras en código y la IA solo las interpreta. No sustituye a la gestoría.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100">
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={analizar} disabled={loading} className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50">
            {loading ? "Analizando…" : saved ? "Volver a analizar" : "Analizar"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded border border-rose-600/50 bg-rose-950/30 p-2 text-sm text-rose-200">{error}</p>}

      {!a && !loading && <p className="mt-3 text-sm text-slate-400">Elige un periodo y pulsa «Analizar». No se llama a la IA hasta entonces.</p>}

      {a && saved && (
        <div className="mt-4 space-y-5">
          <p className="text-xs text-slate-500">
            Análisis hecho el {fmt(saved.at)} · modelo {saved.model} · guardado en este navegador
          </p>

          <div className="rounded-lg bg-slate-950 p-3 text-sm leading-relaxed text-slate-100">{a.resumen}</div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Alertas ({alertas.length})</h3>
            {alertas.length === 0 && <p className="text-sm text-slate-400">Sin alertas.</p>}
            <ul className="space-y-2">
              {alertas.map((al, i) => (
                <li key={i} className={`rounded-lg border p-3 ${GRAV_STYLE[al.gravedad]}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      <span className="mr-2 rounded bg-black/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{al.gravedad}</span>
                      {al.titulo}
                    </span>
                    {al.cifra && <span className="font-mono text-sm">{al.cifra}</span>}
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{al.explicacion}</p>
                  <Links links={al.links} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-200">Propuestas ({a.propuestas.length})</h3>
            {a.propuestas.length === 0 && <p className="text-sm text-slate-400">Sin propuestas operativas.</p>}
            <ul className="space-y-2">
              {a.propuestas.map((p, i) => (
                <li key={i} className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm">
                  <p className="font-semibold text-slate-100">{p.titulo}</p>
                  <p className="mt-1 text-slate-300">{p.accion}</p>
                  {p.impacto_estimado && <p className="mt-1 text-xs text-emerald-300">Impacto: {p.impacto_estimado}</p>}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Preguntas para la gestoría ({a.preguntas_gestoria.length})</h3>
              {a.preguntas_gestoria.length > 0 && <CopyButton text={a.preguntas_gestoria.map((x, i) => `${i + 1}. ${x}`).join("\n")} />}
            </div>
            <ul className="space-y-2">
              {a.preguntas_gestoria.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200">
                  <span>{p}</span>
                  <CopyButton text={p} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <button type="button" onClick={() => setShowDossier((s) => !s)} className="text-xs text-slate-400 underline">
              {showDossier ? "Ocultar" : "Ver"} las cifras del dossier que vio la IA
            </button>
            {showDossier && <pre className="mt-2 max-h-80 overflow-auto rounded bg-black/40 p-3 text-[11px] text-slate-300">{JSON.stringify(saved.dossier, null, 2)}</pre>}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-slate-800 pt-4">
        <h3 className="text-sm font-semibold text-slate-200">Pregúntale</h3>
        <p className="text-xs text-slate-500">Pregunta sobre el mismo periodo; solo responde con cifras del dossier (cada pregunta es una consulta a la IA).</p>
        {aviso && <p className="mt-2 text-xs text-amber-300">{aviso}</p>}
        <ul className="mt-3 space-y-3">
          {turnos.map((t, i) => (
            <li key={i} className="text-sm">
              <p className="font-semibold text-violet-200">{t.pregunta}</p>
              <p className="mt-1 whitespace-pre-wrap text-slate-200">{t.respuesta}</p>
              {t.gestoria && <p className="mt-1 text-xs text-amber-300">Depende de normativa: confírmalo con la gestoría.</p>}
              <Links links={t.links} />
            </li>
          ))}
        </ul>
        <form onSubmit={preguntar} className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={500}
            placeholder="Ej.: ¿qué gasto pesa más este trimestre?"
            className="min-w-0 flex-1 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          />
          <button type="submit" disabled={asking || !q.trim()} className="rounded-lg border border-violet-500 px-4 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-900/30 disabled:opacity-50">
            {asking ? "…" : "Preguntar"}
          </button>
        </form>
      </div>
    </section>
  );
}
