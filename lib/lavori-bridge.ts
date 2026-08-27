// Puente motor→tablón (Fase 1, carril alemán). Contrato:
// research/contrato-fase1-solicitudes-2026-08-10.md (repo lavori).
// Un pedido PAGADO cuya lengua tiene candidatos en lavori NO se auto-asigna a un
// colaborador de tj.net: se envía como solicitud dirigida al tablón (el traductor
// ve el documento antes de aceptar; el aviso le llega desde hola@lavori.es).
// Regla madre: en el payload no viaja PII del cliente — la descripción se
// construye aquí a partir de tipo/volumen, nunca del título del pedido.

const LAVORI_ENDPOINT =
  process.env.LAVORI_BRIDGE_URL || "https://lavori.es/api/motor/solicitudes";

// Tope de un POST en Vercel: 4,5 MB (medido contra lavori prod 15-ago-2026:
// 4.403.150 bytes pasan, 4.505.550 dan 413 de PLATAFORMA, sin que el handler
// llegue a ejecutarse). Sigue vigente para lo que nos llega de lavori en base64
// por /api/lavori/eventos (entregas, facturas).
export const SOBRE_MAX_RAW_BYTES = 3_000_000;

// Documentos del motor → lavori: desde el 25-ago-2026 viajan POR URL (adenda al
// contrato de Fase 1), no en base64 dentro del POST. Incidente 26_3BBE08: seis
// certificados escaneados (12,8 MB) tumbaron el puente antes de salir; orden de
// Juan: "no puede haber errores de este tipo, los documentos son siempre
// grandes". lavori descarga cada URL server-side y la sube a SU sobre; la URL
// no se persiste allí. Único tope que queda: el de lavori por fichero (15 MB).
export const SOBRE_MAX_FILE_BYTES = 15 * 1024 * 1024;

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
  // Carril 21-ago-2026 (orden Juan: "solo en IT de momento y cat"): catalán
  // también a Juan Amor (CA>ES / ES>CA jurado). NO en pt/de/en (EN = Vanessa,
  // DE = Morton; decisión explícita de Juan ese día).
  ca: ["rk1x2kq63rm6ba6mco7c6u2k"], // Juan Amor Fernández (T-IJ 132; CA>ES / ES>CA)
};

