// Una entrada: archivos → «he terminado» → puerta de identidad → una lectura del conjunto → el cliente confirma → Juan presupuesta.
// Aquí no nace ningún presupuesto, ninguna solicitud a jurados ni ningún precio.
import { createHash, randomBytes } from "node:crypto";
import { applyEdit } from "../lectura-constructor/documents.ts";
import type { StartInput, StartResult } from "../lectura-constructor/run.ts";
import type { LecturaStore } from "../lectura-constructor/store.ts";
import type { Canal } from "./identidad.ts";
import { sha256, type GateInput, type GateResult } from "./puerta.ts";
import { CODE_MAX_ATTEMPTS, CODE_TTL_MS, codeHashOf, codeMatches, newCode } from "./codigo.ts";
import { sessionKeyOf, type ArchivoRow, type EntradaRow, type EntradaStore } from "./store.ts";
import { clientView, ownLote, type ClientView, type ReadingExtras } from "./view.ts";
import { fingerprintOf } from "../lectura-constructor/run.ts";

export const MAX_ARCHIVOS = 40;
export const EXCLUDED_BY_CLIENT = "el cliente indica que no hace falta traducirlo";

export type Jurado = "si" | "no" | "desconocido";
export type Aviso =
  | { kind: "confirmada"; entrada: EntradaRow; casoRef: string | null; documentos: number }
  | { kind: "sin_jurado"; entrada: EntradaRow; casoRef: string | null; idioma: string };

export type FlowDeps = {
  store: EntradaStore;
  gate(input: GateInput): Promise<GateResult>;
  download(url: string): Promise<Uint8Array>;
  lectura: {
    ready(): string | null;
    store: LecturaStore;
    start(input: StartInput, files: ArchivoRow[]): Promise<StartResult>;
    extras(loteId: string): Promise<ReadingExtras | null>;
    /** A finished lote of this caso that read exactly these files (by sha256): reused instead of paying a second reading. */
    reusable(casoId: string, hashes: string[]): Promise<string | null>;
  };
  hasJurado(sourceLang: string, targetLang: string): Promise<Jurado>;
  caso: {
    ref(casoId: string): Promise<string | null>;
    evento(casoId: string, tipo: string, actor: string, payload: Record<string, unknown>): Promise<void>;
    plazo(casoId: string, urgency: string, neededBy: Date | null): Promise<void>;
    /** Closes the caso as SIN_JURADO (not a loss) only if nothing else lives in it: quotes, orders, requests, other entradas, files or messages from other channels. */
    cerrarSinJurado(casoId: string, entradaId: string): Promise<boolean>;
  };
  notify(aviso: Aviso): Promise<void>;
  sendCode(to: string, code: string, lang: string | null): Promise<void>;
  now(): Date;
  newId(): string;
};

/** WhatsApp, the inbox email and the constructor arrive with an identity already proven; the web proves its email with a code. */
export const VERIFIED_CANALES: ReadonlySet<Canal> = new Set<Canal>(["whatsapp", "email", "constructor"]);
/** The caso existed before this entrada: it only gets additions, never overwrites. */
export const joinedExisting = (e: Pick<EntradaRow, "regla">) => e.regla === "huella" || e.regla === "contacto";

export const tokenHashOf = (token: string) => createHash("sha256").update(token).digest("hex");
const actorOf = (e: EntradaRow) => `cliente:${e.email ?? e.phone9 ?? e.id}`;

export async function abrirEntrada(deps: FlowDeps, input: { canal: Canal; email: string | null; phone9: string | null; nombre: string | null; sourceLang: string | null; targetLang: string | null; ipHash: string | null; marketing: boolean; source?: string | null; lang?: string | null }) {
  const token = randomBytes(24).toString("base64url");
  const now = deps.now();
  const entrada = await deps.store.create({
    canal: input.canal, email: input.email, phone9: input.phone9, nombre: input.nombre, sourceLang: input.sourceLang, targetLang: input.targetLang, source: input.source ?? null, lang: input.lang ?? null,
    tokenHash: tokenHashOf(token), ipHash: input.ipHash, gdprConsentAt: now, marketingConsentAt: input.marketing ? now : null,
    emailVerifiedAt: VERIFIED_CANALES.has(input.canal) ? now : null,
  });
  return { token, entrada };
}

