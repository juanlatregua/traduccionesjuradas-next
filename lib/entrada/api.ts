import { z } from "zod";
import { emailReal, telefono9 } from "../caso/identidad.ts";
import { parseDeadline } from "../needed-by.ts";
import { abrirEntrada, confirmarEnlace, ponerEmail, confirmarEntrada, currentFingerprint, editarEntrada, enviarCodigo, readingInProgress, leerEntrada, quitarArchivo, registrarArchivo, tokenHashOf, verificarCodigo, vistaEntrada, type FlowDeps, type Outcome } from "./flow.ts";
import type { EntradaRow } from "./store.ts";
import { answerQuestion, type ConserjeCall } from "./conserje.ts";
import type { EntradaLang } from "./i18n.ts";
import { ENTRADA_SOURCES } from "./sources.ts";

export type ApiResponse = { status: number; body: unknown; headers?: Record<string, string> };
export type EntradaApiDeps = FlowDeps & {
  enabled(): boolean;
  rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number; remaining?: number }>;
  alertStaff(subject: string, text: string): Promise<void>;
  conserje: ConserjeCall;
  /** Adds `amount` to a per-window budget; false (and nothing added) when it would pass `limit`. */
  budget(key: string, amount: number, limit: number, windowMs: number): Promise<boolean>;
  clientIp(req: Request): string;
  ipHash(ip: string): string;
  isOwnBlobUrl(url: string): boolean;
};

const HOUR = 36e5;
const DAY = 24 * HOUR;
export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/tiff", "image/webp"] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
/** Readings cost money: per verified email, per IP and a global ceiling; staff hears at half of it. */
export const READS_PER_EMAIL_DAY = 3;
export const READS_PER_IP_DAY = 10;
export const READS_GLOBAL_DAY = 400;
export const CODES_PER_EMAIL_HOUR = 5;
export const CODES_PER_EMAIL_DAY = 10;
export const CODES_PER_IP_DAY = 30;
/** Before the email is verified the entrada is anonymous: what one IP may upload per day. */
export const ANON_FILES_PER_IP_DAY = 60;
export const ANON_MB_PER_IP_DAY = 300;
/** Doubts answered by the model: per verified entrada, per email, per IP and a global ceiling. */
export const DOUBTS_PER_ENTRADA_DAY = 15;
export const DOUBTS_PER_EMAIL_DAY = 30;
export const DOUBTS_PER_IP_DAY = 40;
export const DOUBTS_GLOBAL_DAY = 1500;

export { ENTRADA_SOURCES };
export const ENTRADA_LANGS = ["es", "fr", "en", "de", "pt"] as const;

const Lang = z.string().trim().toLowerCase().regex(/^[a-z]{2,3}$/);
const Text = (max: number) => z.string().trim().max(max);

export const OpenBody = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email().optional(),
  nombre: Text(120).nullable().optional(),
  telefono: Text(40).nullable().optional(),
  sourceLang: Lang.nullable().optional(),
  targetLang: Lang.nullable().optional(),
  targetLangs: z.array(Lang).max(5).optional(),
  source: z.enum(ENTRADA_SOURCES).nullable().optional(),
  lang: z.enum(ENTRADA_LANGS).nullable().optional(),
  gdprConsent: z.literal(true),
  marketingConsent: z.boolean().optional(),
});

export const EmailBody = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email(),
  nombre: Text(120).nullable().optional(),
  telefono: Text(40).nullable().optional(),
  marketingConsent: z.literal(true),
});

export const LinkBody = z.strictObject({ k: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) });

export const FileBody = z.strictObject({
  url: z.string().url().max(1000),
  name: z.string().trim().min(1).max(255),
  size: z.number().int().min(1).max(MAX_FILE_BYTES),
  mimeType: z.enum(ALLOWED_TYPES),
});

export const EditBody = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("exclude"), id: z.string().min(1).max(120), note: Text(200).nullable().optional() }),
  z.strictObject({ op: z.literal("include"), id: z.string().min(1).max(120) }),
  z.strictObject({ op: z.literal("setTargetLang"), targetLang: Lang }),
  z.strictObject({ op: z.literal("setLangs"), sourceLang: Lang.nullable(), targetLangs: z.array(Lang).min(1).max(5) }),
]);