// CARTERA del tablón: jurados por lengua. FUENTE VIVA = lavori
// (GET /api/motor/miembros, solo lectura, mismo token que las solicitudes;
// montado por lavori el 21-ago-2026 a petición de este repo). La tabla estática
// de abajo es SOLO respaldo si lavori no responde, y cubre las lenguas con
// carril fijo (padrón del 21-ago). Distinta de LAVORI_CANDIDATES: esa es el
// carril POR DEFECTO (quién recibe el pedido pagado y la solicitud si no se
// elige a nadie); la cartera es el universo del que se elige a mano desde la
// ficha del pedido o el builder ("todos los de la lengua" / "uno en concreto",
// orden Juan 21-ago: "inglés a Vanessa"). Fuera: lenguas no juradas del
// miembro, cuentas de prueba, plazas de equipo. FR no entra: el francés es de Juan.
export type LavoriMember = {
  id: string;
  nombre: string;
  tij?: string;
  langs: string[];
  // Señales de lavori (solo en vivo): canal=false es "buzón vacío" (ni email ni
  // push, lección 15-ago); enPaz = no molestar; disponible = su propio flag.
  canal?: boolean;
  enPaz?: boolean;
  disponible?: boolean;
  papelUnico?: boolean;
  nota?: string;
};
export const LAVORI_MEMBERS: LavoriMember[] = [
  // de
  { id: "ngus1uku6x5uw2pqbmflpbbt", nombre: "Morton Sebastian Peter Münster", tij: "11492", langs: ["de"], papelUnico: true },
  { id: "9eljdeppotd42zsco9ku4u9o", nombre: "Ana Lucía Martín", tij: "10003", langs: ["de"], disponible: false },
  { id: "sorcf8djafz6p03lgz2o7dco", nombre: "Francisco Báez De Aguilar González", tij: "3865", langs: ["de"], disponible: false },
  { id: "wlhz5dsun5d4r4537p7xw1se", nombre: "Isabel Wild", tij: "11409", langs: ["de"] },
  { id: "euel8mucj27x8cmtnpk5t8ke", nombre: "Jasmin Petersen", tij: "2227", langs: ["de"] },
  { id: "v7iyzs3y767ezplxfmw5mev4", nombre: "Josefina Corral", tij: "620", langs: ["de"] },
  { id: "6uc26g28spse8tjnalv7sv1w", nombre: "Marta Gómez-Monedero Pérez", tij: "11296", langs: ["de"], disponible: false },
  { id: "cspzplwhvout73fhkus1htt3", nombre: "María Blanca Iturriagagoitia Bassas", tij: "1352", langs: ["de"] },
  { id: "1p4auj9v5gydceol8cdtfxda", nombre: "Monika Miofsky Günter", tij: "1839", langs: ["de"], disponible: false },
  { id: "gaqmtpl22g4wy0x129rf2m9h", nombre: "Nicoletta Hedwig Jamin", tij: "5495", langs: ["de"] },
  { id: "89cqc4uiaxdx7awdxlmlzwmd", nombre: "Sabine Ulrike Buckmann de Villegas", tij: "408", langs: ["de"] },
  { id: "9tuk78v308erfd0r6eopvnts", nombre: "Sandra Ladero Gärtner", tij: "7928", langs: ["de"] },
  { id: "5no05rbjknmhyp379p2wr4br", nombre: "Silvia Arenas Cortés", tij: "6796", langs: ["de"] },
  { id: "vpr2xl4ftnbaiyewmjyw6sip", nombre: "Ángela Flores Delgado", tij: "7663", langs: ["de"] },
  // sv
  { id: "11liibyp9v5840itb6mth3r9", nombre: "Olaf Medina-Montoya Hellgren", tij: "1782", langs: ["sv"] },
  { id: "fcsm3y8xbbgepw42nkfjjhlf", nombre: "Anna Julia Fredriksson", tij: "11267", langs: ["sv"], nota: "tarifa alta" },
  { id: "ekrf1kzniamzr6v70f4jy6xy", nombre: "Cristina Barros De Lis Y Tubbe", tij: "284", langs: ["sv"] },
  { id: "bve1cp6a8gabkkhrirbtp9k4", nombre: "Ingrid Ringmar", tij: "6121", langs: ["sv"] },
  { id: "m01qzcgph8azbseamydykols", nombre: "Joaquín Gonzalez Moya", tij: "11420", langs: ["sv"], disponible: false },
  { id: "6fxlns5odn3iog7ohe82ld4s", nombre: "Kristina Stenhammar Olsson", tij: "2744", langs: ["sv"] },
  // ro
  { id: "8npqw6hd5vavn4maio2173lq", nombre: "Maria Murariu Ursu", tij: "11058", langs: ["ro"], papelUnico: true },
  // en
  { id: "43dwlkzsr6lsltpwcj32m88s", nombre: "Vanessa Bech", tij: "8272", langs: ["en"] },
  { id: "jhpkcc0kjnhvp1f1q8vpxk7x", nombre: "Alberto López (PALABRAS, SL)", tij: "1541", langs: ["en"] },
  { id: "s8ujfmeoxzrtch48bqkxdk4w", nombre: "Alfonso García Moreno", tij: "1042", langs: ["en"] },
  { id: "nn9ffizgaso8zm2d8276aep2", nombre: "Antonio Adolfo", tij: "3791", langs: ["en"] },
  { id: "myowfodr5vu1v0lexo9plxku", nombre: "Daniel Fernández Mellado", tij: "4624", langs: ["en"] },
  { id: "7uequciajq9t53t04bbz6qmq", nombre: "Karen Rosenberg", tij: "4186", langs: ["en"], enPaz: true },
  { id: "7ppqkolbpp77s85af3xadtp7", nombre: "Marta Moreno Perez", tij: "11502", langs: ["en", "nl"] },
  { id: "7ls14dacbfhk4adsywfke384", nombre: "María Fernández Álviz", tij: "853", langs: ["en"] },
  { id: "pbxr95jn67vehh9ek8v6n7o2", nombre: "María del Mar Rodríguez Vallejo", tij: "2446", langs: ["en"] },
  { id: "eefnoof6rfmnijfjovfk24py", nombre: "Nieves Andraca Díaz", tij: "140", langs: ["en"] },
  { id: "dkz2jykasewuhh0akjsguh6k", nombre: "Pilar Guzmán Gil", tij: "1267", langs: ["en"] },
  { id: "y5hu9dqd2u8jgjgaiethvey0", nombre: "Raquel Cascallana González", tij: "7073", langs: ["en"] },
  { id: "k3da8c8rw9avmc3ngz55vbmd", nombre: "Remedios Venegas Llucia", tij: "2896", langs: ["en"] },
  { id: "qetmckaaselyjwn072805xue", nombre: "Ángeles Garrido", tij: "1087", langs: ["en"] },
  // pt / it
  { id: "whvx8ft5w6wi50hchczh48hp", nombre: "Francisco Carballo Cruz", tij: "3783", langs: ["pt"], papelUnico: true },
  { id: "f4pyspe0hsa1ss99siaokqti", nombre: "María García Garmendia", tij: "4176", langs: ["it", "pt"], canal: false, nota: "sin email ni push" },
  { id: "imk4gzmqp0uhyfqku9fqs0mb", nombre: "Silvia Capón Sánchez", tij: "9161", langs: ["pt"], disponible: false },
  { id: "rk1x2kq63rm6ba6mco7c6u2k", nombre: "Juan Amor Fernández", tij: "132", langs: ["de", "en", "it", "pt", "ca"], nota: "nunca ha entrado; email sí" },
  // nl
  { id: "s2vn1450z5rud0s03shffui3", nombre: "María Dolores Álvarez Estévez", tij: "11466", langs: ["nl"] },
  { id: "a2x1faeg08r1tiz4gt1d6hfv", nombre: "Daniela Cleintuar", tij: "11401", langs: ["nl"] },
  { id: "vo686ldt55z9yjd7dxrvl7gs", nombre: "Maaike Leen Lootens", tij: "3684", langs: ["nl"] },
  { id: "fiekx289i4ryrul7r8dx02le", nombre: "Roland Bakker", tij: "245", langs: ["nl"] },
  { id: "7mr5fqd974h56855ewum2cgh", nombre: "Conchita Siedenburg", tij: "2696", langs: ["nl"] },
  { id: "pa7e2eybfaor24x5pml85qk0", nombre: "Fabienne Annys", tij: "11471", langs: ["nl"] },
  { id: "fudopxw1a5rppkfazwztjfds", nombre: "Inge Luken", tij: "1117", langs: ["nl"], nota: "no emite facturas (exclusión 14-ago)" },
  { id: "flzteuv5vv4xoac1siivkrep", nombre: "Violette Renée Oudkerk", tij: "2065", langs: ["nl"] },
  // ar
  { id: "g45tpqggq16yn8q4r9ww2m5c", nombre: "Marta López", tij: "9514", langs: ["ar"], papelUnico: true },
  { id: "1f0j9vhune01xff5x3l1gi31", nombre: "Manuel Carmelo Feria García", tij: "850", langs: ["ar"], disponible: false },
  { id: "1s6cygiljkcwkkzebrfewloj", nombre: "María Belén Roncero Moreno", tij: "10449", langs: ["ar"] },
];

