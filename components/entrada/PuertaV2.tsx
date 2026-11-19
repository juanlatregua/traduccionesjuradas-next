"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { puertaT } from "@/lib/i18n/puerta";
import { ENTRADA_T, type EntradaLang } from "@/lib/entrada/i18n";
import type { ClientView } from "@/lib/entrada/view";

const TOKEN_KEY = "tj-entrada";
const LANG_CODES = ["es", "fr", "en", "de", "it", "pt", "nl", "ro", "ar", "ca", "sv", "no", "el", "ru", "uk", "pl", "zh"];
function langNames(ui: string): [string, string][] {
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames([ui], { type: "language" });
  } catch {}
  return LANG_CODES.map((c) => {
    const n = dn?.of(c) ?? c.toUpperCase();
    return [c, n.charAt(0).toUpperCase() + n.slice(1)];
  });
}
const EXT_TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff", webp: "image/webp" };
const card = "rounded-xl border border-bleu/15 bg-card p-5 shadow-paper";
const btn = "rounded-lg bg-bleu px-5 py-3 font-semibold text-white disabled:opacity-40";
const btn2 = "rounded-lg border border-bleu/30 px-5 py-3 font-semibold text-bleu";

type Res = { ok: boolean; error?: string; busy?: boolean; view?: ClientView; token?: string };

