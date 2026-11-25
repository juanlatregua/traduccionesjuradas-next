"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { puertaT } from "@/lib/i18n/puerta";
import type { EntradaLang } from "@/lib/entrada/i18n";
import { HILO_T, PAISES, textoEnviado } from "@/lib/entrada/hilo-i18n";
import { includesFrench } from "@/lib/price-request-ack";
import { buildHilo, LOCAL_VACIO, progressSteps, type Ask, type EditKey, type HiloLocal, type Msg, type Urgency } from "@/lib/entrada/hilo";
import { isQuestion } from "@/lib/entrada/conserje";
import { leerProcedencia } from "@/lib/entrada/procedencia-cliente";
import type { ClientView } from "@/lib/entrada/view";

const TOKEN_KEY = "tj-entrada";
const LOCAL_KEY = (t: string) => `tj-entrada-hilo:${t}`;
const LANG_CODES = ["es", "fr", "en", "de", "it", "pt", "nl", "ro", "ar", "ca", "sv", "no", "el", "ru", "uk", "pl", "zh"];
const EXT_TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff", webp: "image/webp" };
const btn = "inline-flex items-center gap-2 rounded-full bg-bleu px-4 py-2 text-sm font-semibold text-white transition [@media(hover:hover)]:hover:bg-bleu-dark disabled:cursor-not-allowed disabled:opacity-40";
const chip = (on: boolean) => `inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-bleu bg-bleu font-semibold text-white shadow-sm" : "border-bleu/30 bg-white text-bleu [@media(hover:hover)]:hover:border-bleu [@media(hover:hover)]:hover:bg-bleu/5"}`;
const Spinner = () => <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
const field = "w-full rounded-lg border border-graphite/30 bg-white px-3 py-2 text-base";

type Res = { ok: boolean; error?: string; busy?: boolean; view?: ClientView; token?: string; answer?: string };

