import { z } from "zod";
import { emailReal, telefono9 } from "../caso/identidad.ts";
import { parseDeadline } from "../needed-by.ts";
import { abrirEntrada, confirmarEntrada, editarEntrada, leerEntrada, quitarArchivo, registrarArchivo, tokenHashOf, vistaEntrada, type FlowDeps, type Outcome } from "./flow.ts";
import type { EntradaRow } from "./store.ts";

export type ApiResponse = { status: number; body: unknown; headers?: Record<string, string> };
export type EntradaApiDeps = FlowDeps & {
  enabled(): boolean;
  rateLimit(key: string, limit: number, windowMs: number): Promise<{ ok: boolean; retryAfterSec: number }>;
  clientIp(req: Request): string;
  ipHash(ip: string): string;
  isOwnBlobUrl(url: string): boolean;
};

const HOUR = 36e5;
const DAY = 24 * HOUR;
export const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif", "image/tiff", "image/webp"] as const;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const Lang = z.string().trim().toLowerCase().regex(/^[a-z]{2,3}$/);
const Text = (max: number) => z.string().trim().max(max);

export const OpenBody = z.strictObject({
  email: z.string().trim().toLowerCase().max(254).email(),
  nombre: Text(120).nullable().optional(),
  telefono: Text(40).nullable().optional(),
  sourceLang: Lang.nullable().optional(),
  targetLang: Lang.nullable().optional(),
  gdprConsent: z.literal(true),
  marketingConsent: z.literal(true),
});

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
]);

export const ConfirmBody = z.strictObject({
  urgency: z.enum(["ASAP", "DATE", "FLEXIBLE"]),
  neededBy: z.string().max(30).nullable().optional(),
  organismo: Text(300).nullable().optional(),
  notas: Text(2000).nullable().optional(),
  loteUpdatedAt: z.iso.datetime().nullable().optional(),
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
  const email = emailReal(b.email);
  if (!email) return json(400, { ok: false, error: "Ese email no parece válido." });
  const phone9 = b.telefono ? telefono9(b.telefono) : null;
  if (b.telefono && !phone9) return json(400, { ok: false, error: "Ese teléfono no parece válido." });
  const { token } = await abrirEntrada(deps, {
    canal: "web", email, phone9, nombre: b.nombre || null, sourceLang: b.sourceLang ?? null, targetLang: b.targetLang ?? null, ipHash: deps.ipHash(ip), marketing: true,
  });
  return json(200, { ok: true, token });
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
  const rl = await limits(deps, [[`read:entrada:${e.id}`, 12, DAY], [`read:email:${e.email ?? e.phone9 ?? e.id}`, 20, DAY], ["read:global", 400, DAY]]);
  if (rl) return rl;
  return fromOutcome(await leerEntrada(deps, e));
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
    urgency: deadline.urgency, neededBy: deadline.neededBy, organismo: b.organismo || null, notas: b.notas || null, loteUpdatedAt: b.loteUpdatedAt ?? null,
  }));
}