export type Outcome = { ok: true; view: ClientView } | { ok: false; status: number; error: string; view?: ClientView; retryAfterSec?: number; busy?: boolean };

const fail = (status: number, error: string, extra: Partial<Extract<Outcome, { ok: false }>> = {}): Outcome => ({ ok: false, status, error, ...extra });

async function sinJuradoDe(deps: FlowDeps, e: EntradaRow, loteId: string | null): Promise<string | null> {
  if (e.estado !== "sin_jurado") return null;
  if (e.sourceLang && e.targetLang) return e.sourceLang === "es" ? e.targetLang : e.sourceLang;
  const data = loteId ? await deps.lectura.store.get(loteId) : null;
  const lang = data?.documents.find((d) => d.included)?.sourceLang ?? null;
  return lang === "es" ? (data?.lote.targetLang ?? e.targetLang) : lang;
}

export async function vistaEntrada(deps: FlowDeps, e: EntradaRow): Promise<ClientView> {
  const files = await deps.store.files(e.id);
  const data = e.loteId ? await deps.lectura.store.get(e.loteId) : null;
  const extras = e.loteId && data && (data.lote.status === "ok" || data.lote.status === "confirmed" || data.lote.status === "nothing_to_translate") ? await deps.lectura.extras(e.loteId) : null;
  return clientView(e, files, data, extras, await sinJuradoDe(deps, e, e.loteId));
}

export async function enviarCodigo(deps: FlowDeps, e: EntradaRow): Promise<Outcome> {
  if (e.emailVerifiedAt) return { ok: true, view: await vistaEntrada(deps, e) };
  if (!e.email) return fail(422, "Falta el email.");
  const code = newCode();
  const patch = { codeHash: codeHashOf(e.id, code), codeExpiresAt: new Date(deps.now().getTime() + CODE_TTL_MS), codeAttempts: 0 };
  if (!(await deps.store.update(e.id, patch, ["abierta", "leida"]))) return fail(409, "Esta solicitud ya está enviada.");
  try {
    await deps.sendCode(e.email, code, e.lang);
  } catch {
    return fail(502, "No hemos podido enviarte el código. Prueba de nuevo en un minuto.");
  }
  return { ok: true, view: await vistaEntrada(deps, { ...e, ...patch }) };
}

export async function verificarCodigo(deps: FlowDeps, e: EntradaRow, code: string): Promise<Outcome> {
  if (e.emailVerifiedAt) return { ok: true, view: await vistaEntrada(deps, e) };
  if (!e.codeHash || !e.codeExpiresAt || e.codeExpiresAt.getTime() < deps.now().getTime()) return fail(410, "El código ha caducado. Pide otro.");
  if (!(await deps.store.takeAttempt(e.id, CODE_MAX_ATTEMPTS))) return fail(429, "Demasiados intentos. Pide un código nuevo.");
  if (!codeMatches(e.id, code, e.codeHash)) return fail(400, "El código no es correcto.");
  const patch = { emailVerifiedAt: deps.now(), codeHash: null, codeExpiresAt: null };
  await deps.store.update(e.id, patch, ["abierta", "leida"]);
  return { ok: true, view: await vistaEntrada(deps, { ...e, ...patch }) };
}

/** A reading of this entrada is running or waiting to retry. */
export async function readingInProgress(deps: FlowDeps, e: EntradaRow): Promise<{ fingerprint: string } | null> {
  if (!e.loteId) return null;
  const data = await deps.lectura.store.get(e.loteId);
  return data && (data.lote.status === "running" || data.lote.status === "busy") ? { fingerprint: data.lote.fingerprint } : null;
}

