"use client";

import { useState } from "react";
import type { LoteView } from "@/lib/lectura-constructor/api.ts";
import { DOCUMENT_TYPES } from "@/lib/lectura/schema.ts";

export type LecturaSource = { kind: "caso"; casoId: string } | { kind: "session"; sessionKey: string } | { kind: "quote"; quoteId: string };

type Props = {
  source: LecturaSource;
  initialView: LoteView | null;
  customer: { name: string; email: string; phone: string };
  expedienteRef: string | null;
};

const STATUS_ES: Record<string, string> = {
  running: "leyendo…",
  busy: "servidor ocupado",
  ok: "leído: revisa y confirma",
  nothing_to_translate: "no hay nada que traducir",
  too_large: "lote demasiado grande",
  empty: "ningún archivo legible",
  refused: "la lectura se ha negado",
  truncated: "lectura cortada",
  invalid: "lectura no válida",
  error: "error",
  confirmed: "líneas confirmadas",
};

const FILE_STATE_ES: Record<string, string> = { ok: "leído", skipped: "no se pudo abrir", duplicate: "copia exacta", busy: "pendiente (servidor ocupado)" };

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  return { status: res.status, data };
}

export default function LecturaConstructor({ source, initialView, customer, expedienteRef }: Props) {
  const [view, setView] = useState<LoteView | null>(initialView);
  const [targetLang, setTargetLang] = useState(initialView?.lote.targetLang && initialView.lote.targetLang !== "unknown" ? initialView.lote.targetLang : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [prices, setPrices] = useState<Record<string, { price: string; cost: string }>>({});
  const [client, setClient] = useState(customer);

  const lote = view?.lote;
  const editable = lote?.status === "ok";

  async function start(reread: boolean) {
    setBusy(true);
    setMessage(null);
    const { data } = await call("/api/zona-traductor/lectura", "POST", { source, targetLang: targetLang || null, reread });
    setBusy(false);
    if (data.view) setView(data.view);
    if (!data.ok) setMessage(data.busy ? `${data.error} (intento ${data.attempt} de ${data.maxRetries + 1}; el servidor lleva la cuenta)` : data.error);
    else if (data.reused) setMessage("Este lote ya estaba leído con estos archivos: no se ha vuelto a gastar lectura.");
    setSelected([]);
  }

  async function edit(body: Record<string, unknown>) {
    if (!lote) return;
    setBusy(true);
    setMessage(null);
    const { data } = await call(`/api/zona-traductor/lectura/${lote.id}`, "PATCH", body);
    setBusy(false);
    if (data.view) setView(data.view);
    if (!data.ok) setMessage(data.issues?.join(" · ") || data.error);
    setSelected([]);
  }

  async function confirm() {
    if (!lote) return;
    setBusy(true);
    setMessage(null);
    const { data } = await call(`/api/zona-traductor/lectura/${lote.id}/confirmar`, "POST", {});
    setBusy(false);
    if (data.view) setView(data.view);
    if (!data.ok) setMessage(data.error);
  }

  async function createQuote() {
    if (!lote || !view?.payload) return;
    if (!client.name.trim() || !(client.email.trim() || client.phone.trim())) return setMessage("Falta el nombre y el email o el teléfono del cliente.");
    setBusy(true);
    setMessage(null);
    const { data } = await call("/api/quotes", "POST", {
      ...view.payload,
      customerName: client.name.trim(),
      customerEmail: client.email.trim(),
      customerPhone: client.phone.trim() || undefined,
      expedienteRef: expedienteRef || undefined,
      discountType: "NONE",
      discountValue: 0,
    });
    if (!data.ok) {
      setBusy(false);
      setMessage(data.existingQuoteId ? `${data.error} → /zona-traductor/presupuestos/${data.existingQuoteId}` : data.error);
      return;
    }
    await call(`/api/zona-traductor/lectura/${lote.id}`, "PATCH", { op: "linkQuote", quoteId: data.quote.id });
    window.location.href = `/zona-traductor/presupuestos/${data.quote.id}`;
  }

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const issuesOf = (id: string) => [...(view?.lines.blockers ?? []), ...(view?.lines.warnings ?? [])].filter((i) => i.documentId === id);

  return (
    <div className="space-y-6 text-slate-200">
      <section className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900/40 p-4">
        <label className="text-sm">
          <span className="block text-slate-400">Idioma de destino</span>
          <input
            className="mt-1 w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1"
            placeholder="es"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value.trim().toLowerCase())}
          />
        </label>
        <button disabled={busy} onClick={() => start(false)} className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Trabajando…" : lote ? (lote.status === "busy" ? "Reintentar la lectura" : "Leer el lote") : "Leer el lote"}
        </button>
        {lote && lote.status !== "running" && lote.status !== "busy" && (
          <button disabled={busy} onClick={() => start(true)} className="rounded border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">
            Volver a leer (gasta lectura)
          </button>
        )}
        {editable && targetLang && targetLang !== lote?.targetLang && (
          <button disabled={busy} onClick={() => edit({ op: "setTargetLang", targetLang })} className="rounded border border-slate-600 px-3 py-2 text-sm disabled:opacity-50">
            Fijar destino «{targetLang}» sin releer
          </button>
        )}
        {lote && (
          <p className="text-sm text-slate-400">
            Estado: <span className="text-white">{STATUS_ES[lote.status] ?? lote.status}</span>
            {lote.targetLang ? ` · destino ${lote.targetLang}${lote.targetLangBasis ? ` (${lote.targetLangBasis})` : ""}` : ""}
            {lote.clean === false ? " · requiere revisión" : ""}
          </p>
        )}
      </section>

      {message && <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{message}</p>}
      {lote?.detailEs && <p className="text-sm text-rose-200">{lote.detailEs}</p>}

      {view && view.files.length > 0 && (
        <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Archivos</h2>
          <ul className="space-y-1 text-sm">
            {view.files.map((f, i) => (
              <li key={`${f.name}-${i}`} className={f.state === "ok" ? "text-slate-300" : "text-amber-200"}>
                {f.position ? `Archivo ${f.position}: ` : ""}
                {f.name}
                {f.pageCount ? ` · ${f.pageCount} pág.` : ""} · {FILE_STATE_ES[f.state] ?? f.state}
                {f.reasonEs ? ` — ${f.reasonEs}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {view && view.lotReasons.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-100">
          <h2 className="mb-1 font-semibold">Del lote entero</h2>
          <ul className="list-disc pl-5">{view.lotReasons.map((r, i) => <li key={i}>{r.detail}</li>)}</ul>
        </section>
      )}

      {view && view.documents.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Documentos detectados ({view.documents.length})</h2>
            {editable && (
              <button disabled={busy || selected.length < 2} onClick={() => edit({ op: "merge", ids: selected })} className="rounded border border-slate-600 px-3 py-1 text-sm disabled:opacity-40">
                Unir los {selected.length || ""} marcados en un documento
              </button>
            )}
          </div>
          {view.documents.map((d) => {
            const line = view.lines.lines.find((l) => l.documentId === d.id);
            const p = prices[d.id] ?? { price: "", cost: "" };
            return (
              <article key={d.id} className={`rounded-xl border p-4 ${d.included ? "border-slate-700 bg-slate-900/40" : "border-slate-800 bg-slate-900/10 opacity-70"}`}>
                <div className="flex flex-wrap items-start gap-3">
                  {editable && <input type="checkbox" className="mt-1" checked={selected.includes(d.id)} onChange={() => toggle(d.id)} aria-label="Marcar para unir" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{d.label}</p>
                    <p className="text-sm text-slate-400">
                      {d.pageCount} pág. · {d.words} palabras ({d.wordsBasis === "exact" ? "contadas" : "estimadas"}) · {d.sourceLang}→{view.lines.targetLang || "?"} · legibilidad {d.legibility} · {d.docKey}
                    </p>
                    {!d.included && <p className="text-sm text-amber-200">No incluido: {d.excludedReason}</p>}
                    {d.reasons.length > 0 && (
                      <ul className="mt-1 list-disc pl-5 text-sm text-amber-200">{d.reasons.map((r, i) => <li key={i}>{r.detail}</li>)}</ul>
                    )}
                    {issuesOf(d.id).map((i, k) => <p key={k} className="text-sm text-rose-200">{i.detail}</p>)}
                  </div>
                  <div className="text-right text-sm">
                    {line ? (
                      <>
                        <p className="font-semibold text-white">{line.price}</p>
                        <p className="text-slate-400">{line.priceSource === "manual" ? `a mano${line.tariff ? ` (tarifa ${line.tariff})` : ""}` : "tarifa FR"}</p>
                        <p className="text-slate-400">{line.ownWork ? "trabajo propio" : line.cost ? `coste ${line.cost}` : "coste sin informar"}</p>
                      </>
                    ) : d.included ? <p className="text-rose-200">sin precio</p> : null}
                  </div>
                </div>
                {editable && (
                  <div className="mt-3 flex flex-wrap gap-2 text-sm">
                    <select
                      className="rounded border border-slate-600 bg-slate-900 px-2 py-1"
                      value={String(d.type)}
                      onChange={(e) => {
                        const label = window.prompt("Nombre del tipo, en español", d.typeLabelEs);
                        if (label) edit({ op: "setType", id: d.id, type: e.target.value, typeLabelEs: label });
                      }}
                    >
                      {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      className="rounded border border-slate-600 px-2 py-1"
                      onClick={() => {
                        const lang = window.prompt("Idioma de origen (código, p. ej. fr)", d.sourceLang);
                        if (lang) edit({ op: "setType", id: d.id, type: String(d.type), typeLabelEs: d.typeLabelEs, sourceLang: lang.trim().toLowerCase() });
                      }}
                    >
                      Origen: {d.sourceLang}
                    </button>
                    {d.parts.length > 1 && (
                      <button
                        className="rounded border border-slate-600 px-2 py-1"
                        onClick={() => {
                          const at = Number(window.prompt(`Separar después de la página n.º (1 a ${d.parts.length - 1})`, "1"));
                          if (at) edit({ op: "split", id: d.id, at });
                        }}
                      >
                        Separar
                      </button>
                    )}
                    {d.included ? (
                      <button
                        className="rounded border border-slate-600 px-2 py-1"
                        onClick={() => {
                          const reason = window.prompt("¿Por qué no se incluye?");
                          if (reason) edit({ op: "exclude", id: d.id, reason });
                        }}
                      >
                        No incluir
                      </button>
                    ) : (
                      <button className="rounded border border-slate-600 px-2 py-1" onClick={() => edit({ op: "include", id: d.id })}>Incluir</button>
                    )}
                    <input className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1" placeholder="precio €" value={p.price} onChange={(e) => setPrices({ ...prices, [d.id]: { ...p, price: e.target.value } })} />
                    <input className="w-24 rounded border border-slate-600 bg-slate-900 px-2 py-1" placeholder="coste €" value={p.cost} onChange={(e) => setPrices({ ...prices, [d.id]: { ...p, cost: e.target.value } })} />
                    <button
                      className="rounded border border-slate-600 px-2 py-1"
                      onClick={() => edit({ op: "setPrice", id: d.id, price: p.price.trim() || null, cost: p.cost.trim() || null })}
                    >
                      {p.price.trim() || p.cost.trim() ? "Fijar precio/coste" : "Quitar precio a mano"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}

      {view && (view.lines.lines.length > 0 || view.lines.blockers.length > 0) && (
        <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-sm">
          <h2 className="mb-2 font-semibold text-white">Líneas del presupuesto</h2>
          <ul className="space-y-1">
            {view.lines.lines.map((l) => (
              <li key={l.documentId} className="flex justify-between gap-3"><span>{l.description}</span><span className="text-white">{l.price}</span></li>
            ))}
          </ul>
          {view.lines.totals && (
            <p className="mt-2 text-right text-slate-300">
              Base {view.lines.totals.subtotal} · IVA {view.lines.totals.vat} · <span className="font-semibold text-white">Total {view.lines.totals.total}</span>
            </p>
          )}
          {view.lines.blockers.filter((b) => !b.documentId).map((b, i) => <p key={i} className="text-rose-200">{b.label}: {b.detail}</p>)}
          {editable && (
            <button disabled={busy || !view.ready} onClick={confirm} className="mt-3 rounded bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-40">
              Confirmo estas líneas
            </button>
          )}
        </section>
      )}

      {lote?.status === "confirmed" && view?.payload && (
        <section className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
          <p className="text-emerald-100">Líneas confirmadas por {lote.confirmedBy}. El presupuesto nace en borrador: no se envía nada al cliente.</p>
          {lote.quoteId ? (
            <a className="text-cyan-300" href={`/zona-traductor/presupuestos/${lote.quoteId}`}>Ir al presupuesto</a>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <input className="rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Nombre del cliente" value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
                <input className="rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Email" value={client.email} onChange={(e) => setClient({ ...client, email: e.target.value })} />
                <input className="rounded border border-slate-600 bg-slate-900 px-3 py-2" placeholder="Teléfono" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
              </div>
              <button disabled={busy} onClick={createQuote} className="rounded bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
                Crear el presupuesto (borrador)
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