export const QuestionBody = z.strictObject({ question: Text(500).min(2), paso: z.string().trim().max(40) });

export const CodeBody = z.strictObject({ code: z.string().trim().regex(/^\d{6}$/, "6 cifras") });

export const ConfirmBody = z.strictObject({
  urgency: z.enum(["ASAP", "DATE", "FLEXIBLE"]),
  neededBy: z.string().max(30).nullable().optional(),
  organismo: Text(300).nullable().optional(),
  notas: Text(2000).nullable().optional(),
  loteUpdatedAt: z.iso.datetime().nullable().optional(),
  pais: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).nullable().optional(),
  respuestas: z.array(z.strictObject({ pregunta: Text(300), respuesta: Text(1000) })).max(20).optional(),
});

const json = (status: number, body: unknown, headers?: Record<string, string>): ApiResponse => ({ status, body, ...(headers ? { headers } : {}) });
const invalid = (err: z.ZodError) => json(400, { ok: false, error: "Revisa los datos.", issues: err.issues.map((i) => `${i.path.join(".") || "cuerpo"}: ${i.message}`) });
const limited = (retryAfterSec: number) => json(429, { ok: false, error: "Demasiados intentos. Prueba de nuevo en unos minutos." }, { "Retry-After": String(retryAfterSec) });
const off = () => json(404, { ok: false, error: "No disponible." });

async function body(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

async function limits(deps: EntradaApiDeps, rules: [string, number, number][]): Promise<ApiResponse | null> {
  for (const [key, limit, windowMs] of rules) {
    const r = await deps.rateLimit(`entrada:${key}`, limit, windowMs);
    if (!r.ok) return limited(r.retryAfterSec);
  }
  return null;
}

function fromOutcome(o: Outcome): ApiResponse {
  if (o.ok) return json(200, { ok: true, view: o.view });
  const headers = o.retryAfterSec ? { "Retry-After": String(o.retryAfterSec) } : undefined;
  return json(o.status, { ok: false, error: o.error, ...(o.busy ? { busy: true } : {}), ...(o.view ? { view: o.view } : {}) }, headers);
}

async function entradaOf(deps: EntradaApiDeps, token: string): Promise<EntradaRow | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  return deps.store.byTokenHash(tokenHashOf(token));
}

type Gated = { entrada: EntradaRow; ip: string } | ApiResponse;
async function gated(req: Request, token: string, deps: EntradaApiDeps, scope: string, perIp: number, windowMs: number): Promise<Gated> {
  if (!deps.enabled()) return off();
  const ip = deps.clientIp(req);
  const rl = await limits(deps, [[`${scope}:ip:${ip}`, perIp, windowMs]]);
  if (rl) return rl;
  const entrada = await entradaOf(deps, token);
  if (!entrada) return json(404, { ok: false, error: "Esta solicitud no existe o ha caducado." });
  return { entrada, ip };
}

export async function handleOpen(req: Request, deps: EntradaApiDeps): Promise<ApiResponse> {
  if (!deps.enabled()) return off();
  const ip = deps.clientIp(req);
  const rl = await limits(deps, [[`open:ip:${ip}`, 20, DAY], ["open:global", 2000, DAY]]);
  if (rl) return rl;
  const parsed = OpenBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  const b = parsed.data;
  const email = b.email ? emailReal(b.email) : null;
  if (b.email && !email) return json(400, { ok: false, error: "Ese email no parece válido." });
  if (email && b.marketingConsent !== true) return json(400, { ok: false, error: "Falta el consentimiento para enviarte el presupuesto." });
  const phone9 = b.telefono ? telefono9(b.telefono) : null;
  if (b.telefono && !phone9) return json(400, { ok: false, error: "Ese teléfono no parece válido." });
  const { token } = await abrirEntrada(deps, {
    canal: "web", email, phone9, nombre: b.nombre || null, sourceLang: b.sourceLang ?? null, targetLang: b.targetLang ?? null, targetLangs: b.targetLangs,
    ipHash: deps.ipHash(ip), marketing: Boolean(email), source: b.source ?? null, lang: b.lang ?? null,
  });
  if (!email) return json(200, { ok: true, token, codeSent: false });
  const entrada = await deps.store.byTokenHash(tokenHashOf(token));
  const sent = entrada ? await sendCodeLimited(deps, entrada, ip) : null;
  return json(200, { ok: true, token, codeSent: sent === null });
}

