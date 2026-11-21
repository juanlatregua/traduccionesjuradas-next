// lib/caso/hitos.ts — historia del caso (entradas, lavori, presupuestos, pedidos, rastro).
// La usan la ficha de Casos (/zona-traductor/casos/[id]) y la ficha de la mesa (/zona-traductor/caso/[id]).

import { decimalToNumber } from "@/lib/quotes";
import { quienEspera, hrefPedido, hrefPresupuesto, hrefSolicitud, type LprPaso } from "@/lib/caso/siguiente-paso";
import { nombreMiembro, ESTADO_LABEL } from "@/lib/caso/vista";

export type Hito = { at: Date; tipo: string; titulo: string; detalle?: string; href?: string };
export type Sesion = { at: Date; source: string | null; files: string[] };
type Ev = { con?: string[]; regla?: string; entrada?: string; de?: string; a?: string; motivo?: string | null; solicitud?: string | null; docsNuevos?: string[]; refs?: string[] };

const ENTRADA: Record<string, string> = { whatsapp: "WhatsApp", email: "email (hola@)", puerta: "puerta web" };
const eur = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;

/** Agrupa los análisis del caso por sesión de subida (una entrada = una sesión). */
export function sesionesDe(analyses: { sessionToken: string | null; source: string | null; fileName: string; createdAt: Date }[]): Map<string, Sesion> {
  const sesiones = new Map<string, Sesion>();
  for (const a of analyses) {
    const k = a.sessionToken || `suelto:${a.createdAt.toISOString()}`;
    const s = sesiones.get(k) || { at: a.createdAt, source: a.source, files: [] };
    s.files.push(a.fileName);
    sesiones.set(k, s);
  }
  return sesiones;
}

