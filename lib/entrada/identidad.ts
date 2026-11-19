// Puerta de identidad única (lógica PURA): antes de crear nada, ¿esta entrada es de un caso vivo?
//  1. huella  — comparte un archivo (sha256) con un caso → ese caso.
//  2. contacto — email o teléfono conocido (lib/client-identity + alias + veto de intermediarios) con caso ABIERTO en 14 días.
//  3. dudoso  — nombre parecido, o mismo teléfono con otro email: caso NUEVO marcado «¿mismo cliente que…?». Nunca une.
import { compararIdentidad, type Identidad } from "../caso/identidad.ts";

export const CANALES = ["web", "email", "whatsapp", "constructor"] as const;
export type Canal = (typeof CANALES)[number];

export const VENTANA_CONTACTO_DIAS = 14;
export const VENTANA_HUELLA_DIAS = 60;
const DAY = 864e5;

export type CasoVisto = {
  id: string;
  estado: string;
  identidad: Identidad;
  nombre: string | null;
  esAgencia: boolean;
  lastActivityAt: Date;
  hashes: string[];
  /** Has an order (paid or on credit) or a request already accepted by a sworn translator. */
  conPedido: boolean;
};

export type SenalEntrada = { identidad: Identidad; nombre: string | null; hashes: string[]; ahora: Date };

export type ReglaEntrada = "huella" | "contacto" | "agencia" | "dudoso" | "relacionado" | "nuevo";
export type DecisionEntrada = {
  accion: "unir" | "crear";
  casoId?: string;
  regla: ReglaEntrada;
  dudoso: boolean;
  /** «¿Mismo cliente que…?»: never joined. */
  posibles: string[];
  /** Same file in a caso that is already ordered, delivered or closed: the new caso points to it. */
  relacionados: string[];
};

const PARTICULAS = new Set(["de", "del", "la", "las", "los", "da", "das", "do", "dos", "van", "von", "der", "den", "el", "y", "e"]);

export function nameTokens(n: string | null | undefined): string[] {
  return String(n || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((t) => t.length >= 3 && !PARTICULAS.has(t));
}

/** Dos apellidos/nombres en común, o uno cuando uno de los dos solo trae una palabra. */
export function nombreParecido(a: string | null | undefined, b: string | null | undefined): boolean {
  const A = [...new Set(nameTokens(a))];
  const B = new Set(nameTokens(b));
  if (A.length === 0 || B.size === 0) return false;
  const comunes = A.filter((t) => B.has(t)).length;
  return comunes >= 2 || (comunes >= 1 && (A.length === 1 || B.size === 1));
}

const reciente = (a: CasoVisto, b: CasoVisto) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
const uniq = (xs: string[]) => [...new Set(xs)];

export function decidirEntrada(s: SenalEntrada, casos: CasoVisto[]): DecisionEntrada {
  const edad = (c: CasoVisto) => s.ahora.getTime() - c.lastActivityAt.getTime();
  const hs = new Set(s.hashes);

  const porHuella = casos.filter((c) => c.hashes.some((h) => hs.has(h))).sort(reciente);
  const unible = (c: CasoVisto) => !c.conPedido && (c.estado === "ABIERTO" || (c.estado === "PERDIDO" && edad(c) <= VENTANA_HUELLA_DIAS * DAY));
  const elegido = porHuella.find((c) => unible(c) && c.estado === "ABIERTO") ?? porHuella.find(unible);
  const relacionados = porHuella.filter((c) => !unible(c)).map((c) => c.id);
  if (elegido) {
    return { accion: "unir", casoId: elegido.id, regla: "huella", dudoso: false, posibles: porHuella.filter((c) => c !== elegido && unible(c)).map((c) => c.id), relacionados };
  }

  const vivos = casos.filter((c) => c.estado === "ABIERTO" && !c.conPedido && edad(c) <= VENTANA_CONTACTO_DIAS * DAY);
  const fuerzas = vivos.map((c) => ({ c, f: s.identidad.keys.length ? compararIdentidad(s.identidad, c.identidad) : "ninguna" }));
  const mismo = fuerzas.filter(({ f }) => f === "fuerte").map(({ c }) => c).sort(reciente);
  if (mismo.length > 0) {
    if (mismo[0].esAgencia) return { accion: "crear", regla: "agencia", dudoso: false, posibles: mismo.map((c) => c.id), relacionados };
    return { accion: "unir", casoId: mismo[0].id, regla: "contacto", dudoso: false, posibles: mismo.slice(1).map((c) => c.id), relacionados };
  }

  const dudas = fuerzas
    .filter(({ c, f }) => f === "telefono" || f === "posible" || (f === "ninguna" && nombreParecido(s.nombre, c.nombre)))
    .map(({ c }) => c.id);
  if (dudas.length > 0) return { accion: "crear", regla: "dudoso", dudoso: true, posibles: uniq(dudas), relacionados };
  return { accion: "crear", regla: relacionados.length ? "relacionado" : "nuevo", dudoso: false, posibles: [], relacionados };
}