export async function handleEmail(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "email", 30, HOUR);
  if ("status" in g) return g;
  const parsed = EmailBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  const email = emailReal(parsed.data.email);
  if (!email) return json(400, { ok: false, error: "Ese email no parece válido." });
  const phone9 = parsed.data.telefono ? telefono9(parsed.data.telefono) : null;
  if (parsed.data.telefono && !phone9) return json(400, { ok: false, error: "Ese teléfono no parece válido." });
  const rl = await limits(deps, [[`code:email:${email}`, CODES_PER_EMAIL_HOUR, HOUR], [`code:email-day:${email}`, CODES_PER_EMAIL_DAY, DAY], [`code:ip:${g.ip}`, CODES_PER_IP_DAY, DAY]]);
  if (rl) return rl;
  return fromOutcome(await ponerEmail(deps, g.entrada, { email, phone9, nombre: parsed.data.nombre || null }));
}

/** The «Confirmar mi email» button: no entrada token travels, only the one-time link; the answer reveals nothing else. */
export async function handleConfirmLink(req: Request, deps: EntradaApiDeps): Promise<ApiResponse> {
  if (!deps.enabled()) return off();
  const ip = deps.clientIp(req);
  const rl = await limits(deps, [[`link:ip:${ip}`, 30, HOUR]]);
  if (rl) return rl;
  const parsed = LinkBody.safeParse(await body(req));
  if (!parsed.success) return json(400, { ok: false });
  const r = await confirmarEnlace(deps, parsed.data.k);
  return json(r.status, { ok: r.ok });
}

async function sendCodeLimited(deps: EntradaApiDeps, e: EntradaRow, ip: string): Promise<ApiResponse | null> {
  const rl = await limits(deps, [[`code:email:${e.email}`, CODES_PER_EMAIL_HOUR, HOUR], [`code:email-day:${e.email}`, CODES_PER_EMAIL_DAY, DAY], [`code:ip:${ip}`, CODES_PER_IP_DAY, DAY]]);
  if (rl) return rl;
  const o = await enviarCodigo(deps, e);
  return o.ok ? null : fromOutcome(o);
}

export async function handleSendCode(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "code", 60, HOUR);
  if ("status" in g) return g;
  if (g.entrada.emailVerifiedAt) return json(200, { ok: true, view: await vistaEntrada(deps, g.entrada) });
  const err = await sendCodeLimited(deps, g.entrada, g.ip);
  return err ?? json(200, { ok: true, view: await vistaEntrada(deps, (await deps.store.get(g.entrada.id)) ?? g.entrada) });
}

export async function handleVerify(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "verify", 60, HOUR);
  if ("status" in g) return g;
  const parsed = CodeBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  return fromOutcome(await verificarCodigo(deps, g.entrada, parsed.data.code));
}

export async function handleGet(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "get", 600, 10 * 60 * 1000);
  if ("status" in g) return g;
  return json(200, { ok: true, view: await vistaEntrada(deps, g.entrada) });
}

export async function handleAddFile(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "file", 400, DAY);
  if ("status" in g) return g;
  const parsed = FileBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  if (!deps.isOwnBlobUrl(parsed.data.url)) return json(400, { ok: false, error: "Archivo no válido." });
  if (!g.entrada.emailVerifiedAt) {
    const rl = await limits(deps, [[`anon-files:ip:${g.ip}`, ANON_FILES_PER_IP_DAY, DAY]]);
    if (rl) return rl;
    if (!(await deps.budget(`entrada:anon-mb:ip:${g.ip}`, Math.ceil(parsed.data.size / (1024 * 1024)), ANON_MB_PER_IP_DAY, DAY))) {
      return json(429, { ok: false, error: "Hoy ya has subido muchos archivos desde aquí. Déjanos tu email y seguimos, o inténtalo mañana." });
    }
  }
  return fromOutcome(await registrarArchivo(deps, g.entrada, parsed.data));
}

export async function handleRemoveFile(req: Request, token: string, fileId: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "file", 400, DAY);
  if ("status" in g) return g;
  if (!fileId || fileId.length > 120) return json(400, { ok: false, error: "Archivo no válido." });
  return fromOutcome(await quitarArchivo(deps, g.entrada, fileId));
}

