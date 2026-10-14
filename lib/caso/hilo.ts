// lib/caso/hilo.ts — F3b, lógica PURA del hilo único: una solicitud lavori viva por
// caso+par, un presupuesto vivo por caso y el coste que manda la cifra del jurado.
// El acceso a BD vive en lib/caso/hilo-db.ts.

import { lprViva, quoteVivo, quotePagable, QUOTE_FORMALIZADOS } from "./estados.ts";
import { normPar } from "./resolver.ts";

export type LprDelHilo = {
  id: string;
  ref: string;
  par: string;
  status: string;
  priceCents: number | null;
  quoteId: string | null;
  createdAt: Date;
  /** Estado del presupuesto atado (quoteId), si lo hay. */
  quoteStatus?: string | null;
};

const QUOTE_ENVIADO = ["SENT", "OPENED", "ACCEPTED"];

const PESO_ESTADO: Record<string, number> = { ACCEPTED: 3, PRICED: 2 };

/** Vivas del mismo par: primero la que ya tiene jurado o cifra, luego la más reciente. */
export function vivasDelPar<T extends LprDelHilo>(lprs: T[], par: string, ahora: Date): T[] {
  const p = normPar(par);
  if (!p) return [];
  return lprs
    .filter((l) => normPar(l.par) === p && lprViva(l, ahora))
    .sort((a, b) => (PESO_ESTADO[b.status] || 0) - (PESO_ESTADO[a.status] || 0) || b.createdAt.getTime() - a.createdAt.getTime());
}

export type DecisionSolicitud<T extends LprDelHilo = LprDelHilo> =
  | { accion: "crear" }
  | { accion: "reutilizar"; viva: T }
  | { accion: "reemplazar"; retirar: T[]; quoteId: string | null; congelar: string[] }
  | { accion: "esperar"; viva: T }
  | { accion: "bloquear"; viva: T; motivo: string };

/**
 * Pedir precio en un caso: con solicitud viva del par se reutiliza (nunca otra).
 * «Volver a pedir» retira TODAS las vivas del par y crea una nueva que hereda su
 * presupuesto; si alguna está retirándose ahora mismo, se espera. Nunca se retira
 * una aceptada en lavori ni una atada a un presupuesto ya formalizado. congelar =
 * presupuestos enviados sin pagar que llevan la cifra que se retira.
 */
export function decidirSolicitud<T extends LprDelHilo>(i: { lprs: T[]; par: string; ahora: Date; volverAPedir?: boolean }): DecisionSolicitud<T> {
  const vivas = vivasDelPar(i.lprs, i.par, i.ahora);
  if (vivas.length === 0) return { accion: "crear" };
  if (!i.volverAPedir) return { accion: "reutilizar", viva: vivas[0] };
  const retirando = vivas.find((l) => l.status === "RETIRING");
  if (retirando) return { accion: "esperar", viva: retirando };
  const aceptada = vivas.find((l) => l.status === "ACCEPTED");
  if (aceptada) return { accion: "bloquear", viva: aceptada, motivo: `${aceptada.ref} ya está aceptada en lavori: no se retira desde aquí` };
  const formalizada = vivas.find((l) => (QUOTE_FORMALIZADOS as readonly string[]).includes(String(l.quoteStatus || "")));
  if (formalizada) return { accion: "bloquear", viva: formalizada, motivo: `${formalizada.ref} está atada a un presupuesto ya pagado (${formalizada.quoteStatus})` };
  const congelar = [
    ...new Set(vivas.filter((l) => l.status === "PRICED" && !!l.priceCents && !!l.quoteId && QUOTE_ENVIADO.includes(String(l.quoteStatus || ""))).map((l) => l.quoteId!)),
  ];
  return { accion: "reemplazar", retirar: vivas, quoteId: vivas.find((l) => l.quoteId)?.quoteId ?? null, congelar };
}

export type QuoteDelHilo = {
  id: string;
  quoteNumber?: string | null;
  status: string;
  deletedAt: Date | null;
  lostReason: string | null;
  lostReasonNote?: string | null;
  liveCasoKey: string | null;
  supersededAt?: Date | null;
  expiredAt?: Date | null;
  createdAt: Date;
  sourceLang: string | null;
  targetLang: string | null;
};

/** El presupuesto del caso y par que el cliente aún puede pagar o que sigue vivo (la vigente primero). Par desconocido → null. */
export function presupuestoDelHilo<T extends QuoteDelHilo>(quotes: T[], casoId: string, par: string | null | undefined): T | null {
  const p = normPar(par);
  if (!p) return null;
  const abiertos = quotes.filter(
    (q) => normPar(`${q.sourceLang || ""}>${q.targetLang || ""}`) === p && !q.deletedAt && !q.expiredAt && !q.supersededAt && (quoteVivo(q) || quotePagable(q))
  );
  return (
    abiertos.find((q) => q.liveCasoKey === casoId) ||
    [...abiertos].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ||
    null
  );
}

/**
 * Borrador que el alta de /api/quotes retira ella misma (mismo cliente y par, sin
 * enviar, ≤2 h): no cuenta como «ya hay presupuesto» porque se sustituye, no se duplica.
 */
export function esBorradorSustituible(
  q: { status: string; createdAt: Date; customerEmail: string | null; sourceLang: string | null; targetLang: string | null; expedienteRef: string | null; envios: number; pedidos: number },
  nuevo: { customerEmail: string; sourceLang: string; targetLang: string; expedienteRef: string | null },
  ahora: Date
): boolean {
  return (
    q.status === "DRAFT" &&
    q.envios === 0 &&
    q.pedidos === 0 &&
    ahora.getTime() - q.createdAt.getTime() <= 2 * 3_600_000 &&
    q.customerEmail === nuevo.customerEmail &&
    q.sourceLang === nuevo.sourceLang &&
    q.targetLang === nuevo.targetLang &&
    (q.expedienteRef ?? null) === (nuevo.expedienteRef ?? null)
  );
}

/** Retira en orden y para en el primer fallo: devuelve lo ya retirado (para el rastro) y el fallo. */
export async function retirarEnOrden<T extends { ref: string }>(
  lprs: T[],
  retirar: (l: T) => Promise<{ ok: true } | { ok: false; status: number; error: string }>
): Promise<{ retiradas: string[]; fallo: { ref: string; status: number; error: string } | null }> {
  const retiradas: string[] = [];
  for (const l of lprs) {
    const r = await retirar(l);
    if (!r.ok) return { retiradas, fallo: { ref: l.ref, status: r.status, error: r.error } };
    retiradas.push(l.ref);
  }
  return { retiradas, fallo: null };
}

/** Reserva del hilo (caso+par) mientras se pide precio: dura RESERVA_MIN minutos como mucho. */
export const RESERVA_MIN = 5;
export function reservaViva(payload: unknown, ahora: Date): boolean {
  const exp = Date.parse(String((payload as { expiresAt?: unknown } | null)?.expiresAt || ""));
  return Number.isFinite(exp) && exp > ahora.getTime();
}

/** Solo un envío correcto a lavori congela el presupuesto enviado: si falla, nada se congela. */
export function quotesACongelar(envioOk: boolean, congelar: string[]): string[] {
  return envioOk ? congelar : [];
}
