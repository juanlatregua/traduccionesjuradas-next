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
  paraTi: string;
  precioCliente: string;
  candidatos: string[];
  documentos: BridgeDoc[];
};

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
