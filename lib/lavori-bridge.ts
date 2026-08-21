// Puente motor→tablón (Fase 1, carril alemán). Contrato:
// research/contrato-fase1-solicitudes-2026-08-10.md (repo lavori).
// Un pedido PAGADO cuya lengua tiene candidatos en lavori NO se auto-asigna a un
// colaborador de tj.net: se envía como solicitud dirigida al tablón (el traductor
// ve el documento antes de aceptar; el aviso le llega desde hola@lavori.es).
// Regla madre: en el payload no viaja PII del cliente — la descripción se
// construye aquí a partir de tipo/volumen, nunca del título del pedido.

const LAVORI_ENDPOINT =
  process.env.LAVORI_BRIDGE_URL || "https://lavori.es/api/motor/solicitudes";

// Tope del sobre: es POR POST, no por fichero. Medido contra prod por la sesión
// de lavori (15-ago-2026): 4.403.150 bytes de cuerpo pasan, 4.505.550 dan 413 —
// el límite de Vercel (4,5 MB). Descontando el JSON del sobre y el 33% que
// infla el base64 quedan ~3 MB en crudo SUMANDO TODOS los documentos.
// El 413 lo corta la plataforma con x-vercel-error: FUNCTION_PAYLOAD_TOO_LARGE:
// su handler NO llega a ejecutarse, así que al otro lado no hay ni auditoría ni
// aviso. Si nos pasamos, el envío se pierde para ellos: hay que no enviarlo.
export const SOBRE_MAX_RAW_BYTES = 3_000_000;

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
  // Carril 14-ago-2026 (demanda GSC: mayor familia sin marca del site).
  // MULTI-CANDIDATO por orden de Juan (14-ago tarde: las 2 altas de la ola NL
  // entran al carril) — cotizan y Juan compara; en pedidos pagados dirigidos,
  // la primera que acepta se lo lleva. DOS dobles-credenciales (Dolores y
  // Daniela: MAEC+Wbtv) → cualquier documento con destino Países Bajos queda
  // cubierto. Reservas a mano: Violette Oudkerk (T-IJ 2065,
  // flzteuv5vv4xoac1siivkrep) y Conchita Siedenburg (T-IJ 2696,
  // 7mr5fqd974h56855ewum2cgh). ⚠ EXCLUSIÓN CONSCIENTE (orden Juan 14-ago):
  // Inge Luken NO entra — no emite facturas y rompe factura_subida→Expense.
  // Daniela hace también EN>ES (solo hacia español) — NO añadida al carril en
  // (prioridad Vanessa, decisión Juan 12-ago) sin nueva orden.
  nl: [
    "s2vn1450z5rud0s03shffui3", // María Dolores Álvarez Estévez (T-IJ 11466 + Wbtv 40785)
    "a2x1faeg08r1tiz4gt1d6hfv", // Daniela Cleintuar (T-IJ 11401 + Wbtv 40451, tb. intérprete)
    "vo686ldt55z9yjd7dxrvl7gs", // Maaike Leen Lootens (T-IJ 3684)
    "fiekx289i4ryrul7r8dx02le", // Roland Bakker (T-IJ 245, veterano; alta 14-ago, ficha completa)
  ],
  // Carril 13-ago-2026 (caso hermanas Brich, solteria AR>ES URGENTE 14-ago).
  // Los TRES jurados AR operativos del tablón: a volumen pequeño, tres avisos
  // maximizan que alguien lo coja hoy; las cifras llegan a Juan y decide por
  // precio+plazo. Ninguno con papel único firmado (casilla al abrir docs).
  // Julud (equipo de Marta) sin cuenta aún. No confundir Marta López con
  // Marta Riosalido (danés). Badri NO vale para jurada (no es jurado).
  ar: [
    "g45tpqggq16yn8q4r9ww2m5c", // Marta López (AR>ES / ES>AR, jurada)
    "1f0j9vhune01xff5x3l1gi31", // Manuel Carmelo Feria García (T-IJ 850)
    "1s6cygiljkcwkkzebrfewloj", // María Belén Roncero Moreno
  ],
  // Carril 21-ago-2026 (orden Juan "sí" a abrir el italiano). Padrón IT del
  // tablón consultado en la BD de lavori ese día: SOLO dos jurados de italiano.
  // Juan Amor (T-IJ 132, email sí, nunca ha entrado; pase de 7 días el 21-ago)
  // es el único con canal real → candidato del carril. María García Garmendia
  // (IT+PT, ya en `pt`) NO entra por defecto: sin email ni push, "buzón vacío"
  // (lección 15-ago). Sigue en la cartera para elegirla a mano.
  it: ["rk1x2kq63rm6ba6mco7c6u2k"], // Juan Amor Fernández (T-IJ 132; IT>ES / ES>IT)
};

