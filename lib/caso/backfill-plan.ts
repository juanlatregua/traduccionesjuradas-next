// lib/caso/backfill-plan.ts — Plan PURO del backfill de casos sobre el histórico
// (scripts/caso-backfill.ts lee y escribe). Idempotente: lo que ya tiene casoId se
// queda donde está y sirve de ancla para lo nuevo.
//
// Reglas, en orden:
//  1. Presupuestos por fecha. Uno posterior del mismo cliente y par, ≤21 d después
//     de otro de un caso aún sin pedido, es VERSIÓN de ese caso si comparte
//     documento (expediente o archivo). Sin documentos propios: se une por
//     identidad si hay un solo caso candidato y no es agencia; si no, caso propio
//     DUDOSO. Con documentos distintos: caso nuevo con «posible».
//  2. Pedido → caso de su presupuesto; sin presupuesto, el de su sesión o uno propio.
//  3. Solicitud de precio → presupuesto, expediente+par, misma huella; si solo casa
//     por identidad, caso propio DUDOSO; si no, propio.
//  4. Sesiones de la puerta / expedientes → por expediente o pedido; sueltas = lead, sin caso.
//  5. Emails/WhatsApp entrantes → por expediente; o por presupuesto/pedido dentro de la vida del caso.
//  6. Estado por existencia de pedido; vigente = la del pedido o, sin pedido, la última no borrada.

import { identidadDe, compararIdentidad, telefonosIntermediario, esAgencia, identityKeyDe, type Identidad, type IdKey } from "./identidad.ts";
import { estadoDeCaso, quoteVivo, lprViva, quoteIntocable, puedeCaso, casoTerminal, esCasoEstado, type CasoEstado, type PedidoParaEstado } from "./estados.ts";
import { normPar, paresCompatibles } from "./resolver.ts";
import { textKeys } from "../vigia-persona.ts";
import { AUTO_LOST_NOTES } from "../quote-lost-reasons.ts";

const DAY = 864e5;
export const VENTANA_VERSION_DIAS = 21;
export const VENTANA_LPR_IDENTIDAD_DIAS = 14;
export const MAX_VERSIONES_SIN_DUDA = 3;

export type BQuote = {
  id: string;
  quoteNumber: string;
  status: string;
  deletedAt: Date | null;
  customerId: string;
  customerEmail: string;
  customerPhone: string | null;
  customerName: string;
  sourceLang: string;
  targetLang: string;
  expedienteRef: string | null;
  holderNames: string | null;
  createdAt: Date;
  paidAt: Date | null;
  balanceAmount: number | null;
  balancePaidAt: Date | null;
  lostReason: string | null;
  lostReasonNote: string | null;
  fileKeys: string[]; // sourceFileUrl de las líneas + hashes de la sesión del expediente
  casoId: string | null;
  liveCasoKey: string | null;
  supersededAt: Date | null;
};
export type BLpr = {
  id: string;
  ref: string;
  par: string;
  expedienteRef: string | null;
  customerHint: string | null;
  quoteId: string | null;
  status: string;
  contentKey: string | null;
  createdAt: Date;
  casoId: string | null;
};
export type BOrder = PedidoParaEstado & {
  id: string;
  reference: string;
  quoteId: string | null;
  clientEmail: string;
  clientPhone: string | null;
  clientName: string | null;
  langPair: string | null;
  createdAt: Date;
  casoId: string | null;
};
export type BSesion = {
  token: string;
  analysisIds: string[]; // solo los análisis aún sin caso
  orderIds: string[];
  orderRefs: string[];
  casoIds: string[];
  createdAt: Date;
};
export type BInbound = {
  id: string;
  expedienteRef: string; // expedienteRefForInbound(id)
  quoteId: string | null;
  orderReference: string | null;
  receivedAt: Date;
  casoId: string | null;
};
export type BCaso = { id: string; estado: string };
export type BCustomer = { id: string; isBusiness: boolean; creditEnabled: boolean; billingCycle: string };