function sortDefaultsFirst(lang: string, miembros: LavoriMember[]): LavoriMember[] {
  const defaults = LAVORI_CANDIDATES[lang] || [];
  return [...miembros].sort(
    (a, b) =>
      Number(defaults.includes(b.id)) - Number(defaults.includes(a.id)) ||
      a.nombre.localeCompare(b.nombre, "es")
  );
}

/** Cartera ESTÁTICA (respaldo) de una lengua; los del carril por defecto primero. */
export function lavoriCarteraForLang(lang: string): LavoriMember[] {
  const l = String(lang || "").trim().toLowerCase();
  return sortDefaultsFirst(l, LAVORI_MEMBERS.filter((m) => m.langs.includes(l)));
}

export function lavoriMemberName(id: string, cartera: LavoriMember[] = LAVORI_MEMBERS): string {
  return cartera.find((m) => m.id === id)?.nombre || LAVORI_MEMBERS.find((m) => m.id === id)?.nombre || id;
}

/** Lengua no española de un par del motor ("en->es" / "es->en" → en, EN>ES / ES>EN).
 * NO decide si se enruta (eso es lavoriRouteFromPair): solo parsea. */
export function lavoriLangFromPair(langPair?: string | null): { lang: string; par: string } | null {
  const normalized = String(langPair || "").trim().toLowerCase();
  if (!normalized) return null;
  const [from, to = "es"] = normalized.split("->");
  if (from && from !== "es" && /^[a-z]{2,3}$/.test(from)) return { lang: from, par: `${from.toUpperCase()}>ES` };
  if (to && to !== "es" && /^[a-z]{2,3}$/.test(to)) return { lang: to, par: `ES>${to.toUpperCase()}` };
  return null;
}