export function hitosDelCaso(c: {
  origen: string;
  sesiones: Map<string, Sesion>;
  inbound: { channel: string; receivedAt: Date; subject: string; fromEmail: string }[];
  priceRequests: (LprPaso & { updatedAt: Date; plazoDias: number | null; docsCount: number; words: number | null })[];
  quotes: { id: string; quoteNumber: string; total: unknown; autoPricedBy: string | null; createdAt: Date; sentAt: Date | null; openedAt: Date | null; paymentFrozenAt: Date | null; paidAt: Date | null; expiredAt: Date | null; supersededAt: Date | null; deletedAt: Date | null }[];
  orders: { reference: string; createdAt: Date; amountCents: number; status: string; traductor: string | null }[];
  eventos: { tipo: string; createdAt: Date; payload: unknown }[];
}): Hito[] {
  const hitos: Hito[] = [];
  for (const s of c.sesiones.values()) {
    hitos.push({
      at: s.at,
      tipo: "entrada",
      titulo: `Entrada por ${s.source === "whatsapp" ? "WhatsApp" : s.source === "staff" ? "el constructor" : "la puerta web"}`,
      detalle: `${s.files.length} documento${s.files.length === 1 ? "" : "s"}: ${s.files.slice(0, 4).join(", ")}${s.files.length > 4 ? "…" : ""}`,
    });
  }
  for (const m of c.inbound) {
    hitos.push({ at: m.receivedAt, tipo: "entrada", titulo: `${m.channel === "WHATSAPP" ? "WhatsApp" : "Email"} de ${m.fromEmail}`, detalle: m.subject, href: `/admin/inbox?vista=todos&canal=${m.channel === "WHATSAPP" ? "whatsapp" : "email"}` });
  }
  for (const l of c.priceRequests) {
    hitos.push({
      at: l.createdAt,
      tipo: "lavori",
      titulo: `Solicitud ${l.ref} a ${quienEspera(l, nombreMiembro)}`,
      detalle: `${l.par} · ${l.docsCount} doc${l.words ? ` · ~${l.words} palabras` : ""} · ${l.status}`,
      href: hrefSolicitud(l),
    });
    if (l.priceCents) {
      hitos.push({
        at: l.updatedAt,
        tipo: "lavori",
        titulo: `Precio de ${l.miembroNombre || "el jurado"}: ${eur(l.priceCents / 100)}${l.plazoDias ? ` · ${l.plazoDias} días` : ""}`,
        detalle: `${l.ref} · ${l.status}`,
        href: hrefSolicitud(l),
      });
    }
  }
  for (const q of c.quotes) {
    const href = hrefPresupuesto(q.id);
    const total = eur(decimalToNumber(q.total));
    hitos.push({ at: q.createdAt, tipo: "presupuesto", titulo: `Presupuesto ${q.quoteNumber} creado${q.autoPricedBy ? " (tarifario)" : ""}`, detalle: total, href });
    if (q.sentAt) hitos.push({ at: q.sentAt, tipo: "presupuesto", titulo: `${q.quoteNumber} enviado al cliente`, detalle: total, href });
    if (q.openedAt) hitos.push({ at: q.openedAt, tipo: "presupuesto", titulo: `${q.quoteNumber} abierto por el cliente`, href });
    if (q.paymentFrozenAt) hitos.push({ at: q.paymentFrozenAt, tipo: "alerta", titulo: `${q.quoteNumber}: pago congelado`, href });
    if (q.paidAt) hitos.push({ at: q.paidAt, tipo: "pedido", titulo: `${q.quoteNumber} pagado`, detalle: total, href });
    if (q.expiredAt) hitos.push({ at: q.expiredAt, tipo: "presupuesto", titulo: `${q.quoteNumber} caducado`, href });
    if (q.supersededAt) hitos.push({ at: q.supersededAt, tipo: "presupuesto", titulo: `${q.quoteNumber} sustituido`, href });
    if (q.deletedAt) hitos.push({ at: q.deletedAt, tipo: "presupuesto", titulo: `${q.quoteNumber} eliminado`, href });
  }
  for (const o of c.orders) {
    hitos.push({
      at: o.createdAt,
      tipo: "pedido",
      titulo: `Pedido ${o.reference}`,
      detalle: `${eur(o.amountCents / 100)} · ${o.status}${o.traductor ? ` · ${o.traductor}` : ""}`,
      href: hrefPedido(o.reference),
    });
  }
  for (const e of c.eventos) {
    const p = (e.payload || {}) as Ev;
    const t =
      e.tipo === "creado"
        ? { titulo: `Caso creado (${ENTRADA[p.entrada || ""] || p.entrada || c.origen})`, detalle: p.regla }
        : e.tipo === "adjuntado"
          ? { titulo: `Añadido al caso desde ${ENTRADA[p.entrada || ""] || p.entrada || "?"}`, detalle: p.regla }
          : e.tipo === "posible"
            ? { titulo: "Puede ser el mismo encargo que otro caso", detalle: p.regla }
            : e.tipo === "transicion"
              ? { titulo: `Estado ${ESTADO_LABEL[p.de || ""] || p.de} → ${ESTADO_LABEL[p.a || ""] || p.a}`, detalle: p.motivo || undefined }
              : e.tipo === "aviso_humano"
                ? { titulo: "Aviso a staff: pide presupuesto humano", detalle: p.solicitud ? `con ${p.solicitud}` : undefined }
                : e.tipo === "aviso_humano_repetido"
                  ? { titulo: "El cliente ha vuelto a pedir (aviso corto)" }
                  : e.tipo === "backfill"
                    ? { titulo: "Caso reconstruido desde el histórico", detalle: (p.refs || []).join(", ") }
                    : e.tipo === "fallo_resolver"
                      ? { titulo: "Fallo del resolver" }
                      : { titulo: e.tipo };
    hitos.push({ at: e.createdAt, tipo: "caso", ...t });
  }
  return hitos.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Ids de otros casos que pueden ser el mismo encargo (eventos «posible»). */
export const idsPosibles = (eventos: { tipo: string; payload: unknown }[]) => [...new Set(eventos.filter((e) => e.tipo === "posible").flatMap((e) => (e.payload as Ev | null)?.con || []))];
