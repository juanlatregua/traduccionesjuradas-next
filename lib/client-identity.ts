// lib/client-identity.ts — La misma persona con varios correos sigue siendo una.
//
// El problema (19-sep-2026): el guardia que impide abrir dos solicitudes por el
// mismo trabajo cruza por email o teléfono. Walid entró con walidvanrijszen@,
// luego con walidwalidhlali222@ + 658404151, y el guardia no vio ninguna
// hermana porque para el sistema eran dos clientes. Acabó con tres encargos
// abiertos en lavori y dos presupuestos enviados a precios distintos.
//
// Esto no adivina nada: las agrupaciones las declara Juan cuando detecta el
// caso. Adivinar que dos correos son la misma persona sería peor que el
// problema — enseñaría el presupuesto de alguien a otro.
//
// Formato (env CLIENTE_IDENTIDADES_ALIAS): grupos separados por ";", miembros
// por ",". Da igual mezclar correos y teléfonos.
//
//   CLIENTE_IDENTIDADES_ALIAS="a@x.com,b@y.com,600111222;otro@z.com,611000999"
//
// Va en env y no en base de datos a propósito: son excepciones contadas, se
// cambian sin desplegar y quedan a la vista de quien mira la configuración.

/** Teléfono → sus 9 últimos dígitos (así casan +34 600…, 0034600…, 600…). */
export function phoneKey(phone: string | null | undefined): string {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

export function emailKey(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

/** Clave canónica de cualquier identidad suelta (correo o teléfono). */
export function identityKey(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw.includes("@") ? emailKey(raw) : phoneKey(raw);
}

export function parseIdentityGroups(raw: string | null | undefined): string[][] {
  return String(raw || "")
    .split(";")
    .map((grupo) =>
      grupo
        .split(",")
        .map((x) => identityKey(x))
        .filter(Boolean)
    )
    .filter((g) => g.length > 1);
}

/**
 * Todas las claves con las que hay que buscar a esta persona: las suyas y las de
 * su grupo, si está declarado. Devuelve siempre claves canónicas, sin repetir.
 */
export function expandIdentity(
  input: { email?: string | null; phone?: string | null },
  grupos: string[][]
): string[] {
  const propias = [emailKey(input.email), phoneKey(input.phone)].filter(Boolean);
  if (propias.length === 0) return [];
  const todas = new Set(propias);
  for (const grupo of grupos) {
    if (grupo.some((k) => todas.has(k))) for (const k of grupo) todas.add(k);
  }
  return [...todas];
}

/** Lee los grupos declarados en el entorno. */
export function identityGroupsFromEnv(): string[][] {
  return parseIdentityGroups(process.env.CLIENTE_IDENTIDADES_ALIAS);
}

/** Atajo: todas las claves de esta persona según lo declarado en el entorno. */
export function clientIdentityKeys(input: { email?: string | null; phone?: string | null }): string[] {
  return expandIdentity(input, identityGroupsFromEnv());
}
