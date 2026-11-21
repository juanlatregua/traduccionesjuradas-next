"use client";

// La puerta única (PUERTA_V2=on): el panel de subida de la portada es el paso 1. Tras subir, una tarjeta guiada con 4
// etapas (Documentos · Tu email · Revisión · Fecha y destino), «Tu solicitud» a un lado y «¿Tienes una duda?» debajo.
// Toda la lógica de servidor es la de PuertaV2 (lib/entrada): aquí solo cambia la presentación.
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from "react";
import Link from "next/link";
import { Camera, Check, AlertTriangle, MessageCircle, Plus, Upload, Mail, Lock } from "lucide-react";
import { puertaT } from "@/lib/i18n/puerta";
import type { EntradaLang } from "@/lib/entrada/i18n";
import { HILO_T, PAISES } from "@/lib/entrada/hilo-i18n";
import { progressSteps, isLangQuestion } from "@/lib/entrada/hilo";
import { isQuestion } from "@/lib/entrada/conserje";
import { ETAPA, PORTADA_VACIA, conAviso, hojasDe, paginasDe, pasoDe, type Paso, type PortadaLocal, type Urgency } from "@/lib/entrada/portada";
import { PORTADA_T } from "@/lib/entrada/portada-i18n";
import type { ClientView } from "@/lib/entrada/view";
import { Miniatura, Visor, type Hoja } from "@/components/entrada/Miniaturas";
import { PUERTA_LANGS, WHATSAPP_HEAD } from "@/lib/i18n/whatsapp-arrival";

