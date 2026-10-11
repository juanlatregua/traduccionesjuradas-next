// lib/caso/resolver.ts — Decisión PURA: dada una señal (alguien pide algo) y los
// casos candidatos, ¿se adjunta a uno, se crea otro o es dudoso? El acceso a BD
// (candidatos, lock, escritura) vive en lib/caso/resolver-db.ts.
//
// Orden (la primera regla que aplica):
//  1. ancla      — la señal ya apunta a un caso (presupuesto, solicitud, pedido, sesión…).
//  2. documento  — mismo documento y par compatible en un caso ABIERTO (o encargado hace ≤60 d).
//  3. identidad  — mismo cliente y par en un caso ABIERTO reciente, SOLO si la señal no trae
//                  documentos. Con documentos distintos → caso NUEVO con «posible» enlazado.
//  4. posible    — mismo teléfono con emails reales distintos: caso nuevo, aviso, nunca unir.
//  5. nuevo.

import { compararIdentidad, type Identidad } from "./identidad.ts";
import type { CasoEstado } from "./estados.ts";

export const VENTANA_IDENTIDAD_DIAS = 30;
export const VENTANA_ENCARGADO_DIAS = 60;
const DAY = 864e5;

export type Docs = { hashes: string[]; contentKeys: string[] };

export type Senal = {
  entrada: string;
  identidad: Identidad;
  pares: string[];
  docs: Docs;
  esAgencia?: boolean;
  ahora: Date;
};

export type CasoCandidato = {
  id: string;
  estado: CasoEstado;
  identidad: Identidad;
  pares: string[];
  docs: Docs;
  esAgencia: boolean;
  lastActivityAt: Date;
  porAncla: boolean;
};

export type Regla =
  | "ancla"
  | "ancla_conflicto"
  | "mismo_documento"
  | "identidad"
  | "documento_distinto"
  | "agencia"
  | "varios"
  | "posible"
  | "sin_identidad"
  | "nuevo";

export type Decision = {
  accion: "adjuntar" | "crear" | "dudoso"; // dudoso = caso propio marcado para revisar, nunca fusionar
  casoId?: string;
  regla: Regla;
  posibles: string[]; // casos «puede ser el mismo»: solo aviso
  yaEncargado?: boolean; // adjunta a un caso con pedido (¿segunda copia?)
};

/** "it->es" | "it-es" | "it>es" → "IT>ES"; desconocido → "". */
export function normPar(par: string | null | undefined): string {
  const raw = String(par || "").trim().toUpperCase();
  const [s, t] = raw.includes(">") ? raw.split(/->|>/) : raw.split("-");
  if (!s || !t || s === "?" || t === "?") return "";
  return `${s}>${t}`;
}

/** Vacío o desconocido en cualquiera de los lados casa con todo; ES>X ≠ X>ES. */
export function paresCompatibles(a: string[], b: string[]): boolean {
  const x = a.map(normPar).filter(Boolean);
  const y = new Set(b.map(normPar).filter(Boolean));
  if (x.length === 0 || y.size === 0) return true;
  return x.some((p) => y.has(p));
}

export function tieneDocs(d: Docs): boolean {
  return d.hashes.length > 0 || d.contentKeys.length > 0;
}

export function compartenDocumento(a: Docs, b: Docs): boolean {
  const h = new Set(b.hashes);
  const k = new Set(b.contentKeys);
  return a.hashes.some((x) => h.has(x)) || a.contentKeys.some((x) => k.has(x));
}

const masReciente = (a: CasoCandidato, b: CasoCandidato) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
const uniq = (xs: string[]) => [...new Set(xs)];

export function decidirCaso(s: Senal, candidatos: CasoCandidato[]): Decision {
  const ahora = s.ahora.getTime();
  const posibles: string[] = [];

  const anclados = candidatos.filter((c) => c.porAncla);
  if (anclados.length === 1) return { accion: "adjuntar", casoId: anclados[0].id, regla: "ancla", posibles: [] };
  if (anclados.length > 1) return { accion: "dudoso", regla: "ancla_conflicto", posibles: anclados.map((c) => c.id) };

  if (tieneDocs(s.docs)) {
    const mismos = candidatos.filter((c) => compartenDocumento(s.docs, c.docs) && paresCompatibles(s.pares, c.pares)).sort(masReciente);
    const abierto = mismos.find((c) => c.estado === "ABIERTO");
    if (abierto) return { accion: "adjuntar", casoId: abierto.id, regla: "mismo_documento", posibles: uniq(mismos.filter((c) => c !== abierto).map((c) => c.id)) };
    const encargado = mismos.find(
      (c) => (c.estado === "EN_CURSO" || c.estado === "ENTREGADO") && ahora - c.lastActivityAt.getTime() <= VENTANA_ENCARGADO_DIAS * DAY
    );
    if (encargado) return { accion: "adjuntar", casoId: encargado.id, regla: "mismo_documento", posibles: [], yaEncargado: true };
    posibles.push(...mismos.map((c) => c.id));
  }

  if (s.identidad.keys.length === 0) return { accion: "crear", regla: "sin_identidad", posibles: uniq(posibles) };

  const fuerzas = candidatos.map((c) => ({ c, f: compararIdentidad(s.identidad, c.identidad) }));
  const mismoCliente = fuerzas
    .filter(
      ({ c, f }) =>
        (f === "fuerte" || f === "telefono") &&
        c.estado === "ABIERTO" &&
        paresCompatibles(s.pares, c.pares) &&
        ahora - c.lastActivityAt.getTime() <= VENTANA_IDENTIDAD_DIAS * DAY
    )
    .map(({ c }) => c)
    .sort(masReciente);
  const soloPosible = fuerzas.filter(({ f }) => f === "posible").map(({ c }) => c.id);

  if (mismoCliente.length > 0) {
    const ids = mismoCliente.map((c) => c.id);
    if (tieneDocs(s.docs)) return { accion: "crear", regla: "documento_distinto", posibles: uniq([...posibles, ...ids]) };
    if (s.esAgencia || mismoCliente.some((c) => c.esAgencia)) return { accion: "dudoso", regla: "agencia", posibles: uniq([...posibles, ...ids]) };
    if (mismoCliente.length > 1) return { accion: "dudoso", regla: "varios", posibles: uniq([...posibles, ...ids]) };
    return { accion: "adjuntar", casoId: mismoCliente[0].id, regla: "identidad", posibles: uniq(posibles) };
  }

  if (soloPosible.length > 0) return { accion: "crear", regla: "posible", posibles: uniq([...posibles, ...soloPosible]) };
  return { accion: "crear", regla: "nuevo", posibles: uniq(posibles) };
}