function store(get: true): string | null;
function store(get: false, v: string | null): void;
function store(get: boolean, v?: string | null) {
  try {
    if (get) return sessionStorage.getItem(TOKEN_KEY);
    if (v) sessionStorage.setItem(TOKEN_KEY, v);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function call(path: string, method = "GET", body?: unknown): Promise<{ status: number; retryAfter: number; data: Res }> {
  const r = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = (await r.json().catch(() => ({ ok: false, error: "Error de conexión." }))) as Res;
  return { status: r.status, retryAfter: Number(r.headers.get("Retry-After")) || 0, data };
}

const mimeOf = (f: File) => f.type || EXT_TYPES[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";

export default function PuertaV2({ source = null, lang = "es" }: { source?: string | null; lang?: EntradaLang }) {
  const t = ENTRADA_T[lang] ?? ENTRADA_T.es;
  const T = puertaT[lang] ?? puertaT.es;
  const LANGS = langNames(lang);
  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<ClientView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [adding, setAdding] = useState(false);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [targetLang, setTargetLang] = useState("es");
  const [sourceLang, setSourceLang] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [marketing, setMarketing] = useState(false);

  const [urgency, setUrgency] = useState<"" | "ASAP" | "DATE" | "FLEXIBLE">("");
  const [neededBy, setNeededBy] = useState("");
  const [organismo, setOrganismo] = useState("");
  const [notas, setNotas] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const reading = useRef(false);

  const apply = useCallback((d: Res) => {
    if (d.view) setView(d.view);
    setError(d.ok ? null : d.error ?? t.genericError);
  }, [t.genericError]);

  useEffect(() => {
    const t = store(true);
    if (!t) return;
    call(`/api/entrada/${t}`).then(({ status, data }) => {
      if (status === 404) return store(false, null);
      setToken(t);
      apply(data);
    });
  }, [apply]);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  async function open() {
    setBusy(t.oneMoment);
    const { data } = await call("/api/entrada", "POST", {
      email: email.trim(), nombre: nombre.trim() || null, telefono: telefono.trim() || null, targetLang: targetLang || null, sourceLang: sourceLang || null, gdprConsent: gdpr, marketingConsent: marketing, source, lang,
    });
    setBusy(null);
    if (!data.ok || !data.token) return setError(data.error ?? t.startError);
    store(false, data.token);
    setToken(data.token);
    const v = await call(`/api/entrada/${data.token}`);
    apply(v.data);
  }

  async function addFiles(list: FileList | null) {
    if (!token || !list) return;
    const { upload } = await import("@vercel/blob/client");
    for (const file of Array.from(list)) {
      const mimeType = mimeOf(file);
      if (!EXT_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] && !Object.values(EXT_TYPES).includes(mimeType)) {
        setError(t.badType(file.name));
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        setError(t.tooBig(file.name));
        continue;
      }
      setBusy(t.uploading(file.name));
      try {
        const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
        const blob = await upload(`entrada/${Date.now()}-${safe}`, file, { access: "public", handleUploadUrl: "/api/documents/upload", clientPayload: JSON.stringify({ gdprConsent: true }) });
        const { data } = await call(`/api/entrada/${token}/archivos`, "POST", { url: blob.url, name: file.name, size: file.size, mimeType });
        apply(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.genericError);
      }
    }
    setBusy(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function remove(id: string) {
    if (!token) return;
    const { data } = await call(`/api/entrada/${token}/archivos?id=${encodeURIComponent(id)}`, "DELETE");
    apply(data);
  }

  async function read() {
    if (!token || reading.current) return;
    reading.current = true;
    setAsking(false);
    setAdding(false);
    const started = Date.now();
    for (;;) {
      setBusy(t.reading);
      const { status, retryAfter, data } = await call(`/api/entrada/${token}/leer`, "POST");
      if (status === 202 || (status === 503 && data.busy)) {
        if (data.view) setView(data.view);
        await new Promise((r) => setTimeout(r, Math.max(10, retryAfter) * 1000));
        if (status === 202) {
          const g = await call(`/api/entrada/${token}`);
          if (g.data.view && g.data.view.estado !== "abierta") {
            apply(g.data);
            break;
          }
        }
        if (Date.now() - started < 8 * 60 * 1000) continue;
      }
      apply(data);
      break;
    }
    setBusy(null);
    reading.current = false;
  }

  async function edit(body: unknown) {
    if (!token) return;
    const { data } = await call(`/api/entrada/${token}/documentos`, "POST", body);
    apply(data);
  }

  async function confirm() {
    if (!token || !view) return;
    setBusy(t.sending);
    const { data } = await call(`/api/entrada/${token}/confirmar`, "POST", {
      urgency, neededBy: urgency === "DATE" ? neededBy : null, organismo: organismo.trim() || null, notas: notas.trim() || null, loteUpdatedAt: view.lectura?.loteUpdatedAt ?? null,
    });
    setBusy(null);
    apply(data);
  }

  function restart() {
    store(false, null);
    setToken(null);
    setView(null);
  }

  const errorBox = error && <p className="rounded-lg border border-rouge/30 bg-rouge/5 px-4 py-3 text-sm text-rouge" role="alert">{error}</p>;
  const busyBox = busy && <p className="rounded-lg bg-cream px-4 py-3 text-sm text-encre" aria-live="polite">{busy}</p>;

  if (!token || !view) {
    const ready = emailOk && gdpr && marketing && !busy;
    return (
      <div className="space-y-5">
        <div className={card}>
          <h2 className="mb-1 font-baskerville text-xl font-bold text-bleu">{t.startTitle}</h2>
          <p className="mb-4 text-sm text-graphite">{t.startSub}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-encre sm:col-span-2">{t.email}
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2" autoComplete="email" />
            </label>
            <label className="text-sm text-encre">{t.name}
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2" autoComplete="name" />
            </label>
            <label className="text-sm text-encre">{t.whatsapp}
              <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2" autoComplete="tel" />
            </label>
            <label className="text-sm text-encre">{t.target}
              <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2">
                <option value="">{t.targetUnknown}</option>
                {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <label className="text-sm text-encre">{t.source}
              <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2">
                <option value="">{t.sourceDetect}</option>
                {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>
        <div className={`${card} space-y-3`}>
          <label className="flex items-start gap-2 text-xs text-graphite">
            <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{T.marketingConsent}</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-graphite">
            <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{T.gdprConsent} <a href="/privacidad" target="_blank" className="text-bleu underline">{T.gdprPrivacyLink}</a>.</span>
          </label>
        </div>
        {errorBox}
        <button className={btn} disabled={!ready} onClick={open}>{t.startBtn}</button>
      </div>
    );
  }

  if (view.estado === "sin_jurado" && view.sinJurado) {
    return (
      <div className={`${card} space-y-3`}>
        <h2 className="font-baskerville text-xl font-bold text-bleu">{t.noJuradoTitle(LANGS.find(([c]) => c === view.sinJurado!.codigo)?.[1] ?? view.sinJurado.idioma)}</h2>
        <p className="text-graphite">{t.noJuradoBody}</p>
        <a href={view.sinJurado.maecUrl} target="_blank" rel="noopener noreferrer" className={`${btn} inline-block`}>{t.maecBtn}</a>
        <p className="text-sm text-graphite">{t.noJuradoFoot}</p>
      </div>
    );
  }

  if (view.estado === "confirmada") {
    return (
      <div className={`${card} space-y-3`}>
        <h2 className="font-baskerville text-xl font-bold text-bleu">{t.doneTitle}</h2>
        <p className="text-graphite">{t.doneBody}</p>
        <button className={btn2} onClick={restart}>{t.again}</button>
      </div>
    );
  }

  const l = view.lectura;
  const showReview = view.estado === "leida" && l && l.fase !== "leyendo" && !adding;

  if (!showReview) {
    return (
      <div className="space-y-5">
        <div className={card}>
          <h2 className="mb-1 font-baskerville text-xl font-bold text-bleu">{t.uploadTitle}</h2>
          <p className="mb-4 text-sm text-graphite">{t.uploadSub}</p>
          <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {view.archivos.map((f) => (
              <li key={f.id} className="relative overflow-hidden rounded-lg border border-graphite/20 bg-parchment">
                {f.mimeType.startsWith("image/") && !/hei[cf]|tiff/.test(f.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.name} className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center text-2xl font-bold text-sepia">{f.mimeType === "application/pdf" ? "PDF" : "IMG"}</div>
                )}
                <p className="truncate px-2 py-1 text-xs text-encre" title={f.name}>{f.name}</p>
                <button onClick={() => remove(f.id)} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-sm text-rouge" aria-label={t.remove(f.name)}>×</button>
              </li>
            ))}
            <li>
              <button onClick={() => fileInput.current?.click()} className="flex h-full min-h-[8.5rem] w-full items-center justify-center rounded-lg border-2 border-dashed border-bleu/30 text-sm font-semibold text-bleu" disabled={!!busy}>{t.add}</button>
            </li>
          </ul>
          <input ref={fileInput} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.tif,.tiff,.webp" className="hidden" onChange={(e) => addFiles(e.target.files)} />
        </div>
        {busyBox}
        {errorBox}
        {asking ? (
          <div className={`${card} space-y-3`}>
            <p className="font-semibold text-encre">{t.askTitle}</p>
            <p className="text-sm text-graphite">{t.askBody}</p>
            <div className="flex flex-wrap gap-3">
              <button className={btn} onClick={read}>{t.askYes}</button>
              <button className={btn2} onClick={() => setAsking(false)}>{t.askMore}</button>
            </div>
          </div>
        ) : (
          <button className={btn} disabled={view.archivos.length === 0 || !!busy} onClick={() => setAsking(true)}>{t.finished}</button>
        )}
      </div>
    );
  }

  const needsTarget = l!.fase === "lista" && !l!.targetLang;
  const deadlineOk = urgency === "ASAP" || urgency === "FLEXIBLE" || (urgency === "DATE" && /^\d{4}-\d{2}-\d{2}$/.test(neededBy));
  return (
    <div className="space-y-5">
      <div className={card}>
        <h2 className="mb-1 font-baskerville text-xl font-bold text-bleu">{l!.fase === "lista" ? t.summary(view.archivos.length, l!.documentos.filter((d) => d.incluido).length) : l!.resumen}</h2>
        {l!.fase === "revision_manual" && <p className="text-sm text-graphite">{t.manual}</p>}
        {l!.fase === "lista" && (
          <ul className="mt-3 space-y-3">
            {l!.documentos.map((d) => (
              <li key={d.id} className={`rounded-lg border px-4 py-3 ${d.incluido ? "border-bleu/20" : "border-graphite/20 bg-cream/60 text-graphite"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-encre">{d.titulo}</p>
                    <p className="text-xs text-graphite">{t.pages(d.paginas)}{d.apostilla ? t.withApostille : ""}</p>
                  </div>
                  {l!.editable && (
                    <button className="text-xs text-bleu underline" onClick={() => edit(d.incluido ? { op: "exclude", id: d.id } : { op: "include", id: d.id })}>
                      {d.incluido ? t.notNeeded : t.wantIt}
                    </button>
                  )}
                </div>
                {d.faltan.length > 0 && <p className="mt-2 text-sm text-rouge">{t.missing(d.faltan.join(", "))}</p>}
                {d.ilegible && <p className="mt-2 text-sm text-rouge">{t.illegible}</p>}
                {!d.incluido && d.motivo && <p className="mt-1 text-xs">{t.excluded}: {d.motivo}</p>}
              </li>
            ))}
          </ul>
        )}
        {l!.noIncluidos.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-semibold text-encre">{t.notIncluded}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-graphite">
              {l!.noIncluidos.map((n, i) => <li key={i}>{n.que}: {n.motivo}</li>)}
            </ul>
          </div>
        )}
        {l!.preguntas.length > 0 && (
          <div className="mt-4 rounded-lg bg-cream px-4 py-3">
            <p className="text-sm font-semibold text-encre">{t.questionsTitle}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-encre">{l!.preguntas.map((q, i) => <li key={i}>{q}</li>)}</ul>
            <p className="mt-1 text-xs text-graphite">{t.questionsHint}</p>
          </div>
        )}
        <button className="mt-4 text-sm text-bleu underline" onClick={() => setAdding(true)}>{t.addRemove}</button>
      </div>

      <div className={`${card} space-y-4`}>
        {needsTarget && (
          <label className="block text-sm text-encre">{t.targetRequired}
            <select className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2" value="" onChange={(e) => e.target.value && edit({ op: "setTargetLang", targetLang: e.target.value })}>
              <option value="">{t.choose}</option>
              {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
        )}
        <fieldset>
          <legend className="text-sm font-semibold text-encre">{t.deadline}</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {([["ASAP", t.asap], ["DATE", t.date], ["FLEXIBLE", t.flexible]] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setUrgency(v)} className={`rounded-lg border px-3 py-2 text-left text-sm ${urgency === v ? "border-bleu bg-bleu/5 font-semibold text-encre" : "border-graphite/20 text-graphite"}`}>{label}</button>
            ))}
          </div>
          {urgency === "DATE" && <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} className="mt-2 rounded-lg border border-graphite/30 px-3 py-2" />}
        </fieldset>
        <label className="block text-sm text-encre">{t.organismo}
          <input value={organismo} onChange={(e) => setOrganismo(e.target.value)} placeholder={t.organismoPh} className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2" />
        </label>
        <label className="block text-sm text-encre">{t.notes}
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} placeholder={t.notesPh} className="mt-1 w-full rounded-lg border border-graphite/30 px-3 py-2" />
        </label>
      </div>
      {busyBox}
      {errorBox}
      <button className={btn} disabled={!deadlineOk || needsTarget || !!busy} onClick={confirm}>{t.confirm}</button>
    </div>
  );
}