export type BackfillInput = {
  ahora: Date;
  quotes: BQuote[];
  lprs: BLpr[];
  orders: BOrder[];
  sesiones: BSesion[];
  inbound: BInbound[];
  casos: BCaso[];
  customers: BCustomer[];
  alias?: string[][];
  propios?: string[];
};

export type CasoPlan = {
  id: string; // existente o "nuevo:N"
  nuevo: boolean;
  estado: CasoEstado;
  estadoAnterior: string | null;
  identityKey: string;
  email: string | null;
  phone9: string | null;
  nombre: string | null;
  pares: string[];
  esAgencia: boolean;
  dudoso: boolean;
  motivos: string[];
  posibles: string[];
  customerId: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  quoteIds: string[];
  lprIds: string[];
  orderIds: string[];
  analysisIds: string[];
  inboundIds: string[];
  vigenteId: string | null;
  refs: string[]; // para el informe
};

export type Sustitucion = { quoteId: string; quoteNumber: string; casoId: string; quitarClave: boolean; supersededAt: Date | null; notaSustituido: boolean; sigueViva: boolean };
export type SinCaso = { tipo: "sesion" | "inbound" | "analisis"; id: string; motivo: string };

export type BackfillPlan = {
  casos: CasoPlan[];
  sustituciones: Sustitucion[];
  conflictosVigente: string[];
  conflictosAncla: string[];
  sinCaso: SinCaso[];
};

type Grupo = {
  id: string;
  nuevo: boolean;
  estadoAnterior: string | null;
  quotes: BQuote[];
  lprs: BLpr[];
  orders: BOrder[];
  sesiones: BSesion[];
  inbound: BInbound[];
  motivos: string[];
  posibles: Set<string>;
  identidad: Identidad | null;
  anclaIdentidad: string;
  nombre: string | null;
  tocado: boolean;
};

const fuerteOTelefono = (a: Identidad, b: Identidad) => {
  const f = compararIdentidad(a, b);
  return f === "fuerte" || f === "telefono";
};
const quotePar = (q: BQuote) => normPar(`${q.sourceLang}>${q.targetLang}`);
const sesionRef = (token: string) => (token.startsWith("exp:") ? token.slice(4) : `puerta:${token}`);