// CARTERA del tablón: todos los jurados de cada lengua (padrón de lavori,
// 21-ago-2026, consultado en su BD). Distinta de LAVORI_CANDIDATES: esa tabla
// es el carril POR DEFECTO (quién recibe el pedido pagado y la solicitud si
// no se elige a nadie); esta es el universo del que se puede elegir a mano
// desde la ficha del pedido o el builder ("todos los de la lengua" / "uno en
// concreto", orden Juan 21-ago: "inglés a Vanessa"). Solo pares jurados con
// español; fuera: lenguas no juradas del miembro (no pueden firmar jurada),
// cuentas de prueba e Inge Luken (exclusión consciente 14-ago). Las lenguas
// de cartera sin carril fijo (sin entrada en LAVORI_CANDIDATES) se enrutan a
// TODA su cartera. FR no está: el francés es de Juan.
export type LavoriMember = { id: string; nombre: string; tij?: string; langs: string[]; nota?: string };
export const LAVORI_MEMBERS: LavoriMember[] = [
  { id: "ngus1uku6x5uw2pqbmflpbbt", nombre: "Morton Münster", langs: ["de"] },
  { id: "sorcf8djafz6p03lgz2o7dco", nombre: "Francisco Báez de Aguilar", tij: "3865", langs: ["de"], nota: "no disponible" },
  { id: "cspzplwhvout73fhkus1htt3", nombre: "M. Blanca Iturriagagoitia", tij: "1352", langs: ["de"] },
  { id: "11liibyp9v5840itb6mth3r9", nombre: "Olaf Medina-Montoya Hellgren", langs: ["sv"] },
  { id: "fcsm3y8xbbgepw42nkfjjhlf", nombre: "Anna Julia Fredriksson", langs: ["sv"], nota: "tarifa alta" },
  { id: "8npqw6hd5vavn4maio2173lq", nombre: "Maria Murariu Ursu", tij: "11058", langs: ["ro"] },
  { id: "43dwlkzsr6lsltpwcj32m88s", nombre: "Vanessa Bech", tij: "8272", langs: ["en"] },
  { id: "nn9ffizgaso8zm2d8276aep2", nombre: "Antonio Adolfo", tij: "3791", langs: ["en"] },
  { id: "whvx8ft5w6wi50hchczh48hp", nombre: "Francisco Carballo Cruz", langs: ["pt"] },
  { id: "f4pyspe0hsa1ss99siaokqti", nombre: "María García Garmendia", tij: "4176", langs: ["it", "pt"], nota: "sin email ni push" },
  { id: "rk1x2kq63rm6ba6mco7c6u2k", nombre: "Juan Amor Fernández", tij: "132", langs: ["de", "en", "it", "pt"], nota: "nunca ha entrado; email sí" },
  { id: "s2vn1450z5rud0s03shffui3", nombre: "María Dolores Álvarez Estévez", tij: "11466", langs: ["nl"] },
  { id: "a2x1faeg08r1tiz4gt1d6hfv", nombre: "Daniela Cleintuar", tij: "11401", langs: ["nl", "en"], nota: "EN solo hacia español" },
  { id: "vo686ldt55z9yjd7dxrvl7gs", nombre: "Maaike Leen Lootens", tij: "3684", langs: ["nl"] },
  { id: "fiekx289i4ryrul7r8dx02le", nombre: "Roland Bakker", tij: "245", langs: ["nl"] },
  { id: "flzteuv5vv4xoac1siivkrep", nombre: "Violette Oudkerk", tij: "2065", langs: ["nl"] },
  { id: "7mr5fqd974h56855ewum2cgh", nombre: "Conchita Siedenburg", tij: "2696", langs: ["nl"] },
  { id: "g45tpqggq16yn8q4r9ww2m5c", nombre: "Marta López", langs: ["ar"] },
  { id: "1f0j9vhune01xff5x3l1gi31", nombre: "Manuel Carmelo Feria García", tij: "850", langs: ["ar"] },
  { id: "1s6cygiljkcwkkzebrfewloj", nombre: "María Belén Roncero Moreno", langs: ["ar"] },
];

/** Jurados de la cartera para una lengua (orden: primero los del carril por defecto). */
export function lavoriCarteraForLang(lang: string): LavoriMember[] {
  const l = String(lang || "").trim().toLowerCase();
  const defaults = LAVORI_CANDIDATES[l] || [];
  return LAVORI_MEMBERS.filter((m) => m.langs.includes(l)).sort(
    (a, b) => Number(defaults.includes(b.id)) - Number(defaults.includes(a.id))
  );
}