function storage<T>(key: string, value?: T | null): T | null {
  try {
    if (value === undefined) {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    }
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  return null;
}

async function call(path: string, method = "GET", body?: unknown): Promise<{ status: number; retryAfter: number; data: Res }> {
  try {
    const r = await fetch(path, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = (await r.json().catch(() => ({ ok: false }))) as Res;
    return { status: r.status, retryAfter: Number(r.headers.get("Retry-After")) || 0, data };
  } catch {
    return { status: 0, retryAfter: 0, data: { ok: false } };
  }
}

const mimeOf = (f: File) => f.type || EXT_TYPES[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";
const digits = (s: string) => s.replace(/[^0-9]/g, "").slice(0, 6);

function names(ui: string, type: "language" | "region"): (code: string) => string {
  let dn: Intl.DisplayNames | null = null;
  try {
    dn = new Intl.DisplayNames([ui], { type });
  } catch {}
  return (c) => {
    const n = dn?.of(type === "region" ? c.toUpperCase() : c) ?? c.toUpperCase();
    return n.charAt(0).toUpperCase() + n.slice(1);
  };
}

function Bubble({ from, children, onEdit, editLabel }: { from: "casa" | "cliente"; children: ReactNode; onEdit?: () => void; editLabel?: string }) {
  const base = from === "casa" ? "self-start rounded-2xl rounded-tl-sm bg-white text-encre shadow-sm" : "self-end rounded-2xl rounded-tr-sm bg-bleu/10 text-encre";
  if (onEdit) {
    return (
      <button type="button" onClick={onEdit} className={`${base} max-w-[85%] px-4 py-2.5 text-left`} aria-label={editLabel}>
        {children}
        <span className="mt-1 block text-[11px] text-bleu/70">{editLabel}</span>
      </button>
    );
  }
  return <div className={`${base} max-w-[85%] px-4 py-2.5`}>{children}</div>;
}

export default function PuertaV2({ source = null, lang = "es" }: { source?: string | null; lang?: EntradaLang }) {
  const t = HILO_T[lang] ?? HILO_T.es;
  const T = puertaT[lang] ?? puertaT.es;
  const langName = useMemo(() => names(lang, "language"), [lang]);
  const countryName = useMemo(() => names(lang, "region"), [lang]);
  const langs = useMemo(() => LANG_CODES.map((c) => [c, langName(c)] as const), [langName]);
  const paises = useMemo(() => [...PAISES].map((c) => [c, countryName(c)] as const).sort((a, b) => a[1].localeCompare(b[1], lang)), [countryName, lang]);

  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<ClientView | null>(null);
  const [local, setLocal] = useState<HiloLocal>(LOCAL_VACIO);
  const [editing, setEditing] = useState<EditKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [code, setCode] = useState("");
  const [destinos, setDestinos] = useState<string[]>(["es"]);
  const [answer, setAnswer] = useState("");
  const [fecha, setFecha] = useState("");
  const [pais, setPais] = useState("");
  const [organismo, setOrganismo] = useState("");
  const [notas, setNotas] = useState("");
  const [duda, setDuda] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [needGdpr, setNeedGdpr] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const mounted = useRef(false);

  const gdprRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastRef = useRef<HTMLLIElement>(null);
  const reading = useRef(false);
  const verifying = useRef(false);

  const patchLocal = useCallback((p: Partial<HiloLocal>) => setLocal((l) => ({ ...l, ...p })), []);
  const apply = useCallback((d: Res) => {
    if (d.view) setView(d.view);
    setError(d.ok ? null : d.error ?? t.error);
    return d.ok;
  }, [t.error]);

  useEffect(() => {
    const saved = storage<string>(TOKEN_KEY);
    if (!saved) return;
    call(`/api/entrada/${saved}`).then(({ status, data }) => {
      if (status === 404) return void storage(TOKEN_KEY, null);
      setToken(saved);
      setLocal({ ...LOCAL_VACIO, ...(storage<HiloLocal>(LOCAL_KEY(saved)) ?? {}), leyendo: false });
      apply(data);
    });
  }, [apply]);

  useEffect(() => {
    if (token) storage(LOCAL_KEY(token), local);
  }, [token, local]);

  const { messages, ask } = useMemo(() => buildHilo({ email: view?.email ?? null, view, local, editing }), [view, local, editing]);

  // The thread flows with the page (no inner scroller that traps the wheel) and the answer panel sticks to the bottom
  // of the screen. A new message is brought up just above the panel, never past its start; if the client scrolled up
  // to reread, it is not pulled down and a «new messages» chip appears instead.
  const panelTop = () => panelRef.current?.getBoundingClientRect().top ?? window.innerHeight;
  const toLast = useCallback(() => {
    const last = lastRef.current;
    if (!last) return;
    const r = last.getBoundingClientRect();
    const dy = Math.min(r.bottom - (panelTop() - 12), r.top - 96);
    if (dy > 0) window.scrollBy({ top: dy, behavior: "smooth" });
    wasAtBottom.current = true;
    setShowNew(false);
  }, []);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const r = lastRef.current?.getBoundingClientRect();
      if (r) {
        if (r.bottom > 0 && r.top < panelTop()) {
          wasAtBottom.current = true;
          setShowNew(false);
        } else if (y < lastY - 4 && r.top >= panelTop()) wasAtBottom.current = false;
      }
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const last = lastRef.current;
    if (!last) return;
    if (!mounted.current) return void (mounted.current = true);
    if (!wasAtBottom.current) return setShowNew(true);
    toLast();
    if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) last.focus({ preventScroll: true });
  }, [messages.length, ask?.kind, toLast]);

  // Autofill sometimes fills inputs without firing React events: read the DOM while those asks are open.
  useEffect(() => {
    if (ask?.kind !== "codigo" && ask?.kind !== "email") return;
    const id = setInterval(() => {
      if (codeRef.current && digits(codeRef.current.value) !== code) setCode(digits(codeRef.current.value));
      if (emailRef.current && emailRef.current.value !== email) setEmail(emailRef.current.value);
    }, 500);
    return () => clearInterval(id);
  }, [ask?.kind, code, email]);

  const verify = useCallback(async (value: string) => {
    if (!token || verifying.current || value.length !== 6) return;
    verifying.current = true;
    const { data } = await call(`/api/entrada/${token}/verificar`, "POST", { code: value });
    verifying.current = false;
    if (!apply(data)) setCode("");
  }, [token, apply]);

  useEffect(() => {
    if (ask?.kind === "codigo" && code.length === 6) void verify(code);
  }, [ask?.kind, code, verify]);

  // The email button may be pressed in another tab or on the phone: this tab notices it by itself.
  useEffect(() => {
    if (ask?.kind !== "codigo" || !token) return;
    const id = setInterval(async () => {
      const { data } = await call(`/api/entrada/${token}`);
      if (data.view?.emailVerificado) setView(data.view);
    }, 2500);
    return () => clearInterval(id);
  }, [ask?.kind, token]);

  useEffect(() => {
    if (ask?.kind === "leyendo" && !reading.current) void read();
  });

  useEffect(() => {
    if (ask?.kind !== "leyendo") return setStep(0);
    const id = setInterval(() => setStep((s) => s + 1), 5000);
    return () => clearInterval(id);
  }, [ask?.kind]);

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const emailFalta = [!emailOk && t.faltaEmail].filter((x): x is string => Boolean(x));
  const origen = view?.idiomas.origen ?? local.origen;
  const destinosActuales = view?.idiomas.destinos.length ? view.idiomas.destinos : local.destinos;

  /** The entrada is born anonymous with the first upload (privacy consent given), carrying the languages already chosen. */
  async function ensureEntrada(): Promise<string | null> {
    if (token) return token;
    const { data } = await call("/api/entrada", "POST", { gdprConsent: true, sourceLang: local.origen, targetLangs: local.destinos, source, lang, procedencia: leerProcedencia() });
    if (!data.ok || !data.token) return apply(data), null;
    storage(TOKEN_KEY, data.token);
    setToken(data.token);
    return data.token;
  }

  async function sendEmail() {
    const value = (emailRef.current?.value ?? email).trim();
    setEmail(value);
    if (!token || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return;
    setBusy(t.enviarCodigo);
    const { data } = await call(`/api/entrada/${token}/email`, "POST", { email: value, nombre: nombre.trim() || null, telefono: telefono.trim() || null, marketingConsent: true });
    setBusy(null);
    apply(data);
  }

  async function setLangs(source: string | null, targets: string[]) {
    if (!token) return false;
    setBusy(t.guardando);
    try {
      const { data } = await call(`/api/entrada/${token}/documentos`, "POST", { op: "setLangs", sourceLang: source, targetLangs: targets });
      return apply(data);
    } finally {
      setBusy(null);
    }
  }

  async function answerOrigen(code: string | null) {
    if (busy) return;
    patchLocal({ origenDado: true, origen: code });
    if (code && destinos.length === 1 && destinos[0] === code) setDestinos([]);
    if (view && view.idiomas.destinos.length) await setLangs(code, view.idiomas.destinos);
    setEditing(null);
  }

  async function answerDestinos() {
    if (!view) {
      patchLocal({ destinos });
      return setEditing(null);
    }
    if (await setLangs(origen, destinos)) setEditing(null);
  }

  async function addFiles(list: FileList | null) {
    // Consent is given once, when the entrada is born: a returning client (saved token) has no checkbox to tick.
    if (!list?.length || (!token && !gdpr)) return;
    setError(null);
    setBusy(t.uploading(list[0].name));
    const tk = await ensureEntrada();
    if (!tk) {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const { upload } = await import("@vercel/blob/client");
    for (const file of Array.from(list)) {
      const mimeType = mimeOf(file);
      if (!Object.values(EXT_TYPES).includes(mimeType)) {
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
        apply((await call(`/api/entrada/${tk}/archivos`, "POST", { url: blob.url, name: file.name, size: file.size, mimeType })).data);
      } catch (e) {
        setError(e instanceof Error ? e.message : t.error);
      }
    }
    setBusy(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function remove(id: string) {
    if (!token || busy) return;
    setBusy("…");
    try {
      apply((await call(`/api/entrada/${token}/archivos?id=${encodeURIComponent(id)}`, "DELETE")).data);
    } finally {
      setBusy(null);
    }
  }

  async function read() {
    if (!token || reading.current) return;
    reading.current = true;
    patchLocal({ leyendo: true });
    const started = Date.now();
    for (;;) {
      const { status, retryAfter, data } = await call(`/api/entrada/${token}/leer`, "POST");
      if (status === 202 || (status === 503 && data.busy)) {
        if (data.view) setView(data.view);
        await new Promise((r) => setTimeout(r, Math.max(4, Math.min(retryAfter, 30)) * 1000));
        const g = await call(`/api/entrada/${token}`);
        if (g.data.view && g.data.view.estado !== "abierta" && g.data.view.lectura?.fase !== "leyendo") {
          apply(g.data);
          break;
        }
        if (Date.now() - started < 8 * 60 * 1000) continue;
      }
      apply(data);
      break;
    }
    patchLocal({ leyendo: false, terminado: false, quiereLeer: false });
    reading.current = false;
  }

  async function edit(body: unknown) {
    if (!token || busy) return;
    setBusy("…");
    try {
      apply((await call(`/api/entrada/${token}/documentos`, "POST", body)).data);
    } finally {
      setBusy(null);
    }
  }

  async function preguntar(question: string) {
    const q = question.trim();
    if (!token || !q) return;
    const after = messages[messages.length - 1]?.id ?? "hola";
    const index = local.dudas.length;
    setLocal((l) => ({ ...l, dudas: [...l.dudas, { q, a: null, after }] }));
    setDuda(null);
    wasAtBottom.current = true;
    const { data } = await call(`/api/entrada/${token}/pregunta`, "POST", { question: q, paso: ask?.kind ?? "fin" });
    const a = data.ok && data.answer ? data.answer : data.error ?? t.error;
    setLocal((l) => ({ ...l, dudas: l.dudas.map((d, i) => (i === index ? { ...d, a } : d)) }));
  }

  async function answerPregunta(index: number, text: string) {
    if (!text.trim()) return;
    if (isQuestion(text) && !/^(s[ií]|no|yes|oui|non|ja|nein|sim|não)\b/i.test(text.trim())) {
      setAnswer("");
      return void preguntar(text);
    }
    patchLocal({ respuestas: { ...local.respuestas, [index]: text.trim() } });
    setAnswer("");
    setEditing(null);
  }

  async function answerPreguntaIdioma(index: number) {
    if (await setLangs(origen, destinos)) {
      patchLocal({ respuestas: { ...local.respuestas, [index]: destinos.map(langName).join(", ") } });
      setEditing(null);
    }
  }

  function answerPlazo(u: Urgency) {
    if (u === "DATE" && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return patchLocal({ urgency: "DATE", neededBy: null });
    patchLocal({ urgency: u, neededBy: u === "DATE" ? fecha : null });
    setEditing(null);
  }

  function answerLugar(skip: boolean) {
    patchLocal({ lugarHecho: true, pais: skip ? null : pais || null, organismo: skip ? null : organismo.trim() || null });
    setEditing(null);
  }

  async function enviar() {
    if (!token || !view) return;
    setBusy(t.enviar);
    const preguntas = view.lectura?.preguntas ?? [];
    const { data } = await call(`/api/entrada/${token}/confirmar`, "POST", {
      urgency: local.urgency ?? view.plazo.urgency, neededBy: local.urgency === "DATE" ? local.neededBy : null, organismo: local.organismo, pais: local.pais,
      notas: local.notas.join("\n") || null, loteUpdatedAt: view.lectura?.loteUpdatedAt ?? null,
      respuestas: Object.entries(local.respuestas).map(([i, r]) => ({ pregunta: (preguntas[Number(i)] ?? "").slice(0, 300), respuesta: r.slice(0, 1000) })),
    });
    setBusy(null);
    apply(data);
  }

  function restart() {
    if (token) storage(LOCAL_KEY(token), null);
    storage(TOKEN_KEY, null);
    setToken(null);
    setView(null);
    setLocal(LOCAL_VACIO);
  }

  const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(lang, { timeZone: "UTC", day: "numeric", month: "long" });
  const startEdit = (key: EditKey) => () => {
    if (key === "destino") setDestinos(destinosActuales.length ? destinosActuales : ["es"]);
    if (key.startsWith("pregunta:")) setAnswer(local.respuestas[Number(key.slice(9))] ?? "");
    setEditing(key);
  };

  function content(m: Msg): ReactNode {
    const l = view?.lectura;
    switch (m.kind) {
      case "hola": return <>{t.hola}<span className="mt-2 block text-sm font-medium">{t.desde}</span></>;
      case "email": return view?.email;
      case "pide_email": return t.pideEmail;
      case "si_terminado": return t.si;
      case "pide_codigo": return t.pideCodigo(view?.email ?? "");
      case "codigo_ok": return t.codigoOk;
      case "pide_origen": return t.pideOrigen;
      case "origen": return origen ? langName(origen) : t.noSe;
      case "pide_destino": return t.pideDestino;
      case "destino": return destinosActuales.map(langName).join(", ");
      case "pide_archivos": return t.pideArchivos;
      case "archivos":
        return (
          <ul className="grid grid-cols-3 gap-2">
            {view!.archivos.map((f) => (
              <li key={f.id} className="relative overflow-hidden rounded-lg border border-graphite/20 bg-parchment">
                {f.mimeType.startsWith("image/") && !/hei[cf]|tiff/.test(f.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.name} className="h-20 w-full object-cover" />
                ) : (
                  <div className="flex h-20 items-center justify-center text-lg font-bold text-sepia">{f.mimeType === "application/pdf" ? "PDF" : "IMG"}</div>
                )}
                <p className="truncate px-1.5 pt-1 text-[11px]" title={f.name}>{f.name}</p>
                <p className={`px-1.5 pb-1 text-[11px] ${f.pages === 0 ? "text-rouge" : "text-graphite"}`}>{f.pages === 0 ? t.noAbre : f.pages ? t.pages(f.pages) : " "}</p>
                {ask?.kind === "archivos" && (
                  <button type="button" disabled={!!busy} onClick={() => remove(f.id)} className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-sm text-rouge" aria-label={t.quitar(f.name)}>×</button>
                )}
              </li>
            ))}
          </ul>
        );
      case "terminado": return t.terminado;
      case "pregunta_terminado": return t.preguntaTerminado;
      case "leyendo": {
        const steps = progressSteps(view?.archivos ?? []);
        return (
          <ul className="space-y-1">
            {steps.slice(0, Math.min(step + 1, steps.length)).map((s, i) => (
              <li key={i} className={i === Math.min(step, steps.length - 1) ? "font-medium" : "text-graphite"}>
                {s.kind === "inicio" ? t.inicio(s.files, s.pages) : s.kind === "archivo" ? t.archivo(s.name, s.pages) : t[s.kind]}
              </li>
            ))}
          </ul>
        );
      }
      case "manual": return t.manual;
      case "resultado":
        return (
          <div className="space-y-2">
            <p>{t.resumenLectura(view!.archivos.length, l!.documentos.filter((d) => d.incluido).length)}</p>
            <ul className="space-y-2">
              {l!.documentos.map((d) => (
                <li key={d.id} className={`rounded-lg border px-3 py-2 ${d.incluido ? "border-bleu/20" : "border-graphite/20 text-graphite"}`}>
                  <p className="font-semibold">{d.titulo}</p>
                  <p className="text-xs text-graphite">{t.pages(d.paginas)}{d.apostilla ? ` · ${t.conApostilla}` : ""}</p>
                  {d.faltan.length > 0 && <p className="mt-1 text-sm text-rouge">{t.faltan(d.faltan.join(", "))}</p>}
                  {d.ilegible && <p className="mt-1 text-sm text-rouge">{t.ilegible}</p>}
                  {!d.incluido && d.motivo && <p className="mt-1 text-xs">{t.noIncluido}: {d.motivo}</p>}
                  {l!.editable && view!.estado === "leida" && (
                    <button type="button" disabled={!!busy} className="mt-1 text-xs text-bleu underline disabled:opacity-50" onClick={() => edit(d.incluido ? { op: "exclude", id: d.id } : { op: "include", id: d.id })}>
                      {d.incluido ? t.noNecesito : t.siNecesito}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {l!.noIncluidos.length > 0 && (
              <div>
                <p className="text-sm font-semibold">{t.noIncluido}</p>
                <ul className="list-disc pl-5 text-sm text-graphite">{l!.noIncluidos.map((n, i) => <li key={i}>{n.que}: {n.motivo}</li>)}</ul>
              </div>
            )}
          </div>
        );
      case "solo_lectura": return view?.soloLectura === "otra_entrada" ? t.soloLecturaOtra : t.soloLecturaCaso;
      case "pregunta": return m.text;
      case "respuesta": return local.respuestas[m.index!];
      case "pide_plazo": return t.pidePlazo;
      case "plazo": {
        const u = local.urgency ?? view?.plazo.urgency;
        const d = local.neededBy ?? view?.plazo.neededBy;
        return u === "ASAP" ? t.asap : u === "FLEXIBLE" ? t.sinPrisa : d ? t.para(fmtDate(d)) : t.fecha;
      }
      case "pide_lugar": return t.pideLugar;
      case "lugar": {
        const p = local.pais ?? view?.pais;
        const o = local.organismo ?? view?.organismo;
        return [o, p && countryName(p)].filter(Boolean).join(" · ") || t.noSeAun;
      }
      case "resumen": return t.resumen;
      case "nota": return local.notas[m.index!];
      case "duda": return local.dudas[m.index!]?.q;
      case "respuesta_duda": return local.dudas[m.index]?.a ?? t.pensando;
      case "enviado": return view?.presupuestoEnviado ? t.enviadoPresupuesto : textoEnviado(lang, includesFrench(origen, ...destinosActuales), new Date());
      case "sin_jurado":
        return (
          <div className="space-y-2">
            <p>{t.sinJurado(view?.sinJurado ? langName(view.sinJurado.codigo) : "")}</p>
            <a href={view?.sinJurado?.maecUrl} target="_blank" rel="noopener noreferrer" className={`${btn} inline-block`}>{t.maec}</a>
          </div>
        );
    }
  }

  const langPicker = (multi: boolean, value: string[], onPick: (c: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {langs.map(([c, n]) => (
        <button key={c} type="button" className={chip(value.includes(c))} aria-pressed={value.includes(c)} disabled={!!busy} onClick={() => onPick(c)}>
          {value.includes(c) && <span aria-hidden>✓</span>}{n}
        </button>
      ))}
    </div>
  );
  const toggle = (c: string) => setDestinos((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]));
  const same = origen !== null && destinos.includes(origen);
  const cancel = editing && (
    <button type="button" className="text-sm text-graphite underline" onClick={() => setEditing(null)}>{t.cancelar}</button>
  );

  function askBox(a: Ask): ReactNode {
    switch (a.kind) {
      case "email":
        return (
          <div className="space-y-3">
            <input ref={emailRef} type="email" inputMode="email" autoComplete="email" placeholder={t.email} aria-label={t.email} value={email}
              onChange={(e) => setEmail(e.target.value)} onInput={(e) => setEmail(e.currentTarget.value)} onBlur={(e) => setEmail(e.currentTarget.value)} className={field} />
            <div className="grid grid-cols-2 gap-2">
              <input autoComplete="name" placeholder={t.name} aria-label={t.name} value={nombre} onChange={(e) => setNombre(e.target.value)} className={field} />
              <input type="tel" autoComplete="tel" placeholder={t.whatsapp} aria-label={t.whatsapp} value={telefono} onChange={(e) => setTelefono(e.target.value)} className={field} />
            </div>
            <button type="button" className={btn} disabled={!!busy || emailFalta.length > 0} onClick={sendEmail}>{t.enviarCodigo}</button>
            {emailFalta.length > 0 && <p className="text-xs text-graphite">{t.falta(emailFalta)}</p>}
          </div>
        );
      case "codigo":
        return (
          <div className="space-y-2">
            <input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" aria-label={t.codigoLabel} placeholder="000000" value={code}
              onChange={(e) => setCode(digits(e.target.value))} onInput={(e) => setCode(digits(e.currentTarget.value))}
              onPaste={(e) => { e.preventDefault(); setCode(digits(e.clipboardData.getData("text"))); }}
              className="w-40 rounded-lg border border-graphite/30 bg-white px-3 py-2 text-center text-xl tracking-[0.4em]" />
            {code.length > 0 && code.length < 6 ? <p className="text-xs text-graphite">{t.faltaCodigo}</p> : <p className="text-xs text-graphite">{t.esperandoBoton}</p>}
            <button type="button" disabled={!!busy} className="block text-sm text-bleu underline disabled:opacity-50" onClick={async () => {
              if (!token || busy) return;
              setBusy(t.enviarCodigo);
              try {
                apply((await call(`/api/entrada/${token}/codigo`, "POST")).data);
              } finally {
                setBusy(null);
              }
            }}>{t.reenviar}</button>
          </div>
        );
      case "origen":
        return (
          <div className="space-y-2">
            {langPicker(false, origen ? [origen] : [], (c) => void answerOrigen(c))}
            <div className="flex gap-3">
              <button type="button" className={chip(false)} onClick={() => void answerOrigen(null)}>{t.noSe}</button>
              {cancel}
            </div>
          </div>
        );
      case "destino":
        return (
          <div className="space-y-2">
            {langPicker(true, destinos, toggle)}
            {same && <p className="text-xs text-rouge">{t.mismoIdioma}</p>}
            <div className="flex items-center gap-3">
              <button type="button" className={btn} disabled={destinos.length === 0 || same || !!busy} onClick={answerDestinos}>{t.listo}</button>
              {cancel}
            </div>
            {destinos.length === 0 && <p className="text-sm font-medium text-rouge" role="alert">{t.choose}</p>}
          </div>
        );
      case "archivos": {
        const hay = Boolean(view?.archivos.length);
        const sinConsent = !token && !gdpr;
        return (
          <div className="space-y-2">
            <input ref={fileInput} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.tif,.tiff,.webp" className="hidden" onChange={(e) => addFiles(e.target.files)} />
            {!token && (
              <label className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs ${needGdpr && !gdpr ? "bg-rouge/5 text-rouge ring-2 ring-rouge" : "bg-parchment text-graphite"}`}>
                <input ref={gdprRef} type="checkbox" checked={gdpr} onChange={(e) => { setGdpr(e.target.checked); setNeedGdpr(false); }} className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{t.consentUnico} <a href="/privacidad" target="_blank" className="text-bleu underline">{T.gdprPrivacyLink}</a>.</span>
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              {/* Never disabled for the consent: pressing it says what is missing and points at the box. */}
              <button type="button" className={hay ? chip(false) : btn} disabled={!!busy} onClick={() => {
                if (sinConsent) {
                  setNeedGdpr(true);
                  gdprRef.current?.focus();
                  return;
                }
                fileInput.current?.click();
              }}>{busy ? <Spinner /> : null}{t.add}</button>
              <button type="button" className={hay ? btn : chip(false)} disabled={!hay || !!busy} onClick={() => patchLocal({ terminado: true })}>{t.terminado}</button>
            </div>
            {sinConsent ? (
              <p className={needGdpr ? "text-sm font-medium text-rouge" : "text-xs text-graphite"} role={needGdpr ? "alert" : undefined}>{t.falta([t.faltaGdpr])}</p>
            ) : !hay && <p className="text-xs text-graphite">{t.faltaArchivo}</p>}
          </div>
        );
      }
      case "terminado":
        return (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} onClick={() => patchLocal({ quiereLeer: true })}>{t.si}</button>
            <button type="button" className={chip(false)} onClick={() => patchLocal({ terminado: false })}>{t.mas}</button>
          </div>
        );
      case "leyendo":
        return null;
      case "pregunta":
        if (a.idioma) {
          return (
            <div className="space-y-2">
              {langPicker(true, destinos, toggle)}
              {same && <p className="text-xs text-rouge">{t.mismoIdioma}</p>}
              <div className="flex items-center gap-3">
                <button type="button" className={btn} disabled={destinos.length === 0 || same} onClick={() => answerPreguntaIdioma(a.index)}>{t.listo}</button>
                {cancel}
              </div>
            </div>
          );
        }
        return (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void answerPregunta(a.index, answer); }}>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t.responder} aria-label={t.responder} className={field} />
            <button type="submit" className={btn} disabled={!answer.trim()}>{t.enviarRespuesta}</button>
            {cancel}
          </form>
        );
      case "plazo":
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(local.urgency === "ASAP")} onClick={() => answerPlazo("ASAP")}>{t.asap}</button>
              <button type="button" className={chip(local.urgency === "DATE")} onClick={() => patchLocal({ urgency: "DATE", neededBy: null })}>{t.fecha}</button>
              <button type="button" className={chip(local.urgency === "FLEXIBLE")} onClick={() => answerPlazo("FLEXIBLE")}>{t.sinPrisa}</button>
            </div>
            {local.urgency === "DATE" && (
              <div className="flex items-center gap-2">
                <input type="date" value={fecha} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setFecha(e.target.value)} className="rounded-lg border border-graphite/30 bg-white px-3 py-2" />
                <button type="button" className={btn} disabled={!fecha} onClick={() => answerPlazo("DATE")}>{t.listo}</button>
              </div>
            )}
            {cancel}
          </div>
        );
      case "lugar":
        return (
          <div className="space-y-2">
            <select value={pais} onChange={(e) => setPais(e.target.value)} aria-label={t.pais} className={field}>
              <option value="">{t.pais}</option>
              {paises.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
            <input value={organismo} onChange={(e) => setOrganismo(e.target.value)} placeholder={t.organismoPh} aria-label={t.organismo} className={field} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn} disabled={!pais && !organismo.trim()} onClick={() => answerLugar(false)}>{t.continuar}</button>
              <button type="button" className={chip(false)} onClick={() => answerLugar(true)}>{t.noSeAun}</button>
              {cancel}
            </div>
          </div>
        );
      case "enviar":
        return (
          <div className="space-y-2">
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder={t.notasPh} aria-label={t.notas} className={field} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={chip(false)} disabled={!notas.trim()} onClick={() => {
                const n = notas.trim();
                setNotas("");
                if (isQuestion(n)) void preguntar(n);
                else patchLocal({ notas: [...local.notas, n] });
              }}>{t.anadir}</button>
              <button type="button" className={btn} disabled={!!busy} onClick={enviar}>{t.noPedir}</button>
            </div>
          </div>
        );
    }
  }

  const canAsk = Boolean(token && view?.emailVerificado && view.estado !== "confirmada" && view.estado !== "sin_jurado");
  return (
    <div className="mx-auto max-w-xl rounded-2xl bg-cream/60">
      <div className="p-3 sm:p-4">
      <ol className="flex flex-col gap-2" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map((m, i) => (
          <li key={m.id} ref={i === messages.length - 1 ? lastRef : undefined} tabIndex={-1} className="flex flex-col outline-none">
            <Bubble from={m.from} onEdit={m.from === "cliente" && "editKey" in m && m.editKey && view?.estado !== "confirmada" ? startEdit(m.editKey) : undefined} editLabel={t.tocar}>
              {content(m)}
            </Bubble>
          </li>
        ))}
      </ol>
      </div>
      <div ref={panelRef} onPointerDown={() => { wasAtBottom.current = true; }} className="sticky bottom-0 z-10 rounded-b-2xl border-t border-bleu/10 bg-white shadow-[0_-6px_16px_-8px_rgba(26,46,74,0.25)]">
      {showNew && (
        <button type="button" onClick={toLast} className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-full bg-bleu px-3 py-1 text-xs font-semibold text-white shadow">{t.nuevos}</button>
      )}
      <div className="max-h-[70vh] overflow-y-auto p-3 pr-16 sm:p-4 sm:pr-16 md:pr-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        {busy && <p className="mb-2 flex items-center gap-2 text-sm font-medium text-bleu" role="status"><Spinner />{busy}</p>}
        {error && <p className="mb-2 rounded-lg bg-rouge/5 px-3 py-2 text-sm text-rouge" role="alert">{error}</p>}
        {duda !== null ? (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void preguntar(duda); }}>
            <input autoFocus value={duda} onChange={(e) => setDuda(e.target.value)} placeholder={t.dudaPh} aria-label={t.duda} className={field} />
            <button type="submit" className={btn} disabled={duda.trim().length < 2}>{t.preguntar}</button>
            <button type="button" className="text-sm text-graphite underline" onClick={() => setDuda(null)}>{t.cancelar}</button>
          </form>
        ) : (
          <>
            {ask && askBox(ask)}
            {canAsk && ask && ask.kind !== "leyendo" && (
              <button type="button" className="mt-2 text-xs text-bleu underline" onClick={() => setDuda("")}>{t.duda}</button>
            )}
            {view?.estado === "confirmada" && (
              <button type="button" className={chip(false)} onClick={restart}>{t.otros}</button>
            )}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