export function planBackfill(input: BackfillInput): BackfillPlan {
  const { ahora } = input;
  const alias = input.alias || [];
  const propios = input.propios || [];
  const vetados = telefonosIntermediario([
    ...input.quotes.map((q) => ({ email: q.customerEmail, phone: q.customerPhone, nombre: q.customerName })),
    ...input.orders.map((o) => ({ email: o.clientEmail, phone: o.clientPhone, nombre: o.clientName })),
  ]);
  const ident = (email: string | null | undefined, phone: string | null | undefined) => identidadDe({ email, phone }, { alias, propios, telefonosVetados: vetados });
  const identDeHint = (hint: string | null) => {
    const keys = textKeys(hint) as IdKey[];
    const e = keys.find((k) => k.startsWith("e:"))?.slice(2) ?? null;
    const p = keys.find((k) => k.startsWith("p:"))?.slice(2) ?? null;
    return ident(e, p);
  };
  const customers = new Map(input.customers.map((c) => [c.id, c]));

  const grupos = new Map<string, Grupo>();
  let n = 0;
  const nuevoGrupo = (anclaIdentidad: string, identidad: Identidad | null, nombre: string | null): Grupo => {
    const g: Grupo = {
      id: `nuevo:${++n}`, nuevo: true, estadoAnterior: null, quotes: [], lprs: [], orders: [], sesiones: [], inbound: [],
      motivos: [], posibles: new Set(), identidad, anclaIdentidad, nombre, tocado: true,
    };
    grupos.set(g.id, g);
    return g;
  };
  for (const c of input.casos) {
    grupos.set(c.id, {
      id: c.id, nuevo: false, estadoAnterior: c.estado, quotes: [], lprs: [], orders: [], sesiones: [], inbound: [],
      motivos: [], posibles: new Set(), identidad: null, anclaIdentidad: c.id, nombre: null, tocado: false,
    });
  }
  const conflictosAncla: string[] = [];
  const existente = (casoId: string | null, que: string): Grupo | null => {
    if (!casoId) return null;
    const g = grupos.get(casoId);
    if (!g) conflictosAncla.push(`${que}: casoId ${casoId} no existe`);
    return g || null;
  };

  // Agencia por titulares distintos bajo la misma identidad primaria.
  const titulares = new Map<string, Set<string>>();
  for (const q of input.quotes) {
    const k = ident(q.customerEmail, q.customerPhone).primaria;
    const h = q.holderNames?.trim().toLowerCase();
    if (!k || !h) continue;
    const s = titulares.get(k) || new Set<string>();
    s.add(h);
    titulares.set(k, s);
  }
  const quoteEsAgencia = (q: BQuote) => {
    const c = customers.get(q.customerId);
    const k = ident(q.customerEmail, q.customerPhone).primaria;
    return esAgencia({ ...(c || {}), titulares: k ? titulares.get(k)?.size ?? 0 : 0 });
  };

  const grupoDeQuote = new Map<string, Grupo>();
  const grupoDeOrder = new Map<string, Grupo>();
  const grupoDeLpr = new Map<string, Grupo>();
  const conPedido = new Set(input.orders.filter((o) => o.quoteId).map((o) => o.quoteId!));
  const cerrado = (g: Grupo) => g.orders.length > 0 || g.quotes.some((q) => quoteIntocable(q) || conPedido.has(q.id));

  // 1. Presupuestos
  const quotes = [...input.quotes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const q of quotes) {
    let g = existente(q.casoId, `presupuesto ${q.quoteNumber}`);
    if (!g) {
      const id = ident(q.customerEmail, q.customerPhone);
      const par = quotePar(q);
      const previos = new Map<string, BQuote>(); // grupo → su último presupuesto que casa
      const posiblesQ: string[] = [];
      if (id.keys.length) {
        for (const p of quotes) {
          if (p === q) break;
          const pg = grupoDeQuote.get(p.id);
          if (!pg || cerrado(pg)) continue;
          if (!paresCompatibles([par], [quotePar(p)])) continue;
          if (q.createdAt.getTime() - p.createdAt.getTime() > VENTANA_VERSION_DIAS * DAY) continue;
          const pid = ident(p.customerEmail, p.customerPhone);
          if (fuerteOTelefono(id, pid)) previos.set(pg.id, p);
          else if (compararIdentidad(id, pid) === "posible") posiblesQ.push(pg.id);
        }
      }
      const mismoDoc = [...previos].filter(
        ([, p]) => (q.expedienteRef && p.expedienteRef === q.expedienteRef) || q.fileKeys.some((k) => p.fileKeys.includes(k))
      );
      const conDocs = Boolean(q.expedienteRef) || q.fileKeys.length > 0;
      if (mismoDoc.length > 0) {
        mismoDoc.sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime());
        g = grupos.get(mismoDoc[0][0])!;
        for (const [gid] of mismoDoc.slice(1)) g.posibles.add(gid);
      } else if (previos.size > 0 && !conDocs) {
        const agencia = quoteEsAgencia(q);
        if (previos.size === 1 && !agencia) g = grupos.get([...previos.keys()][0])!;
        else {
          g = nuevoGrupo(`q:${q.id}`, id, q.customerName);
          g.motivos.push(`${q.quoteNumber}: sin documentos y ${agencia ? "cliente agencia" : `${previos.size} casos abiertos del mismo cliente`}`);
          for (const gid of previos.keys()) g.posibles.add(gid);
        }
      } else {
        g = nuevoGrupo(`q:${q.id}`, id, q.customerName);
        for (const gid of previos.keys()) g.posibles.add(gid);
      }
      for (const gid of posiblesQ) if (gid !== g.id) g.posibles.add(gid);
      g.tocado = true;
    }
    g.quotes.push(q);
    if (!g.identidad) {
      g.identidad = ident(q.customerEmail, q.customerPhone);
      g.nombre = q.customerName;
    }
    grupoDeQuote.set(q.id, g);
  }

  // 4a. Índices de sesiones (para pedidos sin presupuesto)
  const quotePorExp = new Map<string, BQuote>();
  for (const q of quotes) if (q.expedienteRef && !quotePorExp.has(q.expedienteRef)) quotePorExp.set(q.expedienteRef, q);

  // 2. Pedidos
  const orders = [...input.orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const o of orders) {
    let g = existente(o.casoId, `pedido ${o.reference}`);
    if (!g && o.quoteId) g = grupoDeQuote.get(o.quoteId) || null;
    if (!g) {
      for (const s of input.sesiones) {
        if (!s.orderIds.includes(o.id) && !s.orderRefs.includes(o.reference)) continue;
        const q = quotePorExp.get(sesionRef(s.token));
        const sg = (q && grupoDeQuote.get(q.id)) || null;
        if (sg) { g = sg; break; }
      }
    }
    if (!g) g = nuevoGrupo(`o:${o.id}`, ident(o.clientEmail, o.clientPhone), o.clientName);
    g.tocado = g.tocado || !o.casoId;
    g.orders.push(o);
    if (!g.identidad) { g.identidad = ident(o.clientEmail, o.clientPhone); g.nombre = o.clientName; }
    grupoDeOrder.set(o.id, g);
  }

  // 3. Solicitudes de precio
  const lprs = [...input.lprs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const l of lprs) {
    let g = existente(l.casoId, `solicitud ${l.ref}`);
    if (!g && l.quoteId) g = grupoDeQuote.get(l.quoteId) || null;
    if (!g && l.expedienteRef) {
      const q = quotes.find((x) => x.expedienteRef === l.expedienteRef && paresCompatibles([l.par], [quotePar(x)]));
      if (q) g = grupoDeQuote.get(q.id) || null;
    }
    if (!g && l.contentKey) {
      const otra = lprs.find((x) => x !== l && x.contentKey === l.contentKey && grupoDeLpr.has(x.id));
      if (otra) g = grupoDeLpr.get(otra.id)!;
    }
    if (!g) {
      const id = identDeHint(l.customerHint);
      const cerca = id.keys.length
        ? quotes.filter(
            (q) =>
              paresCompatibles([l.par], [quotePar(q)]) &&
              Math.abs(q.createdAt.getTime() - l.createdAt.getTime()) <= VENTANA_LPR_IDENTIDAD_DIAS * DAY &&
              fuerteOTelefono(id, ident(q.customerEmail, q.customerPhone))
          )
        : [];
      g = nuevoGrupo(`l:${l.id}`, id, null);
      if (cerca.length) {
        g.motivos.push(`${l.ref}: solo casa por identidad con ${cerca.map((q) => q.quoteNumber).join(", ")}`);
        for (const q of cerca) g.posibles.add(grupoDeQuote.get(q.id)!.id);
      }
    }
    g.tocado = g.tocado || !l.casoId;
    g.lprs.push(l);
    if (!g.identidad) g.identidad = identDeHint(l.customerHint);
    grupoDeLpr.set(l.id, g);
  }

  // 4. Sesiones
  const sinCaso: SinCaso[] = [];
  const lprPorExp = new Map<string, BLpr>();
  for (const l of lprs) if (l.expedienteRef && !lprPorExp.has(l.expedienteRef)) lprPorExp.set(l.expedienteRef, l);
  for (const s of input.sesiones) {
    if (s.analysisIds.length === 0) continue;
    const ya = [...new Set(s.casoIds)];
    if (ya.length > 1) conflictosAncla.push(`sesión ${s.token.slice(0, 12)}: análisis en ${ya.length} casos`);
    let g = existente(ya[0] ?? null, `sesión ${s.token.slice(0, 12)}`);
    const ref = sesionRef(s.token);
    if (!g) {
      const q = quotePorExp.get(ref);
      const l = lprPorExp.get(ref);
      const o = input.orders.find((x) => s.orderIds.includes(x.id) || s.orderRefs.includes(x.reference));
      g = (q && grupoDeQuote.get(q.id)) || (l && grupoDeLpr.get(l.id)) || (o && grupoDeOrder.get(o.id)) || null;
    }
    if (!g) {
      sinCaso.push({ tipo: "sesion", id: s.token, motivo: "lead de la puerta sin presupuesto, solicitud ni pedido" });
      continue;
    }
    if (s.analysisIds.length > 0) g.tocado = true;
    g.sesiones.push(s);
  }

  // 5. Entrantes
  const vida = (g: Grupo) => {
    const ts = [...g.quotes.map((q) => q.createdAt), ...g.orders.map((o) => o.createdAt), ...g.lprs.map((l) => l.createdAt)].map((d) => d.getTime());
    return ts.length ? { desde: Math.min(...ts) - 7 * DAY, hasta: Math.max(...ts) + 30 * DAY } : null;
  };
  for (const m of input.inbound) {
    let g = existente(m.casoId, `entrante ${m.id.slice(0, 8)}`);
    if (!g) {
      const q = quotePorExp.get(m.expedienteRef);
      const l = lprPorExp.get(m.expedienteRef);
      g = (q && grupoDeQuote.get(q.id)) || (l && grupoDeLpr.get(l.id)) || null;
    }
    if (!g) {
      const cand =
        (m.quoteId && grupoDeQuote.get(m.quoteId)) ||
        (m.orderReference && grupoDeOrder.get(input.orders.find((o) => o.reference === m.orderReference)?.id || "")) ||
        null;
      const v = cand ? vida(cand) : null;
      if (cand && v && m.receivedAt.getTime() >= v.desde && m.receivedAt.getTime() <= v.hasta) g = cand;
    }
    if (!g) {
      sinCaso.push({ tipo: "inbound", id: m.id, motivo: m.quoteId || m.orderReference ? "presupuesto/pedido atado fuera de la vida del caso" : "sin expediente ni presupuesto atado" });
      continue;
    }
    if (!m.casoId) g.tocado = true;
    g.inbound.push(m);
  }

  // 6. Estado y vigente
  const casos: CasoPlan[] = [];
  const sustituciones: Sustitucion[] = [];
  const conflictosVigente: string[] = [];
  for (const g of grupos.values()) {
    if (!g.tocado) continue;
    const vivos = g.quotes.filter((q) => !q.deletedAt);
    const yaVigente = g.nuevo ? null : vivos.find((q) => q.liveCasoKey === g.id) || null;
    const pedidosConQuote = g.orders
      .filter((o) => o.quoteId && vivos.some((q) => q.id === o.quoteId))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const porFecha = [...vivos].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const vigente =
      yaVigente ||
      (pedidosConQuote.length ? vivos.find((q) => q.id === pedidosConQuote[0].quoteId)! : null) ||
      porFecha[0] ||
      null;
    const aspirantes = vivos.filter((q) => quoteVivo(q) || quoteIntocable(q) || conPedido.has(q.id));
    if (aspirantes.length > 1) conflictosVigente.push(`${aspirantes.map((q) => `${q.quoteNumber}(${q.status})`).join(" + ")} → vigente ${vigente?.quoteNumber}`);
    if (new Set(pedidosConQuote.map((o) => o.quoteId)).size > 1) g.motivos.push(`${pedidosConQuote.length} pedidos de presupuestos distintos`);

    const vigentePagada = !!vigente && (quoteIntocable(vigente) || g.orders.some((o) => o.quoteId === vigente.id && o.paymentStatus === "PAID"));
    const cronologico = [...g.quotes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const q of g.quotes) {
      if (q === vigente) continue;
      const intocable = quoteIntocable(q);
      const siguiente = cronologico.find((x) => x.createdAt > q.createdAt);
      const supersededAt = !q.deletedAt && !intocable && !q.supersededAt ? (siguiente || vigente)?.createdAt ?? null : null;
      const notaSustituido = vigentePagada && q.status === "EXPIRED" && !q.lostReason && !q.lostReasonNote && !q.deletedAt;
      const quitarClave = q.liveCasoKey != null;
      if (supersededAt || notaSustituido || quitarClave) {
        sustituciones.push({ quoteId: q.id, quoteNumber: q.quoteNumber, casoId: g.id, quitarClave, supersededAt, notaSustituido, sigueViva: quoteVivo(q) });
      }
    }
    if (g.quotes.length > MAX_VERSIONES_SIN_DUDA) g.motivos.push(`cadena de ${g.quotes.length} presupuestos`);

    const vivo = (!!vigente && quoteVivo(vigente)) || g.lprs.some((l) => lprViva(l, ahora));
    let estado = estadoDeCaso({ pedidos: g.orders, vivo });
    if (!g.nuevo && esCasoEstado(g.estadoAnterior) && !puedeCaso(g.estadoAnterior, estado)) estado = g.estadoAnterior;

    const fechas = [
      ...g.quotes.flatMap((q) => [q.createdAt, q.paidAt]),
      ...g.orders.map((o) => o.createdAt),
      ...g.lprs.map((l) => l.createdAt),
      ...g.inbound.map((m) => m.receivedAt),
    ].filter((d): d is Date => d instanceof Date);
    const t = fechas.map((d) => d.getTime());
    const identidad = g.identidad || ident(null, null);
    const pares = [...new Set([...g.quotes.map(quotePar), ...g.orders.map((o) => normPar(o.langPair)), ...g.lprs.map((l) => normPar(l.par))].filter(Boolean))];
    const primerQuote = cronologico[0];
    const titularesAgencia = g.quotes.some(quoteEsAgencia);
    casos.push({
      id: g.id,
      nuevo: g.nuevo,
      estado,
      estadoAnterior: g.estadoAnterior,
      identityKey: identityKeyDe(identidad, g.anclaIdentidad),
      email: identidad.email,
      phone9: identidad.phone9,
      nombre: g.nombre,
      pares,
      esAgencia: titularesAgencia,
      dudoso: g.motivos.length > 0,
      motivos: g.motivos,
      posibles: [...g.posibles].filter((x) => x !== g.id),
      customerId: primerQuote?.customerId ?? null,
      createdAt: new Date(t.length ? Math.min(...t) : ahora.getTime()),
      lastActivityAt: new Date(t.length ? Math.max(...t) : ahora.getTime()),
      quoteIds: g.quotes.filter((q) => !q.casoId).map((q) => q.id),
      lprIds: g.lprs.filter((l) => !l.casoId).map((l) => l.id),
      orderIds: g.orders.filter((o) => !o.casoId).map((o) => o.id),
      analysisIds: g.sesiones.flatMap((s) => s.analysisIds),
      inboundIds: g.inbound.filter((m) => !m.casoId).map((m) => m.id),
      vigenteId: vigente && vigente.liveCasoKey !== g.id ? vigente.id : null,
      refs: [...g.quotes.map((q) => q.quoteNumber), ...g.orders.map((o) => o.reference), ...g.lprs.map((l) => l.ref)],
    });
  }
  return { casos, sustituciones, conflictosVigente, conflictosAncla, sinCaso };
}

export function casoCerradoEn(c: CasoPlan): Date | null {
  return casoTerminal(c.estado) || c.estado === "PERDIDO" ? c.lastActivityAt : null;
}

export const NOTA_SUSTITUIDO = AUTO_LOST_NOTES.REPLACED;
