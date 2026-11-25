import { createHash } from "node:crypto";
import { startReading, type StartDeps } from "../../../lib/lectura-constructor/run.ts";
import type { Reading, SourceFile } from "../../../lib/lectura/index.ts";
import type { FlowDeps, Jurado, Aviso } from "../../../lib/entrada/flow.ts";
import { resolverEntrada, type CasoFila, type GateDeps, type GateTx } from "../../../lib/entrada/puerta.ts";
import { sessionKeyOf, type ArchivoRow, type EntradaRow, type EntradaStore } from "../../../lib/entrada/store.ts";
import type { ReadingExtras } from "../../../lib/entrada/view.ts";
import { memoryStore } from "../lectura-constructor/fakes.ts";

export const AHORA = new Date("2026-11-19T10:00:00Z");
export const hace = (dias: number) => new Date(AHORA.getTime() - dias * 864e5);
export const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export const bytesOf = (s: string) => new TextEncoder().encode(s);

export type Caso = CasoFila & { origen: string; dudoso: boolean };
export type Doc = { id: string; casoId: string | null; session: string | null; url: string; name: string; size: number; hash: string | null; mimeType: string; pages?: number | null; sourceLang?: string; targetLang?: string };

/** One in-memory «database» shared by the gate, the entradas and the lectura store. */
export function world(blobs: Record<string, Uint8Array> = {}) {
  const casos: Caso[] = [];
  const eventos: { casoId: string; tipo: string; payload: Record<string, unknown> }[] = [];
  const docs: Doc[] = [];
  const entradas: (EntradaRow & { tokenHash: string })[] = [];
  const lectura = memoryStore();
  const locks: string[][] = [];
  const downloads: string[] = [];
  const reads: string[][] = [];
  const avisos: Aviso[] = [];
  const quotesCreated: string[] = [];
  const codes: { to: string; code: string; lang: string | null; link: string }[] = [];
  /** Casos with something else alive (old puerta files, inbound messages, quotes): never closed as SIN_JURADO. */
  const otrosVivos = new Set<string>();
  let seq = 0;

  const loteHashes = (casoId: string) =>
    [...lectura.rows.values()].filter((e) => e.lote.casoId === casoId).flatMap((e) => e.files.map((f) => f.sha256).filter((h): h is string => !!h));
  const hashesOf = (casoId: string) => [...new Set([...docs.filter((d) => d.casoId === casoId && d.hash).map((d) => d.hash!), ...loteHashes(casoId)])];

  const tx: GateTx = {
    async lock(keys) {
      locks.push(keys);
    },
    async vecinosTelefono(phone9) {
      return casos.filter((c) => c.phone9 === phone9).map((c) => ({ email: c.email, phone9: c.phone9, nombre: c.nombre }));
    },
    async candidatos(q) {
      const hs = new Set(q.hashes);
      return casos
        .filter(
          (c) =>
            q.ids.includes(c.id) ||
            hashesOf(c.id).some((h) => hs.has(h)) ||
            ((c.estado === "ABIERTO" || c.estado === "PERDIDO") && c.lastActivityAt >= q.vivosDesde && ((c.email && q.emails.includes(c.email)) || (c.phone9 && q.phones.includes(c.phone9)) || c.nombre)),
        )
        .map((c) => ({ ...c, hashes: hashesOf(c.id) }));
    },
    async crear(d) {
      const id = `caso-${++seq}`;
      casos.push({ id, ref: `CASO-${seq}`, estado: "ABIERTO", email: d.email, phone9: d.phone9, nombre: d.nombre, esAgencia: false, lastActivityAt: d.ahora, hashes: [], conPedido: false, origen: d.origen, dudoso: d.dudoso });
      return { id, ref: `CASO-${seq}` };
    },
    async unir(id, p) {
      const c = casos.find((x) => x.id === id)!;
      c.lastActivityAt = p.ahora;
      if (p.reabrir) c.estado = "ABIERTO";
    },
    async evento(casoId, tipo, _actor, payload) {
      eventos.push({ casoId, tipo, payload });
    },
  };

  const download = async (url: string) => {
    downloads.push(url);
    const b = blobs[url];
    if (!b) throw new Error("404");
    return b;
  };

  const gateDeps: GateDeps = {
    alias: [],
    propios: [],
    sinHuella: async (q) => docs.filter((d) => d.hash === null && d.casoId && (q.sizes.includes(d.size) || d.size === 0)).slice(0, q.limit).map((d) => ({ casoId: d.casoId!, url: d.url })),
    download,
    run: (fn) => fn(tx),
  };

  const store: EntradaStore = {
    async create(data) {
      const e = { ...data, id: `ent-${++seq}`, estado: "abierta" as const, casoId: null, loteId: null, regla: null, posibles: [], relacionados: [], pais: null, respuestas: null, codeHash: null, linkHash: null, codeExpiresAt: null, codeAttempts: 0, urgency: null, neededBy: null, organismo: null, notas: null, confirmedAt: null, createdAt: AHORA, updatedAt: AHORA };
      entradas.push(e);
      return { ...e };
    },
    async byTokenHash(h) {
      const e = entradas.find((x) => x.tokenHash === h);
      return e ? { ...e } : null;
    },
    async byLinkHash(h) {
      const e = entradas.find((x) => x.linkHash === h);
      return e ? { ...e } : null;
    },
    async linkContactToFiles() {},
    async get(id) {
      const e = entradas.find((x) => x.id === id);
      return e ? { ...e } : null;
    },
    async files(id) {
      return docs.filter((d) => d.session === sessionKeyOf(id) && d.hash).map((d): ArchivoRow => ({ id: d.id, name: d.name, url: d.url, mimeType: d.mimeType, size: d.size, sha256: d.hash!, pages: d.pages ?? null }));
    },
    async addFile(e, f) {
      const id = `doc-${++seq}`;
      docs.push({ id, casoId: e.casoId, session: sessionKeyOf(e.id), url: f.url, name: f.name, size: f.size, hash: f.sha256, mimeType: f.mimeType, pages: f.pages });
      return { id, ...f };
    },
    async removeFile(eid, fid) {
      const i = docs.findIndex((d) => d.id === fid && d.session === sessionKeyOf(eid));
      if (i < 0) return false;
      docs.splice(i, 1);
      return true;
    },
    async update(id, patch, onlyIn) {
      const e = entradas.find((x) => x.id === id);
      if (!e || !onlyIn.includes(e.estado)) return false;
      Object.assign(e, patch);
      return true;
    },
    async takeAttempt(id, max) {
      const e = entradas.find((x) => x.id === id)!;
      if (e.codeAttempts >= max) return false;
      e.codeAttempts += 1;
      return true;
    },
    async syncFilesLang(id, s, t) {
      for (const d of docs.filter((x) => x.session === sessionKeyOf(id))) Object.assign(d, { ...(s ? { sourceLang: s } : {}), ...(t ? { targetLang: t } : {}) });
    },
    async linkFilesToCaso(id, casoId) {
      for (const d of docs) if (d.session === sessionKeyOf(id) && !d.casoId) d.casoId = casoId;
    },
  };

  return { casos, eventos, docs, entradas, lectura, locks, downloads, reads, avisos, quotesCreated, codes, otrosVivos, gateDeps, store, download };
}