/** Fingerprint the current file set would read with (same formula as the lote). */
export async function currentFingerprint(deps: FlowDeps, e: EntradaRow): Promise<string> {
  const files = await deps.store.files(e.id);
  return fingerprintOf(files.map((f) => ({ name: f.name, url: f.url, mimeType: f.mimeType })), e.targetLang, e.sourceLang);
}

const READING_NOW = "Estamos revisando tus archivos: espera a que terminemos para añadir o quitar.";

export async function registrarArchivo(deps: FlowDeps, e: EntradaRow, f: { url: string; name: string; size: number; mimeType: string }): Promise<Outcome> {
  if (e.estado !== "abierta" && e.estado !== "leida") return fail(409, "Esta solicitud ya está enviada.");
  if (await readingInProgress(deps, e)) return fail(409, READING_NOW);
  const files = await deps.store.files(e.id);
  if (files.length >= MAX_ARCHIVOS) return fail(422, `Caben como mucho ${MAX_ARCHIVOS} archivos. Si tienes más, escríbenos y te ayudamos.`);
  let bytes: Uint8Array;
  try {
    bytes = await deps.download(f.url);
  } catch {
    return fail(422, "No hemos podido recibir ese archivo. Vuelve a subirlo.");
  }
  const hash = sha256(bytes);
  if (!files.some((x) => x.sha256 === hash)) {
    await deps.store.addFile(e, { url: f.url, name: f.name.slice(0, 255), mimeType: f.mimeType, size: bytes.length, sha256: hash });
    if (e.estado === "leida") await deps.store.update(e.id, { estado: "abierta" }, ["leida"]);
  }
  return { ok: true, view: await vistaEntrada(deps, (await deps.store.get(e.id)) ?? e) };
}

export async function quitarArchivo(deps: FlowDeps, e: EntradaRow, fileId: string): Promise<Outcome> {
  if (e.estado !== "abierta" && e.estado !== "leida") return fail(409, "Esta solicitud ya está enviada.");
  if (await readingInProgress(deps, e)) return fail(409, READING_NOW);
  if (!(await deps.store.removeFile(e.id, fileId))) return fail(404, "Ese archivo no está en tu solicitud.");
  if (e.estado === "leida") await deps.store.update(e.id, { estado: "abierta" }, ["leida"]);
  return { ok: true, view: await vistaEntrada(deps, (await deps.store.get(e.id)) ?? e) };
}

async function cerrarSinJurado(deps: FlowDeps, e: EntradaRow, casoId: string, lang: string): Promise<EntradaRow> {
  const closed: EntradaRow = { ...e, casoId, estado: "sin_jurado" };
  if (!(await deps.store.update(e.id, { estado: "sin_jurado" }, ["abierta", "leida"]))) return e;
  await deps.caso.evento(casoId, "sin_jurado", actorOf(e), { entradaId: e.id, idioma: lang });
  if (!joinedExisting(e)) await deps.caso.cerrarSinJurado(casoId, e.id);
  deps.notify({ kind: "sin_jurado", entrada: closed, casoRef: await deps.caso.ref(casoId), idioma: lang }).catch(console.error);
  return closed;
}

/** Every pair of the included documents lacks a sworn translator: the language that has none, else null. */
async function langWithoutJurado(deps: FlowDeps, pairs: [string, string][]): Promise<string | null> {
  const known = pairs.filter(([s, t]) => s && t && s !== "unknown" && t !== "unknown" && s !== t);
  if (known.length === 0 || known.length !== pairs.length) return null;
  for (const [s, t] of known) if ((await deps.hasJurado(s, t)) !== "no") return null;
  const [s, t] = known[0];
  return s === "es" ? t : s;
}

