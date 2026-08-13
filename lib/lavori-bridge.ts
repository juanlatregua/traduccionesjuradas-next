// Puente motor→tablón (Fase 1, carril alemán). Contrato:
// research/contrato-fase1-solicitudes-2026-08-10.md (repo lavori).
// Un pedido PAGADO cuya lengua tiene candidatos en lavori NO se auto-asigna a un
// colaborador de tj.net: se envía como solicitud dirigida al tablón (el traductor
// ve el documento antes de aceptar; el aviso le llega desde hola@lavori.es).
// Regla madre: en el payload no viaja PII del cliente — la descripción se
// construye aquí a partir de tipo/volumen, nunca del título del pedido.

const LAVORI_ENDPOINT =
  process.env.LAVORI_BRIDGE_URL || "https://lavori.es/api/motor/solicitudes";

const MAX_DOC_BYTES = 15 * 1024 * 1024; // tope del sobre de lavori por fichero

// Candidatos por lengua (ids de miembro en lavori). v1: alemán → Morton
// (decisión de Juan 10-ago-2026: "cuando llega algo de alemán va directamente a
// Morton pasando por lavori"). Ampliar aquí cuando se abran más carriles.
export const LAVORI_CANDIDATES: Record<string, string[]> = {
  de: ["ngus1uku6x5uw2pqbmflpbbt"], // Morton Sebastian Peter Münster (DE>ES / ES>DE, jurado MAEC)
  // Candidato ÚNICO a propósito: el anti-carrera de lavori da el encargo al
  // primero que acepta, y la preferencia de Juan (11-ago) es Olaf por tarifa.
  // Plan B tras el cron de 24 h (manual, en este orden): Joaquín G. Moya (de
  // vacaciones hasta sept) u otro SV del padrón que complete ficha; Anna Julia
  // Fredriksson (fcsm3y8xbbgepw42nkfjjhlf) LA ÚLTIMA — tarifa alta, decisión Juan.
  sv: ["11liibyp9v5840itb6mth3r9"], // Olaf Medina-Montoya Hellgren (SV, jurado)
  // Carriles 12-ago-2026 (decisión Juan: "Rumano prioridad Maria, Inglés
  // prioridad Vanessa"). Candidata ÚNICA como en el sueco (anti-carrera);
  // reservas siempre a mano. ⚠ `en` aquí saca el inglés pagado de la
  // auto-asignación en silencio a Juan Amor (mismo movimiento que hizo `de`).
  ro: ["8npqw6hd5vavn4maio2173lq"], // Maria Murariu Ursu (T-IJ 11058, RO>ES/ES>RO)
  en: ["43dwlkzsr6lsltpwcj32m88s"], // Vanessa Bech (T-IJ 8272, EN>ES/ES>EN)
  // Carril 13-ago-2026 (reparto Juan). ⚠ Igual que `de`/`en`: saca el portugués
  // PAGADO de la auto-asignación a Juan Amor. DOS candidatos (decisión Juan
  // 13-ago tarde: que coticen ambos y compara; en LEADS la última cifra pisa la
  // anterior en LavoriPriceRequest — las dos llegan por email y decide Juan).
  // Ninguno con papel único aún ni Collaborator en tj.net → "mapear" al aceptar.
  pt: [
    "whvx8ft5w6wi50hchczh48hp", // Francisco Carballo Cruz (PT>ES, jurado)
    "f4pyspe0hsa1ss99siaokqti", // María García Garmendia (T-IJ 4176, IT+PT; entra con enlace 7 días)
  ],
  // ⚠ TEMPORAL E2E Fase 2 (13-ago-2026): carril noruego → cuenta demo de lavori
  // para validar precio_aceptado + entrega_subida en prod. REVERTIR AL CERRAR
  // (mismo patrón que el 12-ago, commits 55153aa/1b96e2a).
  no: ["48dhwptj01xd9fugwbetq76q"], // cuenta demo "lavori"
};