export async function handleRead(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "read", 30, HOUR);
  if ("status" in g) return g;
  const e = g.entrada;
  if (!e.emailVerifiedAt || e.estado === "confirmada" || e.estado === "sin_jurado") return fromOutcome(await leerEntrada(deps, e));
  const running = await readingInProgress(deps, e);
  const continuing = running !== null && running.fingerprint === (await currentFingerprint(deps, e)) ? running.fingerprint : undefined;
  if (continuing === undefined) {
    const who = e.email ?? e.phone9 ?? e.id;
    const rl = await limits(deps, [[`read:entrada:${e.id}`, 12, DAY], [`read:email:${who}`, READS_PER_EMAIL_DAY, DAY], [`read:ip:${g.ip}`, READS_PER_IP_DAY, DAY]]);
    if (rl) return rl;
    const global = await deps.rateLimit("entrada:read:global", READS_GLOBAL_DAY, DAY);
    if ((global.remaining ?? READS_GLOBAL_DAY) <= READS_GLOBAL_DAY / 2 && (await deps.rateLimit("entrada:read:global-alert", 1, DAY)).ok) {
      deps.alertStaff("Entrada web: la mitad del tope diario de lecturas", `Se han usado ${READS_GLOBAL_DAY - (global.remaining ?? 0)} de ${READS_GLOBAL_DAY} lecturas de hoy. Si sigue subiendo, revisa si es abuso.`).catch(console.error);
    }
    if (!global.ok) return json(503, { ok: false, error: "Hoy estamos revisando muchos documentos. Juan verá los tuyos personalmente: déjalos subidos y te escribimos." }, { "Retry-After": String(global.retryAfterSec) });
  }
  return fromOutcome(await leerEntrada(deps, e, { continuing }));
}

export async function handleEdit(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "edit", 240, 10 * 60 * 1000);
  if ("status" in g) return g;
  const parsed = EditBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  return fromOutcome(await editarEntrada(deps, g.entrada, parsed.data));
}

export async function handleConfirm(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "confirm", 30, HOUR);
  if ("status" in g) return g;
  const parsed = ConfirmBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  const b = parsed.data;
  const deadline = parseDeadline(b.urgency, b.neededBy ?? null, deps.now());
  if (!deadline) return json(400, { ok: false, error: "Indica para qué fecha lo necesitas (de hoy a un año vista)." });
  return fromOutcome(await confirmarEntrada(deps, g.entrada, {
    urgency: deadline.urgency, neededBy: deadline.neededBy, organismo: b.organismo || null, notas: b.notas || null, loteUpdatedAt: b.loteUpdatedAt ?? null, pais: b.pais ?? null, respuestas: b.respuestas,
  }));
}

export async function handleQuestion(req: Request, token: string, deps: EntradaApiDeps): Promise<ApiResponse> {
  const g = await gated(req, token, deps, "doubt", 120, HOUR);
  if ("status" in g) return g;
  const e = g.entrada;
  if (!e.emailVerifiedAt) return json(403, { ok: false, error: "Confirma tu email con el código para que podamos contestarte." });
  const parsed = QuestionBody.safeParse(await body(req));
  if (!parsed.success) return invalid(parsed.error);
  const rl = await limits(deps, [
    [`doubt:entrada:${e.id}`, DOUBTS_PER_ENTRADA_DAY, DAY], [`doubt:email:${e.email ?? e.phone9 ?? e.id}`, DOUBTS_PER_EMAIL_DAY, DAY],
    [`doubt:ip:${g.ip}`, DOUBTS_PER_IP_DAY, DAY], ["doubt:global", DOUBTS_GLOBAL_DAY, DAY],
  ]);
  if (rl) return rl;
  const view = await vistaEntrada(deps, e);
  const lang = (["es", "fr", "en", "de", "pt"].includes(e.lang ?? "") ? e.lang : "es") as EntradaLang;
  const r = await answerQuestion(deps.conserje, lang, parsed.data.question, {
    paso: parsed.data.paso, documentos: view.lectura?.documentos.map((d) => d.titulo) ?? [], origen: view.idiomas.origen, destinos: view.idiomas.destinos,
    organismo: view.organismo, pais: view.pais,
  });
  return json(200, { ok: true, answer: r.answer });
}