export async function leerEntrada(deps: FlowDeps, e: EntradaRow): Promise<Outcome> {
  if (e.estado === "confirmada" || e.estado === "sin_jurado") return { ok: true, view: await vistaEntrada(deps, e) };
  if (!e.emailVerifiedAt) return fail(403, "Confirma tu email con el código que te hemos enviado y revisamos tus archivos.");
  const files = await deps.store.files(e.id);
  if (files.length === 0) return fail(422, "Sube al menos un archivo.");
  const notReady = deps.lectura.ready();

  let casoId = e.casoId;
  let joined: Partial<EntradaRow> = {};
  if (!casoId) {
    const gate = await deps.gate({
      canal: e.canal, contacto: { email: e.email, phone: e.phone9, nombre: e.nombre }, hashes: files.map((f) => f.sha256), sizes: files.map((f) => f.size),
      ancla: sessionKeyOf(e.id), actor: actorOf(e), ahora: deps.now(),
    });
    casoId = gate.casoId;
    joined = { regla: gate.decision.regla, posibles: gate.decision.posibles, relacionados: gate.decision.relacionados };
    await deps.store.update(e.id, { casoId, ...joined }, ["abierta", "leida"]);
  }
  await deps.store.linkFilesToCaso(e.id, casoId);
  let cur: EntradaRow = { ...e, ...joined, casoId };

  if (cur.sourceLang && cur.targetLang) {
    const lang = await langWithoutJurado(deps, [[cur.sourceLang, cur.targetLang]]);
    if (lang) return { ok: true, view: await vistaEntrada(deps, await cerrarSinJurado(deps, cur, casoId, lang)) };
  }

  let loteId = await deps.lectura.reusable(casoId, files.map((f) => f.sha256));
  if (!loteId) {
    if (notReady) return fail(503, "Ahora mismo no podemos revisar los archivos. Inténtalo en unos minutos.", { retryAfterSec: 120 });
    const r = await deps.lectura.start(
      {
        source: { casoId, sessionKey: sessionKeyOf(e.id), quoteId: null },
        targetLang: cur.targetLang, sourceLang: cur.sourceLang, notes: cur.notas, reread: false, by: actorOf(e),
      },
      files,
    );
    if (r.kind === "no_files") return fail(422, "Sube al menos un archivo.");
    if (r.kind === "busy") {
      await deps.store.update(e.id, { loteId: r.loteId }, ["abierta", "leida"]);
      return fail(503, "Estamos revisando muchos documentos a la vez. Lo volvemos a intentar solos en un minuto.", { busy: true, retryAfterSec: 60, view: await vistaEntrada(deps, { ...cur, loteId: r.loteId }) });
    }
    if (r.kind === "in_progress") {
      if (r.loteId) await deps.store.update(e.id, { loteId: r.loteId }, ["abierta", "leida"]);
      return fail(202, "Seguimos revisando tus archivos.", { retryAfterSec: 10, view: await vistaEntrada(deps, { ...cur, loteId: r.loteId ?? cur.loteId }) });
    }
    loteId = r.loteId;
  }
  await deps.store.update(e.id, { loteId, estado: "leida" }, ["abierta", "leida"]);
  cur = { ...cur, loteId, estado: "leida" };

  const data = await deps.lectura.store.get(loteId);
  if (data && data.lote.status === "ok") {
    const target = data.lote.targetLang && data.lote.targetLang !== "unknown" ? data.lote.targetLang : cur.targetLang ?? "unknown";
    const included = data.documents.filter((d) => d.included);
    const lang = included.length ? await langWithoutJurado(deps, included.map((d) => [cur.sourceLang ?? d.sourceLang, target])) : null;
    if (lang) cur = await cerrarSinJurado(deps, cur, casoId, lang);
  }
  return { ok: true, view: await vistaEntrada(deps, cur) };
}

export type ClientEdit = { op: "exclude"; id: string; note?: string | null } | { op: "include"; id: string } | { op: "setTargetLang"; targetLang: string };

