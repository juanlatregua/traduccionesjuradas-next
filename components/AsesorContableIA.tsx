"use client";

import { useEffect, useState } from "react";

type Link = { label: string; url: string };
type Alerta = { gravedad: "alta" | "media" | "baja" | "info"; titulo: string; explicacion: string; cifra: string; enlaces: string[]; links: Link[] };
type Analisis = { resumen: string; alertas: Alerta[]; propuestas: { titulo: string; accion: string; impacto_estimado: string }[]; preguntas_gestoria: string[] };
type Guardado = { analisis: Analisis; at: string; dossierHash: string; model: string; dossier: unknown };
type Turno = { pregunta: string; respuesta: string; links: Link[]; gestoria: boolean };

const GRAV_STYLE: Record<Alerta["gravedad"], string> = {
  alta: "border-[#F0C9C9] bg-[#FDF2F2] text-[#A12B2B]",
  media: "border-[#E9D8A6] bg-[#FFF8E6] text-[#7A5A10]",
  baja: "border-[#D5DAE1] bg-[#F6F7F9] text-[#1A2E4A]",
  info: "border-[#D5DAE1] bg-white text-[#1F2933]",
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
      className="rounded border border-[#D5DAE1] px-2 py-1 text-xs text-[#1F2933] hover:bg-[#F6F7F9]"
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
        <a key={l.url + l.label} href={l.url} target="_blank" rel="noreferrer" className="rounded bg-[#F6F7F9] px-2 py-0.5 text-xs text-[#1A2E4A] hover:underline">
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
    <section className="mt-6 rounded-xl border border-[#D5DAE1] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#1A2E4A]">Asesor contable (IA)</h2>
          <p className="text-xs text-[#52606D]">Calcula las cifras en código y la IA solo las interpreta. No sustituye a la gestoría.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded border border-[#D5DAE1] bg-[#F6F7F9] px-2 py-1.5 text-sm text-[#1F2933]">
            {periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={analizar} disabled={loading} className="rounded-lg bg-[#1A2E4A] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#243F66] disabled:opacity-50">
            {loading ? "Analizando…" : saved ? "Volver a analizar" : "Analizar"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded border border-[#F0C9C9] bg-[#FDF2F2] p-2 text-sm text-[#A12B2B]">{error}</p>}

      {!a && !loading && <p className="mt-3 text-sm text-[#52606D]">Elige un periodo y pulsa «Analizar». No se llama a la IA hasta entonces.</p>}

      {a && saved && (
        <div className="mt-4 space-y-5">
          <p className="text-xs text-[#52606D]">
            Análisis hecho el {fmt(saved.at)} · modelo {saved.model} · guardado en este navegador
          </p>

          <div className="rounded-lg bg-[#F6F7F9] p-3 text-sm leading-relaxed text-[#1F2933]">{a.resumen}</div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-[#1F2933]">Alertas ({alertas.length})</h3>
            {alertas.length === 0 && <p className="text-sm text-[#52606D]">Sin alertas.</p>}
            <ul className="space-y-2">
              {alertas.map((al, i) => (
                <li key={i} className={`rounded-lg border p-3 ${GRAV_STYLE[al.gravedad]}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      <span className="mr-2 rounded bg-[#F6F7F9] px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{al.gravedad}</span>
                      {al.titulo}
                    </span>
                    {al.cifra && <span className="font-mono text-sm">{al.cifra}</span>}
                  </div>
                  <p className="mt-1 text-sm text-[#1F2933]">{al.explicacion}</p>
                  <Links links={al.links} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-[#1F2933]">Propuestas ({a.propuestas.length})</h3>
            {a.propuestas.length === 0 && <p className="text-sm text-[#52606D]">Sin propuestas operativas.</p>}
            <ul className="space-y-2">
              {a.propuestas.map((p, i) => (
                <li key={i} className="rounded-lg border border-[#D5DAE1] bg-[#F6F7F9] p-3 text-sm">
                  <p className="font-semibold text-[#1F2933]">{p.titulo}</p>
                  <p className="mt-1 text-[#1F2933]">{p.accion}</p>
                  {p.impacto_estimado && <p className="mt-1 text-xs text-[#1F6B45]">Impacto: {p.impacto_estimado}</p>}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1F2933]">Preguntas para la gestoría ({a.preguntas_gestoria.length})</h3>
              {a.preguntas_gestoria.length > 0 && <CopyButton text={a.preguntas_gestoria.map((x, i) => `${i + 1}. ${x}`).join("\n")} />}
            </div>
            <ul className="space-y-2">
              {a.preguntas_gestoria.map((p, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-[#D5DAE1] bg-[#F6F7F9] p-3 text-sm text-[#1F2933]">
                  <span>{p}</span>
                  <CopyButton text={p} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <button type="button" onClick={() => setShowDossier((s) => !s)} className="text-xs text-[#52606D] underline">
              {showDossier ? "Ocultar" : "Ver"} las cifras del dossier que vio la IA
            </button>
            {showDossier && <pre className="mt-2 max-h-80 overflow-auto rounded bg-[#F6F7F9] p-3 text-[11px] text-[#1F2933]">{JSON.stringify(saved.dossier, null, 2)}</pre>}
          </div>
        </div>
      )}

      <div className="mt-6 border-t border-[#D5DAE1] pt-4">
        <h3 className="text-sm font-semibold text-[#1F2933]">Pregúntale</h3>
        <p className="text-xs text-[#52606D]">Pregunta sobre el mismo periodo; solo responde con cifras del dossier (cada pregunta es una consulta a la IA).</p>
        {aviso && <p className="mt-2 text-xs text-[#7A5A10]">{aviso}</p>}
        <ul className="mt-3 space-y-3">
          {turnos.map((t, i) => (
            <li key={i} className="text-sm">
              <p className="font-semibold text-[#1A2E4A]">{t.pregunta}</p>
              <p className="mt-1 whitespace-pre-wrap text-[#1F2933]">{t.respuesta}</p>
              {t.gestoria && <p className="mt-1 text-xs text-[#7A5A10]">Depende de normativa: confírmalo con la gestoría.</p>}
              <Links links={t.links} />
            </li>
          ))}
        </ul>
        <form onSubmit={preguntar} className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={500}
            placeholder="Ej.: ¿dónde puedo ahorrar en servicios contratados?"
            className="min-w-0 flex-1 rounded border border-[#D5DAE1] bg-[#F6F7F9] px-3 py-2 text-sm text-[#1F2933]"
          />
          <button type="submit" disabled={asking || !q.trim()} className="rounded-lg border border-[#D5DAE1] px-4 py-2 text-sm font-semibold text-[#1A2E4A] hover:bg-[#F6F7F9] disabled:opacity-50">
            {asking ? "…" : "Preguntar"}
          </button>
        </form>
      </div>
    </section>
  );
}