export function lavoriMemberName(id: string): string {
  return LAVORI_MEMBERS.find((m) => m.id === id)?.nombre || id;
}

/** Resuelve los candidatos de una solicitud manual. Sin selección → carril por
 * defecto. Con selección → solo ids de la cartera de ESA lengua (un id de otra
 * lengua, desconocido o una lista vacía se rechazan: nadie recibe un sobre por
 * error). */
export function resolveLavoriCandidatos(
  route: LavoriRoute,
  requested?: unknown
): { ok: true; candidatos: string[]; elegidos: boolean } | { ok: false; error: string } {
  if (requested === undefined || requested === null) {
    return { ok: true, candidatos: route.candidatos, elegidos: false };
  }
  if (!Array.isArray(requested) || requested.length === 0) {
    return { ok: false, error: "Elige al menos un jurado del tablón." };
  }
  const cartera = new Set(lavoriCarteraForLang(route.lang).map((m) => m.id));
  const ids = Array.from(new Set(requested.map((x) => String(x || "").trim()).filter(Boolean)));
  const fuera = ids.filter((id) => !cartera.has(id));
  if (ids.length === 0 || fuera.length > 0) {
    return { ok: false, error: `Candidato fuera de la cartera de ${route.lang.toUpperCase()}: ${fuera.join(", ") || "(vacío)"}.` };
  }
  return { ok: true, candidatos: ids, elegidos: true };
}

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
  // Carril fijo si existe; si no, toda la cartera de la lengua (21-ago-2026).
  const candidatosDe = (lang: string): string[] | null => {
    if (LAVORI_CANDIDATES[lang]) return LAVORI_CANDIDATES[lang];
    const cartera = LAVORI_MEMBERS.filter((m) => m.langs.includes(lang)).map((m) => m.id);
    return cartera.length > 0 ? cartera : null;
  };
  if (from !== "es") {
    const c = candidatosDe(from);
    if (c) return { lang: from, par: `${from.toUpperCase()}>ES`, candidatos: c };
  }
  if (to !== "es") {
    const c = candidatosDe(to);
    if (c) return { lang: to, par: `ES>${to.toUpperCase()}`, candidatos: c };
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
  if (buf.length === 0 || buf.length > SOBRE_MAX_RAW_BYTES) return null;
  return {
    // Nombre neutro si el original pudiera llevar el del cliente lo decide quien
    // llama; aquí se respeta el que llega.
    nombre: doc.name,
    contentType: doc.type || "application/pdf",
    base64: buf.toString("base64"),
  };
}

/* Empaqueta TODOS los documentos de una solicitud dentro del presupuesto del
   sobre. Carril único: antes cada llamador repetía el bucle y solo miraba el
   tamaño de cada fichero por separado, así que tres PDF de 2 MB pasaban la
   guarda y se estrellaban juntos contra el 413.
   Si no caben NO se manda un expediente incompleto: el traductor cotizaría a
   ciegas. Se devuelve error y el llamador avisa a staff para comprimir. */
export async function packDocsForSobre(
  docs: { url: string; name: string; type: string }[],
): Promise<{ ok: true; documentos: BridgeDoc[] } | { ok: false; error: string }> {
  const documentos: BridgeDoc[] = [];
  let rawBytes = 0;

  for (const doc of docs) {
    const empaquetado = await fetchDocAsBase64(doc);
    if (!empaquetado) continue;
    rawBytes += Math.floor((empaquetado.base64.length * 3) / 4);
    if (rawBytes > SOBRE_MAX_RAW_BYTES) {
      return {
        ok: false,
        error: `los documentos suman más de ${Math.round(SOBRE_MAX_RAW_BYTES / 1e6)} MB y el sobre de lavori no los admite en un solo envío — comprimir los PDF antes de reenviar`,
      };
    }
    documentos.push(empaquetado);
  }

  if (documentos.length === 0) {
    return { ok: false, error: "no se pudo descargar ningún documento del pedido" };
  }
  return { ok: true, documentos };
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
    // 413 = lo corta Vercel antes de su handler: ellos no se enteran de nada.
    // El aviso a staff es el ÚNICO rastro que va a quedar del envío.
    if (res.status === 413) {
      return {
        ok: false,
        error:
          "el sobre superó el límite de tamaño de lavori (413) — no ha llegado y allí no queda registro; comprimir los PDF y reenviar",
      };
    }
    return { ok: false, error: data?.error || `lavori respondió ${res.status}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || "fallo de red hacia lavori" };
  }
}