// Miembro de lavori → email del Collaborator de tj.net (para cerrar la vuelta:
// asignación al aceptar + devengo al subir factura). Ampliar junto a CANDIDATES.
export const LAVORI_MEMBER_COLLABORATOR_EMAIL: Record<string, string> = {
  ngus1uku6x5uw2pqbmflpbbt: "morton.muenster@gmx.de", // Morton Sebastian Peter Münster
  "8npqw6hd5vavn4maio2173lq": "tradintro@gmail.com", // Maria Murariu Ursu (Collaborator ro)
  "43dwlkzsr6lsltpwcj32m88s": "bechtraducciones@gmail.com", // Vanessa Bech (Collaborator en)
};

export type LavoriRoute = { lang: string; par: string; candidatos: string[] };

/** Decide si un par de lenguas del motor se enruta a lavori, y con qué par direccional. */
export function lavoriRouteFromPair(langPair?: string | null): LavoriRoute | null {
  const normalized = String(langPair || "").trim().toLowerCase();
  if (!normalized) return null;
  const [from, to = "es"] = normalized.split("->");
  if (LAVORI_CANDIDATES[from]) {
    return { lang: from, par: `${from.toUpperCase()}>ES`, candidatos: LAVORI_CANDIDATES[from] };
  }
  if (LAVORI_CANDIDATES[to]) {
    return { lang: to, par: `ES>${to.toUpperCase()}`, candidatos: LAVORI_CANDIDATES[to] };
  }
  return null;
}

/** paraTi = 75% del neto (margen 25% de la casa); precioCliente = neto. En euros con 2 decimales. */
export function bridgeAmounts(amountCents: number): { paraTi: string; precioCliente: string } {
  const netoCents = Math.round(amountCents / 1.21);
  const paraTiCents = Math.round(netoCents * 0.75);
  return {
    paraTi: (paraTiCents / 100).toFixed(2),
    precioCliente: (netoCents / 100).toFixed(2),
  };
}

/** Descripción SIN PII: tipo/volumen, jamás el título del pedido (puede llevar nombres). */
export function bridgeDescription(opts: { docCount: number; words?: number | null; par: string }): string {
  const docs = opts.docCount === 1 ? "1 documento PDF" : `${opts.docCount} documentos PDF`;
  const palabras = opts.words ? ` (~${opts.words} palabras)` : "";
  return `${docs}${palabras} — traducción jurada ${opts.par}. Encargo de la casa; el documento va en el sobre.`;
}

export type BridgeDoc = { nombre: string; contentType: string; base64: string };

export type SolicitudPayload = {
  ref: string;
  par: string;
  descripcion: string;
  palabras?: number;
  plazo?: string;
  // Ausentes => SOLICITUD DE PRECIO (adenda 11-ago-2026 del contrato): mismo
  // carril dirigido, pero el candidato ve los documentos y propone su precio.
  paraTi?: string;
  precioCliente?: string;
  // Adenda 12-ago-2026: especificaciones del encargo (≤2000 chars); lavori las
  // concatena a la descripción que ve el candidato. Sin PII del cliente.
  especificaciones?: string;
  candidatos: string[];
  documentos: BridgeDoc[];
};

/** Solicitud de PRECIO (sin paraTi): el candidato ve los documentos y propone su
 * precio. Ref con sufijo propio para no chocar con la idempotencia del carril
 * pagado si el mismo pedido se envía después como encargo con precio. */
export function buildPriceRequestPayload(opts: {
  reference: string;
  route: LavoriRoute;
  words?: number | null;
  especificaciones?: string | null;
  documentos: BridgeDoc[];
}): SolicitudPayload {
  const docs =
    opts.documentos.length === 1 ? "1 documento PDF" : `${opts.documentos.length} documentos PDF`;
  const palabras = opts.words ? ` (~${opts.words} palabras)` : "";
  const especificaciones = String(opts.especificaciones || "").trim().slice(0, 2000);
  return {
    ref: `${opts.reference}-precio`,
    par: opts.route.par,
    descripcion: `${docs}${palabras} — traducción jurada ${opts.route.par}. Solicitud de precio de la casa: mira los documentos del sobre y pasa tu precio.`,
    ...(opts.words ? { palabras: opts.words } : {}),
    ...(especificaciones ? { especificaciones } : {}),
    candidatos: opts.route.candidatos,
    documentos: opts.documentos,
  };
}

