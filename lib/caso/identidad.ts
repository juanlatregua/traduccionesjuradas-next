// lib/caso/identidad.ts — UNA definición de cliente para el caso (lógica PURA).
// Claves: "e:<email real normalizado>" y "p:<9 últimos dígitos>". El marcador
// <dígitos>@whatsapp.local no es email: aporta su teléfono. Los buzones propios
// no identifican a nadie. Alias = grupos de CLIENTE_IDENTIDADES_ALIAS (lo que
// declara Juan). Nunca se casa por nombre.

import { phoneKey, realEmailKey, isPlaceholderEmailKey, parseIdentityGroups } from "../client-identity.ts";
import { isRealEmail } from "../cierre-math.ts";
import { isOwnAddress } from "../respuesta-guard.ts";

export type IdKey = `e:${string}` | `p:${string}`;
export type Identidad = {
  email: string | null;
  phone9: string | null;
  keys: IdKey[]; // propias + las de su grupo de alias
  aliasKeys: IdKey[]; // las que vienen de (o están en) un grupo de alias
  primaria: IdKey | null;
};
export type Fuerza = "fuerte" | "telefono" | "posible" | "ninguna";

/** Más emails reales que esto en un mismo teléfono = intermediario (Ahmed, un despacho). */
export const MAX_EMAILS_POR_TELEFONO = 3;

export function emailReal(email: string | null | undefined, propios: (string | null | undefined)[] = []): string | null {
  const e = realEmailKey(email);
  if (!e || !isRealEmail(e) || isOwnAddress(e, propios)) return null;
  return e;
}

export function telefono9(phone: string | null | undefined, email?: string | null): string | null {
  const p = phoneKey(phone);
  if (p) return p;
  if (isPlaceholderEmailKey(email)) return phoneKey(String(email).trim().split("@")[0]) || null;
  return null;
}

/** Clave canónica sin prefijo (como las de client-identity) → IdKey. */
function aIdKey(raw: string): IdKey | null {
  if (!raw) return null;
  if (raw.includes("@")) {
    if (isPlaceholderEmailKey(raw)) {
      const p = phoneKey(raw.split("@")[0]);
      return p ? `p:${p}` : null;
    }
    return `e:${raw}`;
  }
  return `p:${raw}`;
}

export function aliasDesdeEnv(raw: string | null | undefined = process.env.CLIENTE_IDENTIDADES_ALIAS): string[][] {
  return parseIdentityGroups(raw);
}

export function identidadDe(
  i: { email?: string | null; phone?: string | null },
  opts: { alias?: string[][]; telefonosVetados?: Set<string>; propios?: (string | null | undefined)[] } = {}
): Identidad {
  const email = emailReal(i.email, opts.propios);
  const phone9 = telefono9(i.phone, i.email);
  const propias: IdKey[] = [];
  if (email) propias.push(`e:${email}`);
  if (phone9 && !opts.telefonosVetados?.has(phone9)) propias.push(`p:${phone9}`);

  const keys = new Set<IdKey>(propias);
  const aliasKeys = new Set<IdKey>();
  for (const grupo of opts.alias || []) {
    const g = grupo.map(aIdKey).filter((k): k is IdKey => Boolean(k));
    if (g.some((k) => keys.has(k) || (phone9 && k === `p:${phone9}`))) {
      for (const k of g) {
        keys.add(k);
        aliasKeys.add(k);
      }
    }
  }
  return { email, phone9, keys: [...keys], aliasKeys: [...aliasKeys], primaria: propias[0] ?? null };
}

/**
 * fuerte: comparten email (o grupo de alias). telefono: solo el teléfono y como
 * mucho uno tiene email real (WhatsApp → luego web). posible: mismo teléfono con
 * emails reales distintos → se avisa, nunca se une.
 */
export function compararIdentidad(a: Identidad, b: Identidad): Fuerza {
  const bk = new Set(b.keys);
  const comunes = a.keys.filter((k) => bk.has(k));
  if (comunes.length === 0) return "ninguna";
  if (comunes.some((k) => k.startsWith("e:"))) return "fuerte";
  const alias = new Set([...a.aliasKeys, ...b.aliasKeys]);
  if (comunes.some((k) => alias.has(k))) return "fuerte";
  if (a.email && b.email && a.email !== b.email) return "posible";
  return "telefono";
}

/** Teléfonos que no unen a nadie: muchos emails, o 2+ emails con 2+ nombres (regla de vigia-persona). */
export function telefonosIntermediario(filas: { email?: string | null; phone?: string | null; nombre?: string | null }[]): Set<string> {
  const emails = new Map<string, Set<string>>();
  const nombres = new Map<string, Set<string>>();
  for (const f of filas) {
    const p = telefono9(f.phone, f.email);
    const e = emailReal(f.email);
    if (!p || !e) continue;
    const es = emails.get(p) || new Set<string>();
    es.add(e);
    emails.set(p, es);
    const n = String(f.nombre || "").trim().toLowerCase();
    if (n) {
      const ns = nombres.get(p) || new Set<string>();
      ns.add(n);
      nombres.set(p, ns);
    }
  }
  const out = new Set<string>();
  for (const [p, es] of emails) {
    if (es.size > MAX_EMAILS_POR_TELEFONO || (es.size >= 2 && (nombres.get(p)?.size || 0) >= 2)) out.add(p);
  }
  return out;
}

/** Cliente con encargos en paralelo, solo por su ficha (holderNames describe documentos, no titulares). */
export function esAgencia(c: { isBusiness?: boolean | null; creditEnabled?: boolean | null; billingCycle?: string | null }): boolean {
  return Boolean(c.isBusiness || c.creditEnabled || c.billingCycle === "MONTHLY");
}

export function identityKeyDe(id: Identidad, ancla: string): string {
  return id.primaria ?? `anon:${ancla}`;
}
