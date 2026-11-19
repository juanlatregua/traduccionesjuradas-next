// La puerta de identidad con su acceso a datos inyectado: la usan la web (R2a) y la bandeja email/WhatsApp (R2b).
// La huella la calcula SIEMPRE este módulo sobre los bytes; nunca se fía de un fileHash ajeno.
// Archivos viejos sin huella (NULL) de casos recientes: se calculan bajo demanda, acotados y sin escribirla.
import { createHash } from "node:crypto";
import { identidadDe, identityKeyDe, telefonosIntermediario, type Identidad } from "../caso/identidad.ts";
import { decidirEntrada, VENTANA_CONTACTO_DIAS, VENTANA_HUELLA_DIAS, type Canal, type DecisionEntrada } from "./identidad.ts";

export const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Máximo de archivos viejos sin huella que se descargan para comparar en una sola entrada. */
export const MAX_HUELLAS_BAJO_DEMANDA = 25;
const DAY = 864e5;

export type Contacto = { email?: string | null; phone?: string | null; nombre?: string | null };

export type CasoFila = {
  id: string;
  ref: string;
  estado: string;
  email: string | null;
  phone9: string | null;
  nombre: string | null;
  esAgencia: boolean;
  lastActivityAt: Date;
  hashes: string[];
};

export type Busqueda = { hashes: string[]; emails: string[]; phones: string[]; vivosDesde: Date; ids: string[] };

export type GateTx = {
  lock(keys: string[]): Promise<void>;
  vecinosTelefono(phone9: string): Promise<{ email: string | null; phone9: string | null; nombre: string | null }[]>;
  /** Casos que comparten huella + casos ABIERTOS desde `vivosDesde` (por contacto o con nombre) + `ids`. */
  candidatos(q: Busqueda): Promise<CasoFila[]>;
  crear(data: { identityKey: string; email: string | null; phone9: string | null; nombre: string | null; origen: string; dudoso: boolean; actor: string; ahora: Date }): Promise<{ id: string; ref: string }>;
  unir(id: string, patch: { email?: string; phone9?: string; reabrir: boolean; ahora: Date }): Promise<void>;
  evento(casoId: string, tipo: string, actor: string, payload: Record<string, unknown>): Promise<void>;
};

export type GateDeps = {
  alias: string[][];
  propios: (string | null | undefined)[];
  /** Archivos de casos recientes cuya huella no está guardada (DocumentAnalysis.fileHash NULL, adjuntos de WhatsApp…). */
  sinHuella(q: { sizes: number[]; desde: Date; limit: number }): Promise<{ casoId: string; url: string }[]>;
  download(url: string): Promise<Uint8Array>;
  run<T>(fn: (tx: GateTx) => Promise<T>): Promise<T>;
};

export type GateInput = {
  canal: Canal;
  contacto: Contacto;
  /** Huellas calculadas por este módulo sobre los bytes recibidos. */
  hashes: string[];
  sizes: number[];
  ancla: string;
  actor: string;
  ahora: Date;
};

export type GateResult = { casoId: string; ref: string; creado: boolean; decision: DecisionEntrada };

export function clavesLock(identidad: Identidad, hashes: string[]): string[] {
  return [...new Set([...identidad.keys, ...hashes.map((h) => `h:${h}`)])].sort();
}

async function huellasBajoDemanda(deps: GateDeps, input: GateInput): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (input.hashes.length === 0) return out;
  const wanted = new Set(input.hashes);
  const filas = await deps.sinHuella({ sizes: input.sizes, desde: new Date(input.ahora.getTime() - VENTANA_HUELLA_DIAS * DAY), limit: MAX_HUELLAS_BAJO_DEMANDA });
  for (const f of filas.slice(0, MAX_HUELLAS_BAJO_DEMANDA)) {
    let h: string;
    try {
      h = sha256(await deps.download(f.url));
    } catch {
      continue;
    }
    if (wanted.has(h)) out.set(f.casoId, [...(out.get(f.casoId) ?? []), h]);
  }
  return out;
}

export async function resolverEntrada(deps: GateDeps, input: GateInput): Promise<GateResult> {
  const hashes = [...new Set(input.hashes)];
  const extra = await huellasBajoDemanda(deps, { ...input, hashes });
  return deps.run(async (tx) => {
    const base = identidadDe(input.contacto, { alias: deps.alias, propios: deps.propios });
    await tx.lock(clavesLock(base, hashes));
    const vecinos = base.phone9 ? await tx.vecinosTelefono(base.phone9) : [];
    const vetados = telefonosIntermediario([
      ...vecinos.map((v) => ({ email: v.email, phone: v.phone9, nombre: v.nombre })),
      { email: input.contacto.email, phone: input.contacto.phone, nombre: input.contacto.nombre },
    ]);
    const identidad = identidadDe(input.contacto, { alias: deps.alias, propios: deps.propios, telefonosVetados: vetados });
    const filas = await tx.candidatos({
      hashes,
      emails: identidad.keys.filter((k) => k.startsWith("e:")).map((k) => k.slice(2)),
      phones: identidad.keys.filter((k) => k.startsWith("p:")).map((k) => k.slice(2)),
      vivosDesde: new Date(input.ahora.getTime() - VENTANA_CONTACTO_DIAS * DAY),
      ids: [...extra.keys()],
    });
    const casos = filas.map((f) => ({
      ...f,
      hashes: [...f.hashes, ...(extra.get(f.id) ?? [])],
      identidad: identidadDe({ email: f.email, phone: f.phone9 }, { alias: deps.alias, propios: deps.propios, telefonosVetados: vetados }),
    }));
    const nombre = input.contacto.nombre?.trim() || null;
    const decision = decidirEntrada({ identidad, nombre, hashes, ahora: input.ahora }, casos);
    const payload = { entrada: input.canal, ancla: input.ancla, regla: decision.regla };

    if (decision.accion === "unir" && decision.casoId) {
      const caso = casos.find((c) => c.id === decision.casoId)!;
      await tx.unir(caso.id, {
        ...(!caso.email && identidad.email ? { email: identidad.email } : {}),
        ...(!caso.phone9 && identidad.phone9 ? { phone9: identidad.phone9 } : {}),
        reabrir: caso.estado === "PERDIDO",
        ahora: input.ahora,
      });
      await tx.evento(caso.id, "adjuntado", input.actor, { ...payload, yaEncargado: decision.yaEncargado });
      if (decision.posibles.length) await tx.evento(caso.id, "posible", input.actor, { con: decision.posibles, regla: decision.regla });
      return { casoId: caso.id, ref: caso.ref, creado: false, decision };
    }

    const caso = await tx.crear({
      identityKey: identityKeyDe(identidad, input.ancla),
      email: identidad.email,
      phone9: identidad.phone9,
      nombre,
      origen: `entrada:${input.canal}`,
      dudoso: decision.dudoso,
      actor: input.actor,
      ahora: input.ahora,
    });
    await tx.evento(caso.id, "creado", input.actor, { ...payload, posibles: decision.posibles });
    if (decision.posibles.length) await tx.evento(caso.id, "posible", input.actor, { con: decision.posibles, regla: decision.regla });
    return { casoId: caso.id, ref: caso.ref, creado: true, decision };
  });
}