const LAVORI_MIEMBROS_ENDPOINT =
  process.env.LAVORI_MIEMBROS_URL || "https://lavori.es/api/motor/miembros";

type LavoriMiembroWire = {
  id?: string;
  nombre?: string;
  tij?: string | null;
  pares?: string[];
  jurado?: boolean;
  email?: boolean;
  push?: number;
  papelUnico?: boolean;
  disponible?: boolean;
  enPaz?: boolean;
  canal?: boolean;
};

/** Mapea un miembro del endpoint de lavori a la forma de la cartera. Solo jurados
 * con pares con español; `langs` = lenguas no-ES de sus pares jurados. */
export function mapLavoriMiembro(w: LavoriMiembroWire): LavoriMember | null {
  const id = String(w?.id || "").trim();
  const nombre = String(w?.nombre || "").trim();
  if (!id || !nombre || w.jurado === false) return null;
  const langs = Array.from(
    new Set(
      (Array.isArray(w.pares) ? w.pares : [])
        .map((p) => String(p).toUpperCase().split(">"))
        .filter((parts) => parts.length === 2 && parts.includes("ES"))
        .map((parts) => (parts[0] === "ES" ? parts[1] : parts[0]).toLowerCase())
        .filter((l) => l && l !== "es")
    )
  );
  if (langs.length === 0) return null;
  return {
    id,
    nombre,
    ...(w.tij ? { tij: String(w.tij) } : {}),
    langs,
    canal: typeof w.canal === "boolean" ? w.canal : Boolean(w.email) || Number(w.push) > 0,
    enPaz: Boolean(w.enPaz),
    disponible: w.disponible !== false,
    papelUnico: Boolean(w.papelUnico),
  };
}

/** Cartera de una lengua EN VIVO desde lavori; si no responde, la estática
 * (`live:false`). Nunca lanza: quien llama decide si puede seguir sin lavori. */