export type World = ReturnType<typeof world>;

export function flowDeps(w: World, opts: { read?: (files: SourceFile[], attempt: number) => Reading; jurado?: (s: string, t: string) => Jurado; extras?: ReadingExtras } = {}): FlowDeps {
  let ids = 0;
  return {
    store: w.store,
    gate: (input) => resolverEntrada(w.gateDeps, input),
    download: w.download,
    lectura: {
      ready: () => null,
      store: w.lectura.store,
      start: (input, files) => {
        const deps: StartDeps = {
          store: w.lectura.store,
          listFiles: async () => files.map((f) => ({ name: f.name, url: f.url, mimeType: f.mimeType })),
          download: (ref) => w.download(ref.url),
          read: async (fs, _ctx, { attempt }) => {
            w.reads.push(fs.map((f) => f.name));
            if (!opts.read) throw new Error("no read script");
            return opts.read(fs, attempt);
          },
          now: () => new Date(),
          newId: () => `w${++ids}`,
        };
        return startReading(deps, input);
      },
      extras: async () => opts.extras ?? { notToTranslate: [], duplicates: [], questions: [], missing: {} },
      reusable: async (casoId, hashes) => {
        const want = new Set(hashes);
        for (const e of [...w.lectura.rows.values()].reverse()) {
          if (e.lote.casoId !== casoId || !["ok", "confirmed"].includes(e.lote.status)) continue;
          const have = new Set(e.files.filter((f) => f.state === "ok" || f.state === "duplicate").map((f) => f.sha256));
          if (have.size === want.size && [...want].every((h) => have.has(h))) return e.lote.id;
        }
        return null;
      },
    },
    hasJurado: async (s, t) => (opts.jurado ? opts.jurado(s, t) : "si"),
    caso: {
      ref: async (id) => w.casos.find((c) => c.id === id)?.ref ?? null,
      evento: async (casoId, tipo, _a, payload) => {
        w.eventos.push({ casoId, tipo, payload });
      },
      plazo: async () => {},
      cerrarSinJurado: async (casoId, entradaId) => {
        const alive = w.otrosVivos.has(casoId) || w.docs.some((d) => d.casoId === casoId && d.session !== `entrada:${entradaId}`) || w.entradas.some((e) => e.casoId === casoId && e.id !== entradaId);
        if (alive) return false;
        const c = w.casos.find((x) => x.id === casoId)!;
        c.estado = "SIN_JURADO";
        return true;
      },
    },
    notify: async (a) => {
      w.avisos.push(a);
    },
    sendCode: async (to, code, lang, link) => {
      w.codes.push({ to, code, lang, link });
    },
    now: () => AHORA,
    newId: () => `n${++ids}`,
  };
}