export function buildSolicitudPayload(opts: {
  reference: string;
  route: LavoriRoute;
  amountCents: number;
  words?: number | null;
  dueDate?: Date | null;
  documentos: BridgeDoc[];
}): SolicitudPayload {
  const { paraTi, precioCliente } = bridgeAmounts(opts.amountCents);
  return {
    ref: opts.reference,
    par: opts.route.par,
    descripcion: bridgeDescription({
      docCount: opts.documentos.length,
      words: opts.words,
      par: opts.route.par,
    }),
    ...(opts.words ? { palabras: opts.words } : {}),
    ...(opts.dueDate ? { plazo: opts.dueDate.toISOString().slice(0, 10) } : {}),
    paraTi,
    precioCliente,
    candidatos: opts.route.candidatos,
    documentos: opts.documentos,
  };
}

/** Descarga un documento del Blob del motor y lo empaqueta en base64 para el sobre. */
export async function fetchDocAsBase64(doc: {
  url: string;
  name: string;
  type: string;
}): Promise<BridgeDoc | null> {
  const res = await fetch(doc.url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_DOC_BYTES) return null;
  return {
    // Nombre neutro si el original pudiera llevar el del cliente lo decide quien
    // llama; aquí se respeta el que llega.
    nombre: doc.name,
    contentType: doc.type || "application/pdf",
    base64: buf.toString("base64"),
  };
}

export type SolicitudResult =
  | { ok: true; encargoId: string; repetido: boolean }
  | { ok: false; error: string };

/* Fase 2 (contrato research/contrato-fase2-eventos-2026-08-12.md, repo lavori):
   el cliente acepta/paga el presupuesto → se comunica al encargo EXISTENTE de
   lavori con LA CIFRA DEL PROPIO TRADUCTOR (jamás recalculada). 409 = el encargo
   ya no está publicado (aceptado/cerrado/retirado): lavori no toca nada y el
   motor avisa a staff con el estado. */

const LAVORI_PRECIO_ACEPTADO_ENDPOINT =
  process.env.LAVORI_PRECIO_ACEPTADO_URL || "https://lavori.es/api/motor/precio-aceptado";

export type PrecioAceptadoResult =
  | { ok: true; repetido: boolean }
  | { ok: false; conflicto: true; estado: string; aceptadoPor: string | null }
  | { ok: false; conflicto?: false; error: string };

export async function sendLavoriPrecioAceptado(payload: {
  ref: string; // motor_ref EXACTA del encargo en lavori (leads: LEAD-XXXX-precio)
  precioParaTi: string; // euros con 2 decimales — la cifra que propuso el traductor
  nota?: string; // ≤500, va al chat del encargo; sin PII del cliente
}): Promise<PrecioAceptadoResult> {
  const secret = process.env.MOTOR_LAVORI_SECRET;
  if (!secret) {
    return { ok: false, error: "MOTOR_LAVORI_SECRET no configurado en el motor." };
  }
  try {
    const res = await fetch(LAVORI_PRECIO_ACEPTADO_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: payload.ref,
        precioParaTi: payload.precioParaTi,
        ...(payload.nota ? { nota: payload.nota.slice(0, 500) } : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; repetido?: boolean; estado?: string; aceptadoPor?: string; error?: string }
      | null;
    if (res.ok && data?.ok) {
      return { ok: true, repetido: Boolean(data.repetido) };
    }
    if (res.status === 409) {
      return {
        ok: false,
        conflicto: true,
        estado: data?.estado || "desconocido",
        aceptadoPor: data?.aceptadoPor || null,
      };
    }
    return { ok: false, error: data?.error || `lavori respondió ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || "fallo de red hacia lavori" };
  }
}

export async function sendLavoriSolicitud(payload: SolicitudPayload): Promise<SolicitudResult> {
  const secret = process.env.MOTOR_LAVORI_SECRET;
  if (!secret) {
    return { ok: false, error: "MOTOR_LAVORI_SECRET no configurado en el motor." };
  }
  try {
    const res = await fetch(LAVORI_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; encargoId?: string; repetido?: boolean; error?: string }
      | null;
    if (res.ok && data?.ok && data.encargoId) {
      return { ok: true, encargoId: data.encargoId, repetido: Boolean(data.repetido) };
    }
    return { ok: false, error: data?.error || `lavori respondió ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || "fallo de red hacia lavori" };
  }
}