const TOKEN_KEY = "tj-entrada";
const LOCAL_KEY = (t: string) => `tj-entrada-portada:${t}`;
const LANG_CODES = ["es", "fr", "en", "de", "it", "pt", "nl", "ro", "ar", "ca", "sv", "no", "el", "ru", "uk", "pl", "zh"];
const EXT_TYPES: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", heic: "image/heic", heif: "image/heif", tif: "image/tiff", tiff: "image/tiff", webp: "image/webp" };
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.heic,.heif,.tif,.tiff,.webp,image/*,application/pdf";
const CARD = "rounded-2xl border border-cream bg-white p-5 shadow-paper sm:p-7";
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-encre px-5 text-base font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)]:hover:bg-bleu";
const secondary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-bleu/30 bg-white px-5 text-base font-bold text-encre transition disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:hover)]:hover:border-bleu";
const linkBtn = "text-sm font-semibold text-bleu underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const field = "w-full rounded-xl border border-graphite/30 bg-white px-3 py-2.5 text-base text-encre";
const chip = (on: boolean) => `inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-encre bg-encre text-white" : "border-graphite/25 bg-parchment text-encre [@media(hover:hover)]:hover:border-bleu"}`;
const Spinner = () => <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;

type Res = { ok: boolean; error?: string; busy?: boolean; view?: ClientView; token?: string; answer?: string };
type Busy = { key: string; label: string } | null;

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
const emailValid = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.trim());

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

function Burbuja({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-encre font-baskerville text-sm font-bold text-or-light" aria-hidden>TJ</span>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-parchment px-4 py-3 text-[15px] leading-relaxed text-encre">{children}</div>
    </div>
  );
}

export default function PuertaPortada({ lang = "es", source = null, asistente = null, idiomaNav = false }: { lang?: EntradaLang; source?: string | null; asistente?: ReactNode; idiomaNav?: boolean }) {
  const t = HILO_T[lang] ?? HILO_T.es;
  const p = PORTADA_T[lang] ?? PORTADA_T.es;
  const T = puertaT[lang] ?? puertaT.es;
  const langName = useMemo(() => names(lang, "language"), [lang]);
  const countryName = useMemo(() => names(lang, "region"), [lang]);
  const langs = useMemo(() => LANG_CODES.map((c) => [c, langName(c)] as const), [langName]);
  const paises = useMemo(() => [...PAISES].map((c) => [c, countryName(c)] as const).sort((a, b) => a[1].localeCompare(b[1], lang)), [countryName, lang]);

  const [token, setToken] = useState<string | null>(null);
  const [view, setView] = useState<ClientView | null>(null);
  const [local, setLocal] = useState<PortadaLocal>(PORTADA_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [tick, setTick] = useState(0);

  const [origen, setOrigen] = useState<string>("");
  const [destinos, setDestinos] = useState<string[]>(["es"]);
  const [multi, setMulti] = useState(false);
  const [gdpr, setGdpr] = useState(false);
  const [why, setWhy] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [editLangs, setEditLangs] = useState(false);

  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [code, setCode] = useState("");
  const [duda, setDuda] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [faltaAbierta, setFaltaAbierta] = useState<string | null>(null);
  const [visor, setVisor] = useState<{ hojas: Hoja[]; index: number } | null>(null);
  const [needWhy, setNeedWhy] = useState<string | null>(null);
  const [verDuda, setVerDuda] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const gdprRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const reading = useRef(false);
  const verifying = useRef(false);
  const prevPaso = useRef<Paso | null>(null);

  const patch = useCallback((x: Partial<PortadaLocal>) => setLocal((l) => ({ ...l, ...x })), []);
  const apply = useCallback((d: Res) => {
    if (d.view) setView(d.view);
    setError(d.ok ? null : d.error ?? t.error);
    return d.ok;
  }, [t.error]);

  useEffect(() => {
    const saved = storage<string>(TOKEN_KEY);
    if (!saved) return;
    call(`/api/entrada/${saved}`).then(({ status, data }) => {
      if (status === 404 || (data.view && (data.view.estado === "confirmada" || data.view.estado === "sin_jurado"))) {
        storage(LOCAL_KEY(saved), null);
        return void storage(TOKEN_KEY, null);
      }
      if (!data.view) return;
      setToken(saved);
      setLocal({ ...PORTADA_VACIA, ...(storage<PortadaLocal>(LOCAL_KEY(saved)) ?? {}) });
      if (data.view.idiomas.destinos.length) setDestinos(data.view.idiomas.destinos);
      setOrigen(data.view.idiomas.origen ?? "");
      setView(data.view);
    });
  }, []);

  useEffect(() => {
    if (token) storage(LOCAL_KEY(token), local);
  }, [token, local]);

  const paso = pasoDe(view, local);
  const etapa = ETAPA[paso];

  // A new step: its card comes into view (never past its start) and the heading takes the focus.
  useEffect(() => {
    const before = prevPaso.current;
    prevPaso.current = paso;
    if (before === null || before === paso) return;
    const card = cardRef.current;
    if (card) {
      const r = card.getBoundingClientRect();
      if (r.top < 64 || r.top > window.innerHeight * 0.6) card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    headRef.current?.focus({ preventScroll: true });
  }, [paso]);

  // Autofill can fill inputs without React events.
  useEffect(() => {
    if (paso !== "codigo" && paso !== "email") return;
    const id = setInterval(() => {
      if (codeRef.current && digits(codeRef.current.value) !== code) setCode(digits(codeRef.current.value));
      if (emailRef.current && emailRef.current.value !== email) setEmail(emailRef.current.value);
    }, 500);
    return () => clearInterval(id);
  }, [paso, code, email]);

  const verify = useCallback(async (value: string) => {
    if (!token || verifying.current || value.length !== 6) return;
    verifying.current = true;
    setBusy({ key: "verificar", label: p.comprobando });
    const { data } = await call(`/api/entrada/${token}/verificar`, "POST", { code: value });
    verifying.current = false;
    setBusy(null);
    if (!apply(data)) setCode("");
  }, [token, apply, p.comprobando]);

  useEffect(() => {
    if (paso === "codigo" && code.length === 6) void verify(code);
  }, [paso, code, verify]);

  // «Confirmar mi email» may be pressed on the phone: this tab notices it by itself.
  useEffect(() => {
    if (paso !== "codigo" || !token) return;
    const id = setInterval(async () => {
      const { data } = await call(`/api/entrada/${token}`);
      if (data.view?.emailVerificado) setView(data.view);
    }, 2500);
    return () => clearInterval(id);
  }, [paso, token]);

  useEffect(() => {
    if (paso === "lectura" && !reading.current) void read();
  });

  useEffect(() => {
    if (paso !== "lectura") return setTick(0);
    const id = setInterval(() => setTick((s) => s + 1), 4000);
    return () => clearInterval(id);
  }, [paso]);

  // Doubts written before the email was confirmed go out by themselves once it is.
  useEffect(() => {
    if (!token || !view?.emailVerificado) return;
    local.dudas.forEach((d, i) => {
      if (!d.enviada) void enviarDuda(i, d.q);
    });
  });

  const sameLang = origen !== "" && destinos.includes(origen);

  /** Why the upload zone cannot open yet (null = it can). */
  function porQueNoSubir(): string | null {
    if (!token && !gdpr) return t.falta([t.faltaGdpr]);
    if (destinos.length === 0) return t.choose;
    if (sameLang) return t.mismoIdioma;
    return null;
  }

  function pickFiles() {
    if (busy) return;
    const r = porQueNoSubir();
    setWhy(r);
    if (r) {
      if (!token && !gdpr) gdprRef.current?.focus();
      return;
    }
    fileInput.current?.click();
  }

  async function ensureEntrada(): Promise<string | null> {
    if (token) return token;
    const { data } = await call("/api/entrada", "POST", { gdprConsent: true, sourceLang: origen || null, targetLangs: destinos, source, lang });
    if (!data.ok || !data.token) return apply(data), null;
    storage(TOKEN_KEY, data.token);
    setToken(data.token);
    return data.token;
  }

  async function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (fileInput.current) fileInput.current.value = "";
    if (!files.length || busy) return;
    const r = porQueNoSubir();
    setWhy(r);
    if (r) return;
    setError(null);
    setBusy({ key: "subir", label: p.subiendo(files[0].name, 1, files.length) });
    try {
      const tk = await ensureEntrada();
      if (!tk) return;
      const { upload } = await import("@vercel/blob/client");
      let i = 0;
      for (const file of files) {
        i++;
        const mimeType = mimeOf(file);
        if (!Object.values(EXT_TYPES).includes(mimeType)) {
          setError(t.badType(file.name));
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          setError(t.tooBig(file.name));
          continue;
        }
        setBusy({ key: "subir", label: p.subiendo(file.name, i, files.length) });
        try {
          const safe = file.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120);
          const blob = await upload(`entrada/${Date.now()}-${safe}`, file, { access: "public", handleUploadUrl: "/api/documents/upload", clientPayload: JSON.stringify({ gdprConsent: true }) });
          const res = (await call(`/api/entrada/${tk}/archivos`, "POST", { url: blob.url, name: file.name, size: file.size, mimeType })).data;
          if (res.view) setView(res.view);
          if (!res.ok) setError(res.error ?? t.error);
        } catch (e) {
          setError(e instanceof Error ? e.message : t.error);
        }
      }
      patch({ verArchivos: false, quiereLeer: false, revisado: false });
    } finally {
      setBusy(null);
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    void addFiles(e.dataTransfer.files);
  }
  const dropProps = {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setDrag(true); },
    onDragLeave: () => setDrag(false),
    onDrop,
  };

  async function remove(id: string) {
    if (!token || busy) return;
    setBusy({ key: `quitar:${id}`, label: p.quitando });
    try {
      apply((await call(`/api/entrada/${token}/archivos?id=${encodeURIComponent(id)}`, "DELETE")).data);
    } finally {
      setBusy(null);
    }
  }

  async function saveLangs(src: string, targets: string[]): Promise<boolean> {
    if (!token) return true;
    setBusy({ key: "idiomas", label: t.guardando });
    try {
      return apply((await call(`/api/entrada/${token}/documentos`, "POST", { op: "setLangs", sourceLang: src || null, targetLangs: targets })).data);
    } finally {
      setBusy(null);
    }
  }

  function chooseOrigen(c: string) {
    setOrigen(c);
    setWhy(null);
    if (c && destinos.length === 1 && destinos[0] === c) setDestinos([]);
  }
  function chooseDestino(v: string) {
    setWhy(null);
    if (v === "__multi") return setMulti(true);
    setDestinos(v ? [v] : []);
  }
  const toggleDestino = (c: string) => setDestinos((d) => (d.includes(c) ? d.filter((x) => x !== c) : [...d, c]));

  async function read() {
    if (!token || reading.current) return;
    reading.current = true;
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
      if (!data.ok) patch({ quiereLeer: false });
      break;
    }
    patch({ quiereLeer: false, revisado: false });
    reading.current = false;
  }

  async function sendEmail() {
    const value = (emailRef.current?.value ?? email).trim();
    setEmail(value);
    if (!token || busy) return;
    if (!emailValid(value)) return setNeedWhy(t.falta([t.faltaEmail]));
    setNeedWhy(null);
    setBusy({ key: "email", label: t.enviarCodigo });
    const { data } = await call(`/api/entrada/${token}/email`, "POST", { email: value, nombre: nombre.trim() || null, telefono: telefono.trim() || null, marketingConsent: true });
    setBusy(null);
    if (apply(data)) patch({ cambiarEmail: false });
  }

  async function resend() {
    if (!token || busy) return;
    setBusy({ key: "reenviar", label: t.enviarCodigo });
    try {
      apply((await call(`/api/entrada/${token}/codigo`, "POST")).data);
    } finally {
      setBusy(null);
    }
  }

  async function edit(key: string, body: unknown) {
    if (!token || busy) return;
    setBusy({ key, label: t.guardando });
    try {
      apply((await call(`/api/entrada/${token}/documentos`, "POST", body)).data);
    } finally {
      setBusy(null);
    }
  }

  async function enviarDuda(index: number, q: string) {
    if (!token) return;
    setLocal((l) => ({ ...l, dudas: l.dudas.map((d, i) => (i === index ? { ...d, enviada: true } : d)) }));
    const { data } = await call(`/api/entrada/${token}/pregunta`, "POST", { question: q, paso });
    const a = data.ok && data.answer ? data.answer : data.error ?? t.error;
    setLocal((l) => ({ ...l, dudas: l.dudas.map((d, i) => (i === index ? { ...d, a } : d)) }));
  }

  function preguntar(text: string) {
    const q = text.trim();
    if (q.length < 2) return;
    setDuda("");
    const index = local.dudas.length;
    setLocal((l) => ({ ...l, dudas: [...l.dudas, { q, a: null, enviada: false }] }));
    if (view?.emailVerificado) void enviarDuda(index, q);
  }

  async function answerIdioma(index: number) {
    if (!destinos.length || sameLang) return;
    if (await saveLangs(origen, destinos)) patch({ respuestas: { ...local.respuestas, [index]: destinos.map(langName).join(", ") } });
  }

  function answerTexto(index: number) {
    const text = (answers[index] ?? "").trim();
    if (!text) return;
    if (isQuestion(text) && !/^(s[ií]|no|yes|oui|non|ja|nein|sim|não)\b/i.test(text)) {
      setAnswers((a) => ({ ...a, [index]: "" }));
      return preguntar(text);
    }
    patch({ respuestas: { ...local.respuestas, [index]: text } });
  }

  const urgency = local.urgency ?? (view?.plazo.urgency as Urgency | null) ?? null;
  const neededBy = local.neededBy ?? view?.plazo.neededBy ?? null;
  const plazoFalta = !urgency ? p.faltaPlazo : urgency === "DATE" && !neededBy ? p.faltaFecha : null;

  async function enviar() {
    if (!token || !view || busy) return;
    if (plazoFalta) return setNeedWhy(plazoFalta);
    setNeedWhy(null);
    setBusy({ key: "enviar", label: p.enviando });
    const preguntas = view.lectura?.preguntas ?? [];
    const { data } = await call(`/api/entrada/${token}/confirmar`, "POST", {
      urgency, neededBy: urgency === "DATE" ? neededBy : null, organismo: local.organismo, pais: local.pais,
      notas: local.notas.trim() || null, loteUpdatedAt: view.lectura?.loteUpdatedAt ?? null,
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
    setLocal(PORTADA_VACIA);
    setGdpr(false);
    setCode("");
    setError(null);
  }

  // ——— Pages and thumbnails ———
  const archivoById = useMemo(() => new Map((view?.archivos ?? []).map((a) => [a.id, a])), [view?.archivos]);
  const hojaLabel = (a: { mimeType: string; pages: number | null }, page: number) => (a.mimeType.startsWith("image/") ? p.foto : p.pag(page));
  const todasLasHojas: Hoja[] = useMemo(
    () => hojasDe(view?.archivos ?? []).map((h) => {
      const a = archivoById.get(h.archivoId)!;
      return { archivo: a, page: h.page, label: hojaLabel(a, h.page) };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view?.archivos, archivoById, lang],
  );
  const abrir = (hojas: Hoja[], index: number) => setVisor({ hojas, index });
  const thumbs = (hojas: Hoja[], size: "sm" | "md" = "md", max = Infinity) => (
    <>
      {hojas.slice(0, max).map((h, i) => (
        <Miniatura key={`${h.archivo.id}:${h.page}:${i}`} h={h} size={size} onOpen={() => abrir(hojas, i)} ariaLabel={p.ampliar(h.archivo.name, h.label)} />
      ))}
      {hojas.length > max && <span className="self-center text-xs font-semibold text-graphite">{p.masPaginas(hojas.length - max)}</span>}
    </>
  );

  const documentos = view?.lectura?.documentos ?? [];
  const incluidos = documentos.filter((d) => d.incluido);
  const avisos = documentos.filter(conAviso).length;
  const docHojas = (d: (typeof documentos)[number]): Hoja[] =>
    d.partes.flatMap((pt) => {
      const a = archivoById.get(pt.archivoId);
      if (!a) return [];
      return [{ archivo: a, page: pt.page, label: pt.rol === "apostilla" ? p.rolApostilla : pt.rol === "anexo" ? p.rolAnexo : hojaLabel(a, pt.page) }];
    });

  const origenActual = view?.idiomas.origen ?? (origen || null);
  const destinosActuales = view?.idiomas.destinos.length ? view.idiomas.destinos : destinos;
  const idiomasTxt = `${origenActual ? langName(origenActual) : t.noSe} → ${destinosActuales.map(langName).join(", ")}`;
  const paginas = paginasDe(view?.archivos ?? []);
  const leyendo = paso === "lectura";

  // ——— Language fields (the home panel and «Cambiar») ———
  const langFields = (compact = false) => (
    <div className="space-y-3">
      <div className={`grid gap-3 ${compact ? "" : "sm:grid-cols-2"}`}>
        <label className="block text-sm font-semibold text-encre">
          {p.idiomaDoc}
          <select value={origen} onChange={(e) => chooseOrigen(e.target.value)} disabled={!!busy} className={`${field} mt-1`}>
            <option value="">{t.noSe}</option>
            {langs.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
          </select>
        </label>
        <label className="block text-sm font-semibold text-encre">
          {p.loNecesitasEn}
          <select value={multi ? "__multi" : destinos[0] ?? ""} onChange={(e) => chooseDestino(e.target.value)} disabled={!!busy || multi} className={`${field} mt-1`}>
            <option value="">…</option>
            {langs.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            <option value="__multi">{p.masDeUno}</option>
          </select>
        </label>
      </div>
      {multi && (
        <div>
          <p className="mb-2 text-sm text-graphite">{p.eligeVarios}</p>
          <div className="flex flex-wrap gap-1.5">
            {langs.map(([c, n]) => (
              <button key={c} type="button" className={chip(destinos.includes(c))} aria-pressed={destinos.includes(c)} disabled={!!busy} onClick={() => { setWhy(null); toggleDestino(c); }}>
                {destinos.includes(c) && <Check className="h-3.5 w-3.5" aria-hidden />}{n}
              </button>
            ))}
          </div>
        </div>
      )}
      {sameLang && <p className="text-sm font-medium text-rouge" role="alert">{t.mismoIdioma}</p>}
      {destinos.length === 0 && <p className="text-sm font-medium text-rouge" role="alert">{t.choose}</p>}
    </div>
  );

  const fileInputEl = <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />;
  const statusLine = busy && (
    <p className="flex items-center gap-2 text-sm font-semibold text-bleu" role="status"><Spinner />{busy.label}</p>
  );
  const errorLine = error && <p className="rounded-xl bg-rouge/5 px-3 py-2 text-sm text-rouge" role="alert">{error}</p>;
  const desde = <p className="text-sm text-graphite"><strong className="text-encre">{t.desde.split(".")[0]}.</strong>{t.desde.slice(t.desde.indexOf(".") + 1)}</p>;

  // ——— Step 1 on the home page: languages, consent and one upload zone (no email here) ———
  const panelSubida = (
    <section aria-labelledby="subida-title" lang={lang} className={`${CARD} flex flex-col gap-4`}>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-or text-white" aria-hidden><Upload className="h-5 w-5" /></span>
        <div>
          <h2 id="subida-title" className="font-baskerville text-xl font-bold text-encre sm:text-2xl">{source === "whatsapp" ? WHATSAPP_HEAD[lang].title : p.subirTitulo}</h2>
          <p className="text-sm text-graphite">{p.subirSub}</p>
        </div>
      </div>
      {source === "whatsapp" && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{WHATSAPP_HEAD[lang].banner}</p>}
      {idiomaNav && (
        <nav aria-label="Idioma" className="flex flex-wrap gap-2">
          {PUERTA_LANGS.map((l) => (
            <Link key={l} href={`?p=whatsapp&l=${l}`} aria-current={l === lang ? "true" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-semibold uppercase ${l === lang ? "border-bleu bg-bleu text-white" : "border-bleu/20 bg-parchment text-bleu"}`}>{l}</Link>
          ))}
        </nav>
      )}
      <div className="rounded-xl border border-cream bg-parchment/60 p-4">
        {langFields()}
        {!token && (
          <label className={`mt-3 flex cursor-pointer items-start gap-2.5 rounded-lg p-2 text-xs leading-relaxed ${why && !gdpr ? "bg-rouge/5 text-rouge ring-2 ring-rouge" : "text-graphite"}`}>
            <input ref={gdprRef} type="checkbox" checked={gdpr} onChange={(e) => { setGdpr(e.target.checked); setWhy(null); }} className="mt-0.5 h-5 w-5 shrink-0 accent-encre" />
            <span>{t.consentUnico} <a href="/privacidad" target="_blank" className="text-bleu underline">{T.gdprPrivacyLink}</a>.</span>
          </label>
        )}
      </div>
      {fileInputEl}
      <button type="button" onClick={pickFiles} disabled={!!busy} {...dropProps}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition ${drag ? "border-bleu bg-bleu/5" : "border-or bg-white [@media(hover:hover)]:hover:bg-parchment/60"} disabled:cursor-wait`}>
        <span className="flex items-center gap-3 text-or-dark" aria-hidden>{busy?.key === "subir" ? <Spinner /> : <><Upload className="h-7 w-7" /><Camera className="h-7 w-7" /></>}</span>
        <span className="text-lg font-bold text-encre">{busy?.key === "subir" ? busy.label : drag ? p.soltar : p.zona}</span>
        <span className="max-w-md text-sm text-graphite">{p.zonaHint}</span>
      </button>
      {why && <p className="text-sm font-semibold text-rouge" role="alert">{why}</p>}
      {errorLine}
      {desde}
      <p className="text-xs text-graphite">{p.grande} <Link href="/expediente" className="font-semibold text-bleu underline">{p.grandeLink}</Link></p>
    </section>
  );

  if (paso === "portada") {
    return (
      <div className="mt-4 grid items-start gap-4 sm:mt-6 sm:gap-7 lg:grid-cols-2">
        <div id="subir" className="order-1 scroll-mt-24 lg:order-2">{panelSubida}</div>
        {asistente && <div id="preguntar" className="order-2 scroll-mt-24 lg:order-1">{asistente}</div>}
      </div>
    );
  }

  const visorEl = visor && (
    <Visor hojas={visor.hojas} index={visor.index} onIndex={(i) => setVisor((v) => (v ? { ...v, index: i } : v))} onClose={() => setVisor(null)} labels={p} />
  );

  const dudasList = (
    <ul className="space-y-3">
      {local.dudas.map((d, i) => (
        <li key={i} className="space-y-1.5 text-sm">
          <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-tr-sm bg-bleu/10 px-3 py-2 text-encre">{d.q}</p>
          <p className={`w-fit max-w-[95%] rounded-2xl rounded-tl-sm px-3 py-2 ${d.a ? "bg-parchment text-encre" : "flex items-center gap-2 bg-parchment text-graphite"}`}>
            {d.a ?? (view?.emailVerificado ? <><Spinner />{t.pensando}</> : p.enEspera)}
          </p>
        </li>
      ))}
    </ul>
  );
  const dudaCard = (
    <section id="preguntar" className={`${CARD} scroll-mt-24 space-y-4`} aria-labelledby="duda-title">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-encre text-white" aria-hidden><MessageCircle className="h-5 w-5" /></span>
        <div>
          <h3 id="duda-title" className="font-baskerville text-xl font-bold text-encre">{p.dudaTitulo}</h3>
          <p className="text-sm text-graphite">{p.dudaSub}</p>
        </div>
      </div>
      {local.dudas.length > 0 && dudasList}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); preguntar(duda); }}>
        <input value={duda} onChange={(e) => setDuda(e.target.value)} placeholder={t.dudaPh} aria-label={p.dudaTitulo} className={`${field} min-w-0`} />
        <button type="submit" className={`${primary} shrink-0 !px-4`} disabled={duda.trim().length < 2}>{t.preguntar}</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {p.dudaChips.map((c) => <button key={c} type="button" className={chip(false)} onClick={() => preguntar(c)}>{c}</button>)}
      </div>
      {!view?.emailVerificado && <p className="text-xs text-graphite">{p.dudaEspera}</p>}
    </section>
  );

  // ——— «Recibido» / no sworn translator: one centred card ———
  if (paso === "enviado" || paso === "sin_jurado") {
    const plazo = urgency === "ASAP" ? t.asap : urgency === "FLEXIBLE" ? t.sinPrisa : neededBy ? t.para(new Date(`${neededBy}T00:00:00Z`).toLocaleDateString(lang, { timeZone: "UTC", day: "numeric", month: "long" })) : null;
    const lugar = [view?.organismo ?? local.organismo, (view?.pais ?? local.pais) && countryName((view?.pais ?? local.pais)!)].filter(Boolean).join(", ");
    return (
      <div className="mx-auto mt-4 max-w-3xl sm:mt-6">
        <section ref={cardRef} className={`${CARD} scroll-mt-24 space-y-5`} aria-labelledby="puerta-titulo">
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${paso === "enviado" ? "bg-vert" : "bg-or"}`} aria-hidden>{paso === "enviado" ? <Check className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}</span>
            <div>
              <h2 id="puerta-titulo" ref={headRef} tabIndex={-1} className="font-baskerville text-xl font-bold text-encre outline-none sm:text-2xl">{paso === "enviado" ? t.enviado.split(".")[0] : p.sinJuradoTitulo}</h2>
              {paso === "enviado" && view?.email && <p className="text-sm text-graphite">{p.enviadoSub(view.email)}</p>}
            </div>
          </div>
          {paso === "sin_jurado" ? (
            <>
              <Burbuja>{t.sinJurado(view?.sinJurado ? langName(view.sinJurado.codigo) : "")}</Burbuja>
              <a href={view?.sinJurado?.maecUrl} target="_blank" rel="noopener noreferrer" className={primary}>{t.maec}</a>
            </>
          ) : (
            <>
              <Burbuja>{view?.presupuestoEnviado ? t.enviadoPresupuesto : t.enviado}</Burbuja>
              {incluidos.length > 0 && (
                <div className="rounded-xl border border-cream bg-parchment/50 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-or-dark">{p.loPedido}</p>
                  <ul className="space-y-3">
                    {incluidos.map((d) => (
                      <li key={d.id} className="flex items-start gap-3">
                        <span className="flex shrink-0 gap-1">{thumbs(docHojas(d), "sm", 3)}</span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-encre">{d.titulo}</span>
                          <span className="block text-sm text-graphite">{t.pages(d.paginas)}{d.apostilla ? ` · ${t.conApostilla}` : ""}{d.faltan.length ? ` · ${p.faltaPagina.toLowerCase()}` : ""}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 border-t border-cream pt-3 text-sm text-graphite">{[idiomasTxt, plazo, lugar].filter(Boolean).join(" · ")}</p>
                </div>
              )}
              <ol className="grid gap-3 sm:grid-cols-3">
                {p.pasos.map(([a, b]) => <li key={a} className="rounded-xl bg-parchment p-3 text-sm"><strong className="block text-encre">{a}</strong><span className="text-graphite">{b}</span></li>)}
              </ol>
            </>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="button" className={secondary} onClick={restart}>{t.otros}</button>
            {paso === "enviado" && !verDuda && <button type="button" className={secondary} onClick={() => setVerDuda(true)}><MessageCircle className="h-4 w-4" aria-hidden />{p.tengoDuda}</button>}
          </div>
        </section>
        {paso === "enviado" && (verDuda || local.dudas.length > 0) && <div className="mt-4">{dudaCard}</div>}
        {visorEl}
      </div>
    );
  }

  // ——— The guided card ———
  const [titulo, subtitulo] = p.titulo[paso as keyof typeof p.titulo] ?? ["", ""];
  const progreso = (
    <ol className="grid grid-cols-4 gap-2" aria-label={p.etapas.join(" · ")}>
      {p.etapas.map((s, i) => (
        <li key={s} aria-current={i === etapa ? "step" : undefined} aria-label={i < etapa ? p.hechoAria(s) : i === etapa ? p.actualAria(s) : s}>
          <span className={`block h-1.5 rounded-full ${i < etapa ? "bg-vert" : i === etapa ? "bg-or" : "bg-cream"}`} />
          <span className={`mt-1.5 block text-[11px] font-semibold leading-tight sm:text-xs ${i < etapa ? "text-vert" : i === etapa ? "text-encre" : "text-graphite"}`}>
            {i < etapa ? "✓ " : `${i + 1}. `}{s}
          </span>
        </li>
      ))}
    </ol>
  );

  // «Tu solicitud»: what is already answered, each with «Cambiar» when it can still change.
  const puedeArchivos = paso === "email" || paso === "codigo" || paso === "documentos" || paso === "fecha";
  const solicitud: { k: string; label: string; value: string; onChange?: () => void }[] = [
    { k: "idiomas", label: p.idiomas, value: idiomasTxt, onChange: leyendo ? undefined : () => { setOrigen(origenActual ?? ""); setDestinos(destinosActuales); setMulti(destinosActuales.length > 1); setEditLangs(true); } },
    ...(paso !== "archivos"
      ? [view?.lectura && (paso === "documentos" || paso === "fecha")
          ? { k: "docs", label: p.documentos, value: p.docsAvisos(incluidos.length, avisos), onChange: paso === "fecha" ? () => patch({ revisado: false }) : undefined }
          : { k: "archivos", label: p.archivos, value: p.resumenArchivos(view?.archivos.length ?? 0, paginas), onChange: puedeArchivos ? () => patch(view?.estado === "leida" ? { verArchivos: true } : { quiereLeer: false }) : undefined }]
      : []),
    ...(view?.email ? [{ k: "email", label: view.emailVerificado ? p.emailOk : p.emailL, value: view.email, onChange: !view.emailVerificado && paso === "codigo" ? () => { setEmail(view.email ?? ""); patch({ cambiarEmail: true }); } : undefined }] : []),
  ];
  const solicitudAside = (
    <section className={`${CARD} !p-5`} aria-labelledby="solicitud-title">
      <h3 id="solicitud-title" className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-or-dark">{p.solicitud}</h3>
      <dl className="space-y-3">
        {solicitud.map((s) => (
          <div key={s.k} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <dt className="text-sm text-graphite">{s.label}</dt>
              <dd className="break-words font-semibold text-encre">{s.value}</dd>
            </div>
            {s.onChange && <button type="button" className={linkBtn} disabled={!!busy} onClick={s.onChange}>{p.cambiar}</button>}
          </div>
        ))}
      </dl>
      {leyendo && <p className="mt-3 text-xs text-graphite">{p.noCambiarLeyendo}</p>}
    </section>
  );
  const solicitudChips = (
    <ul className="-mt-1 mb-1 flex flex-wrap gap-2 lg:hidden" aria-label={p.solicitud}>
      {solicitud.map((s) => (
        <li key={s.k}>
          {s.onChange ? (
            <button type="button" onClick={s.onChange} disabled={!!busy} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-parchment px-3 text-xs font-semibold text-encre" aria-label={`${s.label}: ${s.value}. ${p.cambiar}`}>
              <Check className="h-3.5 w-3.5 text-vert" aria-hidden />{s.value}<span className="text-bleu underline">· {p.cambiar}</span>
            </button>
          ) : (
            <span className="inline-flex min-h-9 items-center gap-1 rounded-full bg-parchment px-3 text-xs font-semibold text-encre"><Check className="h-3.5 w-3.5 text-vert" aria-hidden />{s.value}</span>
          )}
        </li>
      ))}
    </ul>
  );

  // ——— Body of each step ———
  let bubble: ReactNode = null;
  let body: ReactNode = null;

  if (paso === "archivos") {
    bubble = p.burbujaArchivos;
    body = (
      <div className="space-y-4" {...dropProps}>
        <p className="text-sm font-semibold text-encre">{p.resumenArchivos(view!.archivos.length, paginas)} <span className="font-normal text-vert">· {p.todosSubidos}</span></p>
        <ul className={`flex flex-wrap gap-3 rounded-xl ${drag ? "ring-2 ring-bleu" : ""}`}>
          {view!.archivos.map((a) => {
            const hojas = todasLasHojas.filter((h) => h.archivo.id === a.id);
            return (
              <li key={a.id} className="flex min-w-0 max-w-full flex-col gap-2 rounded-xl border border-cream bg-parchment/50 p-2.5">
                <div className="flex flex-wrap gap-2">{thumbs(hojas, "md", 12)}</div>
                <div className="flex items-center justify-between gap-3 border-t border-cream pt-2">
                  <span className="min-w-0 max-w-[150px] truncate text-xs font-semibold text-encre" title={a.name}>{a.name}</span>
                  <button type="button" className="text-xs font-semibold text-rouge underline disabled:opacity-50" disabled={!!busy} onClick={() => remove(a.id)} aria-label={t.quitar(a.name)}>
                    {busy?.key === `quitar:${a.id}` ? p.quitando : p.quitar}
                  </button>
                </div>
                {a.pages === 0 && <p className="text-xs font-semibold text-rouge">{t.noAbre}</p>}
              </li>
            );
          })}
        </ul>
        {fileInputEl}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className={secondary} disabled={!!busy} onClick={pickFiles}>{busy?.key === "subir" ? <Spinner /> : <Plus className="h-4 w-4" aria-hidden />}{p.anadirMas}</button>
          <button type="button" className={primary} disabled={!!busy} onClick={() => patch(view!.estado === "leida" ? { verArchivos: false } : { quiereLeer: true, verArchivos: false })}>{p.siTodos}</button>
        </div>
      </div>
    );
  }

  if (paso === "email") {
    bubble = t.pideEmail;
    body = (
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void sendEmail(); }}>
        <label className="block text-sm font-semibold text-encre">{t.email}
          <input ref={emailRef} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setNeedWhy(null); }} className={`${field} mt-1`} placeholder="tu@email.com" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <input autoComplete="name" placeholder={t.name} aria-label={t.name} value={nombre} onChange={(e) => setNombre(e.target.value)} className={field} />
          <input type="tel" autoComplete="tel" placeholder={t.whatsapp} aria-label={t.whatsapp} value={telefono} onChange={(e) => setTelefono(e.target.value)} className={field} />
        </div>
        {needWhy && <p className="text-sm font-semibold text-rouge" role="alert">{needWhy}</p>}
        <div className="flex justify-end">
          <button type="submit" className={primary} disabled={!!busy}>{busy?.key === "email" ? <Spinner /> : <Mail className="h-4 w-4" aria-hidden />}{t.enviarCodigo}</button>
        </div>
        {!emailValid(email) && !needWhy && <p className="text-right text-xs text-graphite">{t.falta([t.faltaEmail])}</p>}
        <div className="rounded-xl border border-cream bg-parchment/50 p-3">
          <p className="mb-2 text-xs font-semibold text-graphite">{p.guardados(view!.archivos.length)}</p>
          <div className="flex flex-wrap gap-1.5">{thumbs(todasLasHojas, "sm", 18)}</div>
        </div>
      </form>
    );
  }

  if (paso === "codigo") {
    bubble = t.pideCodigo(view!.email ?? "");
    body = (
      <div className="space-y-3">
        <label className="block text-sm font-semibold text-encre">{t.codigoLabel}
          <input ref={codeRef} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" value={code}
            onChange={(e) => setCode(digits(e.target.value))} onInput={(e) => setCode(digits(e.currentTarget.value))}
            onPaste={(e) => { e.preventDefault(); setCode(digits(e.clipboardData.getData("text"))); }}
            className="mt-1 block w-56 rounded-xl border border-graphite/30 bg-white px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] text-encre" />
        </label>
        <p className="flex items-center gap-2 text-sm text-graphite"><Lock className="h-4 w-4 shrink-0" aria-hidden />{code.length > 0 && code.length < 6 ? t.faltaCodigo : p.codigoSigue}</p>
        <p className="flex flex-wrap gap-x-3 gap-y-1">
          <button type="button" className={linkBtn} disabled={!!busy} onClick={resend}>{busy?.key === "reenviar" ? t.enviarCodigo + "…" : t.reenviar}</button>
          <button type="button" className={linkBtn} disabled={!!busy} onClick={() => { setEmail(view!.email ?? ""); patch({ cambiarEmail: true }); }}>{p.cambiarEmail}</button>
        </p>
        <div className="rounded-xl border border-cream bg-parchment/50 p-3">
          <p className="mb-2 text-xs font-semibold text-graphite">{p.guardados(view!.archivos.length)}</p>
          <div className="flex flex-wrap gap-1.5">{thumbs(todasLasHojas, "sm", 18)}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button type="button" className={primary} disabled={!!busy || code.length !== 6} onClick={() => verify(code)}>{busy?.key === "verificar" ? <Spinner /> : null}{p.confirmarSeguir}</button>
          {code.length !== 6 && <p className="text-xs text-graphite">{code.length ? t.faltaCodigo : t.esperandoBoton}</p>}
        </div>
      </div>
    );
  }

  if (paso === "lectura") {
    const steps = progressSteps(view!.archivos);
    const at = Math.min(tick, steps.length - 1);
    const current = steps[at];
    const archivoActual = current?.kind === "archivo" ? view!.archivos.find((a) => a.name === current.name)?.id : undefined;
    bubble = p.burbujaLectura;
    body = (
      <div className="space-y-4">
        <div className="h-2 overflow-hidden rounded-full bg-cream" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={at + 1}>
          <div className="h-full rounded-full bg-or transition-all duration-700" style={{ width: `${Math.round(((at + 1) / (steps.length + 1)) * 100)}%` }} />
        </div>
        <ul className="space-y-1.5 text-[15px]">
          {steps.map((s, i) => (
            <li key={i} className={`flex items-center gap-2 ${i < at ? "text-encre" : i === at ? "font-semibold text-encre" : "text-graphite/70"}`}>
              {i < at ? <Check className="h-4 w-4 text-vert" aria-hidden /> : i === at ? <Spinner /> : <span className="h-4 w-4" aria-hidden />}
              {s.kind === "inicio" ? t.inicio(s.files, s.pages) : s.kind === "archivo" ? t.archivo(s.name, s.pages) : t[s.kind]}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {todasLasHojas.slice(0, 24).map((h, i) => (
            <Miniatura key={`${h.archivo.id}:${h.page}`} h={h} size="md" highlight={h.archivo.id === archivoActual} onOpen={() => abrir(todasLasHojas, i)} ariaLabel={p.ampliar(h.archivo.name, h.label)} />
          ))}
        </div>
      </div>
    );
  }

  if (paso === "documentos") {
    const l = view!.lectura!;
    const manual = l.fase === "revision_manual";
    bubble = manual ? t.manual : <><strong>{t.resumenLectura(view!.archivos.length, incluidos.length).replace(/:$/, ".")}</strong> {p.burbujaDocs}{avisos ? ` ${p.avisos(avisos)}` : ""}</>;
    const preguntas = l.preguntas;
    body = (
      <div className="space-y-4">
        {view!.soloLectura && <p className="rounded-xl bg-parchment px-4 py-3 text-sm text-encre">{view!.soloLectura === "otra_entrada" ? t.soloLecturaOtra : t.soloLecturaCaso}</p>}
        <ol className="space-y-3">
          {documentos.map((d, n) => {
            const hojas = docHojas(d);
            const badge = !d.incluido ? [p.noSeTraduce, "bg-cream text-graphite"] : d.faltan.length ? [p.faltaPagina, "bg-or/20 text-or-dark"] : d.ilegible ? [p.seLeeMal, "bg-or/20 text-or-dark"] : [p.completo, "bg-vert/10 text-vert"];
            const nombres = [...new Set(hojas.map((h) => h.archivo.name))];
            return (
              <li key={d.id} className={`rounded-xl border p-4 ${!d.incluido ? "border-cream bg-parchment/40 opacity-80" : conAviso(d) ? "border-or bg-white" : "border-cream bg-parchment/30"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="min-w-0 flex-1 font-bold text-encre"><span className="text-or-dark">{n + 1}.</span> {d.titulo}</h3>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${badge[1]}`}>{badge[0]}</span>
                </div>
                <p className="mt-0.5 break-words text-sm text-graphite">{[t.pages(d.paginas), d.apostilla ? t.conApostilla : null, nombres.length === 1 ? nombres[0] : null].filter(Boolean).join(" · ")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {thumbs(hojas)}
                  {d.incluido && d.faltan.map((pg) => (
                    <figure key={`f${pg}`} className="flex w-min flex-col items-center gap-1">
                      <button type="button" onClick={pickFiles} disabled={!!busy || !l.editable} className="flex h-[104px] w-[76px] items-center justify-center rounded-md border-2 border-dashed border-or bg-or/5 text-or-dark disabled:opacity-50" aria-label={p.anadirPag(pg)}>
                        <Plus className="h-6 w-6" aria-hidden />
                      </button>
                      <figcaption className="max-w-[76px] text-center text-[11px] font-bold text-or-dark">{p.anadirPag(pg)}</figcaption>
                    </figure>
                  ))}
                </div>
                {d.incluido && d.faltan.length > 0 && <p className="mt-3 flex gap-2 rounded-lg bg-or/10 px-3 py-2 text-sm text-encre"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-or-dark" aria-hidden />{t.faltan(d.faltan.join(", "))}</p>}
                {d.incluido && d.ilegible && <p className="mt-3 flex gap-2 rounded-lg bg-or/10 px-3 py-2 text-sm text-encre"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-or-dark" aria-hidden />{t.ilegible}</p>}
                {!d.incluido && d.motivo && <p className="mt-2 text-xs text-graphite">{t.noIncluido}: {d.motivo}</p>}
                {faltaAbierta === d.id && (
                  <div className="mt-3 space-y-2 rounded-lg bg-parchment px-3 py-3 text-sm text-encre">
                    {local.notas.includes(p.notaFalta(d.titulo)) ? <p className="font-semibold text-vert">{p.anotado}</p> : (
                      <>
                        <p>{p.laTienes}</p>
                        <div className="flex flex-wrap gap-2">
                          {l.editable && <button type="button" className={chip(false)} disabled={!!busy} onClick={pickFiles}><Plus className="h-4 w-4" aria-hidden />{p.anadirPagina}</button>}
                          <button type="button" className={chip(false)} onClick={() => patch({ notas: [local.notas, p.notaFalta(d.titulo)].filter(Boolean).join("\n") })}>{p.noLaTengo}</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-cream pt-3">
                  {l.editable && (
                    <button type="button" className={linkBtn} disabled={!!busy} onClick={() => edit(`doc:${d.id}`, d.incluido ? { op: "exclude", id: d.id } : { op: "include", id: d.id })}>
                      {busy?.key === `doc:${d.id}` ? t.guardando : d.incluido ? t.noNecesito : t.siNecesito}
                    </button>
                  )}
                  {d.incluido && <button type="button" className={linkBtn} onClick={() => setFaltaAbierta(faltaAbierta === d.id ? null : d.id)}>{p.faltaPagina}</button>}
                </div>
              </li>
            );
          })}
        </ol>
        {l.noIncluidos.length > 0 && (
          <div className="rounded-xl bg-parchment/60 px-4 py-3 text-sm">
            <p className="font-semibold text-encre">{t.noIncluido}</p>
            <ul className="mt-1 list-disc pl-5 text-graphite">{l.noIncluidos.map((x, i) => <li key={i}>{x.que}: {x.motivo}</li>)}</ul>
          </div>
        )}
        {preguntas.map((q, i) => {
          const done = local.respuestas[i] !== undefined;
          const idioma = isLangQuestion(q);
          return (
            <div key={i} className="space-y-2 rounded-xl border border-bleu/20 bg-bleu/5 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-bleu">{done ? p.respondida : p.unaPregunta}</p>
              <p className="font-semibold text-encre">{q}</p>
              {done ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-encre">«{local.respuestas[i]}» <button type="button" className={linkBtn} onClick={() => { const { [i]: _, ...rest } = local.respuestas; void _; patch({ respuestas: rest }); }}>{p.cambiar}</button></p>
              ) : idioma ? (
                <div className="space-y-2">
                  {langFields(true)}
                  <button type="button" className={primary} disabled={!!busy || !destinos.length || sameLang} onClick={() => answerIdioma(i)}>{busy?.key === "idiomas" ? <Spinner /> : null}{t.listo}</button>
                </div>
              ) : (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); answerTexto(i); }}>
                  <input value={answers[i] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))} placeholder={t.responder} aria-label={t.responder} className={`${field} min-w-0`} />
                  <button type="submit" className={`${primary} shrink-0 !px-4`} disabled={!(answers[i] ?? "").trim()}>{t.enviarRespuesta}</button>
                </form>
              )}
            </div>
          );
        })}
        {fileInputEl}
        {desde}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {l.editable ? <button type="button" className={secondary} disabled={!!busy} onClick={pickFiles}><Plus className="h-4 w-4" aria-hidden />{p.anadirDocs}</button> : <span />}
          <button type="button" className={primary} disabled={!!busy} onClick={() => patch({ revisado: true })}>{p.bienAsi}</button>
        </div>
        <p className="text-right text-xs text-graphite">{p.puedesSeguir}</p>
      </div>
    );
  }

  if (paso === "fecha") {
    bubble = p.burbujaFecha;
    body = (
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold text-encre">{p.paraCuando}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(["ASAP", "DATE", "FLEXIBLE"] as const).map((u) => (
              <button key={u} type="button" aria-pressed={urgency === u} className={chip(urgency === u)} onClick={() => { setNeedWhy(null); patch({ urgency: u, neededBy: u === "DATE" ? neededBy : null }); }}>
                {u === "ASAP" ? t.asap : u === "DATE" ? t.fecha : t.sinPrisa}
              </button>
            ))}
          </div>
          {urgency === "DATE" && (
            <label className="block text-sm font-semibold text-encre">{p.fechaLimite}
              <input type="date" value={neededBy ?? ""} min={new Date().toISOString().slice(0, 10)} onChange={(e) => { setNeedWhy(null); patch({ neededBy: /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) ? e.target.value : null }); }} className={`${field} mt-1 block max-w-[220px]`} />
            </label>
          )}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold text-encre">{p.donde}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-encre">{t.pais}
              <select value={local.pais ?? ""} onChange={(e) => patch({ pais: e.target.value || null })} className={`${field} mt-1`}>
                <option value="">…</option>
                {paises.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-encre">{t.organismo}
              <input value={local.organismo ?? ""} onChange={(e) => patch({ organismo: e.target.value || null })} placeholder={t.organismoPh} className={`${field} mt-1`} />
            </label>
          </div>
          {(local.pais || local.organismo) && <button type="button" className={linkBtn} onClick={() => patch({ pais: null, organismo: null })}>{t.noSeAun}</button>}
        </fieldset>
        <label className="block">
          <span className="font-bold text-encre">{p.algoMas}</span> <span className="text-sm text-graphite">{p.opcional}</span>
          <textarea value={local.notas} onChange={(e) => patch({ notas: e.target.value })} rows={3} placeholder={t.notasPh} className={`${field} mt-2`} />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {desde}
          <button type="button" className={`${primary} shrink-0`} disabled={!!busy} onClick={enviar}>{busy?.key === "enviar" ? <Spinner /> : null}{t.enviar}</button>
        </div>
        {(needWhy || plazoFalta) && <p className={needWhy ? "text-right text-sm font-semibold text-rouge" : "text-right text-xs text-graphite"} role={needWhy ? "alert" : undefined}>{needWhy ?? plazoFalta}</p>}
      </div>
    );
  }

  return (
    <div className="mt-4 grid items-start gap-4 sm:mt-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-7">
      <aside className="hidden flex-col gap-4 lg:flex">
        {solicitudAside}
        {dudaCard}
      </aside>
      <section id="subir" ref={cardRef} className={`${CARD} min-w-0 scroll-mt-24 space-y-5`} aria-labelledby="puerta-titulo" lang={lang}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-or text-white" aria-hidden><Upload className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 id="puerta-titulo" ref={headRef} tabIndex={-1} className="font-baskerville text-xl font-bold text-encre outline-none sm:text-2xl">{titulo}</h2>
            <p className="text-sm text-graphite">{subtitulo}</p>
          </div>
        </div>
        {progreso}
        {solicitudChips}
        {editLangs && (
          <div className="space-y-3 rounded-xl border border-bleu/20 bg-bleu/5 p-4">
            {langFields(true)}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className={primary} disabled={!!busy || !destinos.length || sameLang} onClick={async () => { if (await saveLangs(origen, destinos)) setEditLangs(false); }}>{busy?.key === "idiomas" ? <Spinner /> : null}{t.listo}</button>
              <button type="button" className={linkBtn} onClick={() => setEditLangs(false)}>{t.cancelar}</button>
            </div>
          </div>
        )}
        {bubble && <Burbuja>{bubble}</Burbuja>}
        {statusLine}
        {errorLine}
        {why && <p className="text-sm font-semibold text-rouge" role="alert">{why}</p>}
        {body}
      </section>
      <div className="lg:hidden">{dudaCard}</div>
      {visorEl}
    </div>
  );
}