export async function editarEntrada(deps: FlowDeps, e: EntradaRow, edit: ClientEdit): Promise<Outcome> {
  if (e.estado !== "leida" || !e.loteId) return fail(409, "Ahora no se puede cambiar.");
  const data = await deps.lectura.store.get(e.loteId);
  if (!data || data.lote.status !== "ok") return fail(409, "Esta revisión ya no se puede cambiar.", { view: await vistaEntrada(deps, e) });
  const own = ownLote(e, data.lote);
  if (edit.op === "setTargetLang" && !own) {
    await deps.store.update(e.id, { targetLang: edit.targetLang }, ["leida"]);
    return { ok: true, view: await vistaEntrada(deps, { ...e, targetLang: edit.targetLang }) };
  }
  if (!own) return fail(409, "Juan revisa estos documentos contigo: cuéntanos en «Algo más» lo que no haga falta traducir.", { view: await vistaEntrada(deps, e) });
  if (edit.op === "setTargetLang") {
    if (!(await deps.lectura.store.setTargetLang(e.loteId, edit.targetLang))) return fail(409, "La revisión ha cambiado: recarga la página.");
    await deps.store.update(e.id, { targetLang: edit.targetLang }, ["leida"]);
    return { ok: true, view: await vistaEntrada(deps, { ...e, targetLang: edit.targetLang }) };
  }
  const reason = edit.op === "exclude" ? (edit.note?.trim() ? `${EXCLUDED_BY_CLIENT}: ${edit.note.trim()}` : EXCLUDED_BY_CLIENT) : "";
  const result = applyEdit(data.documents, edit.op === "exclude" ? { op: "exclude", id: edit.id, reason } : { op: "include", id: edit.id }, actorOf(e), deps.newId);
  if (!result.ok) return fail(422, result.error);
  if (!(await deps.lectura.store.replaceDocuments(e.loteId, result.documents))) return fail(409, "La revisión ha cambiado: recarga la página.");
  return { ok: true, view: await vistaEntrada(deps, e) };
}

export type Confirmacion = { urgency: "ASAP" | "DATE" | "FLEXIBLE"; neededBy: Date | null; organismo: string | null; notas: string | null; loteUpdatedAt: string | null };

export async function confirmarEntrada(deps: FlowDeps, e: EntradaRow, c: Confirmacion): Promise<Outcome> {
  if (e.estado === "confirmada") return { ok: true, view: await vistaEntrada(deps, e) };
  if (e.estado !== "leida" || !e.casoId) return fail(409, "Primero revisamos tus archivos.");
  const data = e.loteId ? await deps.lectura.store.get(e.loteId) : null;
  if (data && data.lote.status === "ok") {
    if (c.loteUpdatedAt && new Date(c.loteUpdatedAt).getTime() !== data.lote.updatedAt.getTime()) {
      return fail(409, "La revisión ha cambiado mientras la mirabas: repásala antes de enviarla.", { view: await vistaEntrada(deps, e) });
    }
    const target = data.lote.targetLang && data.lote.targetLang !== "unknown" ? data.lote.targetLang : e.targetLang;
    if (!target) return fail(422, "Dinos a qué idioma necesitas la traducción.", { view: await vistaEntrada(deps, e) });
  }
  const now = deps.now();
  const patch = { estado: "confirmada" as const, confirmedAt: now, urgency: c.urgency, neededBy: c.neededBy, organismo: c.organismo, notas: c.notas };
  if (!(await deps.store.update(e.id, patch, ["leida"]))) return fail(409, "Esta solicitud ha cambiado: recarga la página.");
  const done: EntradaRow = { ...e, ...patch };
  const documentos = data?.documents.filter((d) => d.included).length ?? 0;
  const excluidos = data?.documents.filter((d) => !d.included).map((d) => ({ id: d.id, motivo: d.excludedReason })) ?? [];
  if (!joinedExisting(e)) await deps.caso.plazo(e.casoId, c.urgency, c.neededBy);
  await deps.caso.evento(e.casoId, "entrada_confirmada", actorOf(e), {
    entradaId: e.id, loteId: e.loteId, documentos, excluidos, urgency: c.urgency, neededBy: c.neededBy?.toISOString() ?? null, organismo: c.organismo, notas: c.notas,
  });
  deps.notify({ kind: "confirmada", entrada: done, casoRef: await deps.caso.ref(e.casoId), documentos }).catch(console.error);
  return { ok: true, view: await vistaEntrada(deps, done) };
}