export async function fetchLavoriCartera(
  lang: string
): Promise<{ live: boolean; miembros: LavoriMember[]; error?: string }> {
  const l = String(lang || "").trim().toLowerCase();
  const fallback = (error: string) => ({ live: false, miembros: lavoriCarteraForLang(l), error });
  if (!/^[a-z]{2,3}$/.test(l)) return fallback("lengua ilegible");
  const secret = process.env.MOTOR_LAVORI_SECRET;
  if (!secret) return fallback("MOTOR_LAVORI_SECRET no configurado en el motor.");
  try {
    const res = await fetch(`${LAVORI_MIEMBROS_ENDPOINT}?lengua=${encodeURIComponent(l.toUpperCase())}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => null)) as { miembros?: LavoriMiembroWire[]; error?: string } | null;
    if (!res.ok || !Array.isArray(data?.miembros)) {
      return fallback(data?.error || `lavori respondió ${res.status}`);
    }
    const miembros = data.miembros
      .map(mapLavoriMiembro)
      .filter((m): m is LavoriMember => Boolean(m && m.langs.includes(l)));
    return { live: true, miembros: sortDefaultsFirst(l, miembros) };
  } catch (err) {
    return fallback(err instanceof Error ? err.message : String(err));
  }
}

/** Resuelve los candidatos de una solicitud manual. Sin selección → carril por
 * defecto. Con selección → solo ids de la cartera de ESA lengua (un id de otra
 * lengua, desconocido o una lista vacía se rechazan: nadie recibe un sobre por
 * error). La cartera la pasa quien llama (viva o estática). */
export function resolveLavoriCandidatos(
  route: LavoriRoute,
  requested: unknown,
  cartera: LavoriMember[]
): { ok: true; candidatos: string[]; elegidos: boolean } | { ok: false; error: string } {
  if (requested === undefined || requested === null) {
    if (route.candidatos.length === 0) return { ok: false, error: "Elige al menos un jurado del tablón." };
    return { ok: true, candidatos: route.candidatos, elegidos: false };
  }
  if (!Array.isArray(requested) || requested.length === 0) {
    return { ok: false, error: "Elige al menos un jurado del tablón." };
  }
  const ids = Array.from(new Set(requested.map((x) => String(x || "").trim()).filter(Boolean)));
  const validos = new Set(cartera.filter((m) => m.langs.includes(route.lang)).map((m) => m.id));
  const fuera = ids.filter((id) => !validos.has(id));
  if (ids.length === 0 || fuera.length > 0) {
    return {
      ok: false,
      error: `Candidato fuera de la cartera de ${route.lang.toUpperCase()}: ${fuera.join(", ") || "(vacío)"}.`,
    };
  }
  return { ok: true, candidatos: ids, elegidos: true };
}

/** Ruta para una solicitud MANUAL: el carril fijo si existe; si no, toda la
 * cartera viva de la lengua que pueda recibir (con canal, no en paz). Así una
 * lengua sin carril (p. ej. polaco) se puede pedir a mano desde la ficha sin
 * abrir un carril automático para los pedidos pagados. */
export function lavoriManualRoute(langPair: string | null | undefined, cartera: LavoriMember[]): LavoriRoute | null {
  const fixed = lavoriRouteFromPair(langPair);
  if (fixed) return fixed;
  const parsed = lavoriLangFromPair(langPair);
  if (!parsed) return null;
  const candidatos = cartera
    .filter((m) => m.langs.includes(parsed.lang) && m.canal !== false && !m.enPaz)
    .map((m) => m.id);
  return { lang: parsed.lang, par: parsed.par, candidatos };
}

// Miembro de lavori → email del Collaborator de tj.net (para cerrar la vuelta:
// asignación al aceptar + devengo al subir factura). Ampliar junto a CANDIDATES.
export const LAVORI_MEMBER_COLLABORATOR_EMAIL: Record<string, string> = {
  ngus1uku6x5uw2pqbmflpbbt: "morton.muenster@gmx.de", // Morton Sebastian Peter Münster
  "8npqw6hd5vavn4maio2173lq": "tradintro@gmail.com", // Maria Murariu Ursu (Collaborator ro)
  "43dwlkzsr6lsltpwcj32m88s": "bechtraducciones@gmail.com", // Vanessa Bech (Collaborator en)
};

export type LavoriRoute = { lang: string; par: string; candidatos: string[] };

/** Decide si un par de lenguas del motor se enruta a lavori AUTOMÁTICAMENTE
 * (pedido pagado), y con qué par direccional: solo carriles fijos. Para pedir a
 * mano a cualquier lengua con cartera, ver lavoriManualRoute. */
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

export type BridgeDoc = {
  nombre: string;
  contentType: string;
  url: string; // lavori la descarga server-side y no la persiste
  bytes: number; // lavori verifica tamaño y hash: si no cuadran, 422 y no crea nada
  sha256: string;
};

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
  /** Tarifario aprendido: cifra YA acordada con el jurado (no se aplica el 75/25). */
  paraTiCents?: number | null;
  especificaciones?: string | null;
}): SolicitudPayload {
  const { paraTi, precioCliente } = opts.paraTiCents
    ? {
        paraTi: (opts.paraTiCents / 100).toFixed(2),
        precioCliente: (Math.round(opts.amountCents / 1.21) / 100).toFixed(2),
      }
    : bridgeAmounts(opts.amountCents);
  const especificaciones = String(opts.especificaciones || "").trim().slice(0, 2000);
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
    ...(especificaciones ? { especificaciones } : {}),
    paraTi,
    precioCliente,
    candidatos: opts.route.candidatos,
    documentos: opts.documentos,
  };
}

// El empaquetado de documentos (descarga + bytes + sha256) vive en
// lib/lavori-sobre.ts (solo servidor: usa node:crypto y este módulo lo importan
// componentes cliente).

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
