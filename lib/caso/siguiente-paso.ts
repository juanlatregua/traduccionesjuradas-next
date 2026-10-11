// lib/caso/siguiente-paso.ts — F3a, lógica PURA: «qué toca ahora» en un caso.
// Un solo paso y un solo botón. Orden: pago congelado (pierde dinero) > pedido >
// presupuesto vigente > solicitud viva a lavori > nada vivo.

import { estadoPorPedidos, lprViva, quotePagable, quoteVivo, type PedidoParaEstado } from "./estados.ts";

export type QuotePaso = {
  id: string;
  quoteNumber: string;
  status: string;
  deletedAt: Date | null;
  lostReason: string | null;
  lostReasonNote: string | null;
  liveCasoKey: string | null;
  supersededAt: Date | null;
  expiredAt: Date | null;
  paymentFrozenAt: Date | null;
  paidAt: Date | null;
  sentAt: Date | null;
  openedAt: Date | null;
  publicToken: string;
  createdAt: Date;
};
export type LprPaso = {
  ref: string;
  par: string;
  status: string;
  priceCents: number | null;
  miembroNombre: string | null;
  candidatos: string[];
  quoteId: string | null;
  expedienteRef: string | null;
  createdAt: Date;
};
export type PedidoPaso = PedidoParaEstado & { reference: string };

/** accion = te toca a ti · jurado/cliente = esperando a otro · en_curso = pedido trabajándose · cerrado = nada que hacer. */
export type GrupoPaso = "accion" | "jurado" | "cliente" | "en_curso" | "cerrado";
export type AccionPaso = { label: string; href: string; copiar?: boolean };
export type Paso = {
  clave:
    | "congelado"
    | "pedido_sin_cobrar"
    | "pedido_en_curso"
    | "entregado"
    | "cancelado"
    | "borrador"
    | "presupuesto_enviado"
    | "pagable_cerrado"
    | "presupuesto_muerto"
    | "precio_recibido"
    | "esperando_precio"
    | "jurado_no_responde"
    | "sin_nada"
    | "perdido";
  grupo: GrupoPaso;
  titulo: string;
  detalle?: string;
  accion: AccionPaso | null;
};

/** Horas sin precio del jurado a partir de las cuales esperar pasa a ser tarea tuya. */
export const ESPERA_JURADO_HORAS = 24;

const fmtHora = (d: Date) =>
  d.toLocaleString("es-ES", { timeZone: "Europe/Madrid", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const eur = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

export const hrefPresupuesto = (quoteId: string) => `/zona-traductor/presupuestos/${quoteId}`;
export const hrefPedido = (reference: string) => `/zona-traductor/pedido/${encodeURIComponent(reference)}`;
export const hrefCaso = (casoId: string) => `/zona-traductor/casos/${casoId}`;
/** Igual que la lista «Solicitudes de precio en lavori»: builder atado a la solicitud. */
export function hrefSolicitud(l: { ref: string; expedienteRef: string | null }): string {
  const exp = l.expedienteRef && !l.expedienteRef.startsWith("puerta:") ? `&exp=${encodeURIComponent(l.expedienteRef)}` : "";
  return `/zona-traductor/presupuesto?lead=${encodeURIComponent(l.ref)}${exp}`;
}
export const urlPublicaQuote = (baseUrl: string, publicToken: string) => `${baseUrl.replace(/\/$/, "")}/q/${publicToken}`;

/** Vigente: la que tiene la clave del caso y sigue viva; si nadie la tiene, la viva más reciente. */
export function quoteVigente<Q extends QuotePaso>(casoId: string, quotes: Q[]): Q | null {
  const vivas = quotes.filter((q) => quoteVivo(q));
  return vivas.find((q) => q.liveCasoKey === casoId) || [...vivas].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] || null;
}

export function quienEspera(l: LprPaso, nombreDe?: (miembroId: string) => string | null | undefined): string {
  if (l.miembroNombre) return l.miembroNombre;
  const nombres = l.candidatos.map((id) => nombreDe?.(id)).filter((n): n is string => Boolean(n));
  if (nombres.length) return nombres.join(", ");
  return l.candidatos.length === 1 ? "1 jurado" : `${l.candidatos.length} jurados`;
}

export function siguientePaso(i: {
  casoId: string;
  estado: string;
  quotes: QuotePaso[];
  lprs: LprPaso[];
  pedidos: PedidoPaso[];
  baseUrl: string;
  ahora: Date;
  sesion?: string | null; // última sesión de la puerta: el builder importa sus documentos
  nombreDe?: (miembroId: string) => string | null | undefined;
}): Paso {
  const congelado = i.quotes.find((q) => q.paymentFrozenAt && !q.deletedAt && (q.paidAt || quoteVivo(q)));
  if (congelado) {
    return {
      clave: "congelado",
      grupo: "accion",
      titulo: congelado.paidAt ? `Cobrado con el pago congelado (${congelado.quoteNumber})` : `Pago congelado (${congelado.quoteNumber})`,
      detalle: congelado.paidAt ? "No se ha asignado al jurado: decide en la ficha del presupuesto." : "El precio del jurado deja pérdida: el cliente no puede pagar.",
      accion: { label: "Ir al presupuesto", href: hrefPresupuesto(congelado.id) },
    };
  }

  const porPedidos = estadoPorPedidos(i.pedidos);
  if (porPedidos) {
    const activos = i.pedidos.filter((p) => p.status !== "CANCELLED" && p.paymentStatus !== "REFUNDED");
    const abierto = activos.find((p) => estadoPorPedidos([p]) === "EN_CURSO") || activos[0] || i.pedidos[0];
    const ver = { label: "Ver pedido", href: hrefPedido(abierto.reference) };
    if (porPedidos === "CANCELADO") return { clave: "cancelado", grupo: "cerrado", titulo: `Pedido ${abierto.reference} cancelado`, accion: ver };
    if (porPedidos === "ENTREGADO") return { clave: "entregado", grupo: "cerrado", titulo: `Pedido ${abierto.reference} entregado`, accion: ver };
    if (abierto.paymentStatus !== "PAID") {
      return { clave: "pedido_sin_cobrar", grupo: "cliente", titulo: `Pedido ${abierto.reference} sin cobrar`, detalle: "Pendiente de pago (o a crédito).", accion: ver };
    }
    return { clave: "pedido_en_curso", grupo: "en_curso", titulo: `Pedido ${abierto.reference} en curso`, accion: ver };
  }

  const vigente = quoteVigente(i.casoId, i.quotes);
  if (vigente) {
    if (vigente.status === "DRAFT") {
      return {
        clave: "borrador",
        grupo: "accion",
        titulo: `Borrador ${vigente.quoteNumber} sin enviar`,
        accion: { label: "Revisar y enviar", href: hrefPresupuesto(vigente.id) },
      };
    }
    const visto = vigente.openedAt ? `abierto el ${fmtHora(vigente.openedAt)}` : "sin abrir todavía";
    return {
      clave: "presupuesto_enviado",
      grupo: "cliente",
      titulo: `Presupuesto ${vigente.quoteNumber} ${vigente.status === "ACCEPTED" ? "aceptado, falta el pago" : "enviado"}`,
      detalle: `${vigente.sentAt ? `Enviado el ${fmtHora(vigente.sentAt)} · ` : ""}${visto}`,
      accion: { label: "Copiar enlace /q", href: urlPublicaQuote(i.baseUrl, vigente.publicToken), copiar: true },
    };
  }

  // Cerrado por silencio (o pago iniciado con motivo de pérdida) pero aún pagable: se espera al cliente.
  const pagable = i.quotes.filter((q) => quotePagable(q)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (pagable) {
    return {
      clave: "pagable_cerrado",
      grupo: "cliente",
      titulo: `Esperando cliente: ${pagable.quoteNumber} ${pagable.status === "ACCEPTED" ? "con pago iniciado" : "cerrado por silencio"} · aún puede pagar`,
      detalle: `${pagable.sentAt ? `Enviado el ${fmtHora(pagable.sentAt)} · ` : ""}${pagable.openedAt ? `abierto el ${fmtHora(pagable.openedAt)}` : "sin abrir"}`,
      accion: { label: "Copiar enlace /q", href: urlPublicaQuote(i.baseUrl, pagable.publicToken), copiar: true },
    };
  }

  // Una solicitud que ya tuvo presupuesto (aunque haya muerto) no vuelve a pedir que se monte otro.
  const vivas = i.lprs
    .filter((l) => lprViva(l, i.ahora) && !l.quoteId)
    .sort((a, b) => Number(b.status === "PRICED") - Number(a.status === "PRICED") || b.createdAt.getTime() - a.createdAt.getTime());
  const lpr = vivas[0];
  if (lpr) {
    if (lpr.status === "PRICED" && lpr.priceCents) {
      return {
        clave: "precio_recibido",
        grupo: "accion",
        titulo: `Precio recibido: ${eur(lpr.priceCents)} de ${lpr.miembroNombre || "el jurado"}`,
        detalle: `${lpr.ref} · ${lpr.par}`,
        accion: { label: "Montar presupuesto", href: hrefSolicitud(lpr) },
      };
    }
    const horas = (i.ahora.getTime() - lpr.createdAt.getTime()) / 36e5;
    const tarde = horas >= ESPERA_JURADO_HORAS;
    return {
      clave: tarde ? "jurado_no_responde" : "esperando_precio",
      grupo: tarde ? "accion" : "jurado",
      titulo: `Esperando precio de ${quienEspera(lpr, i.nombreDe)} desde ${fmtHora(lpr.createdAt)}`,
      detalle: `${lpr.ref} · ${lpr.par}${tarde ? ` · ${Math.floor(horas)} h sin respuesta` : ""}`,
      accion: { label: tarde ? "Recordar o cambiar de jurado" : "Abrir solicitud", href: hrefSolicitud(lpr) },
    };
  }

  const ultimo = i.quotes.filter((q) => !q.deletedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (ultimo) {
    return {
      clave: "presupuesto_muerto",
      grupo: "cerrado",
      titulo: `Presupuesto ${ultimo.quoteNumber} ${ultimo.status === "EXPIRED" || ultimo.expiredAt ? "caducado" : ultimo.lostReason ? "no aceptado" : "sin vida"}`,
      accion: { label: "Ir al presupuesto", href: hrefPresupuesto(ultimo.id) },
    };
  }
  if (i.estado === "ABIERTO") {
    return {
      clave: "sin_nada",
      grupo: "accion",
      titulo: "Sin presupuesto ni solicitud a lavori",
      accion: {
        label: "Montar presupuesto",
        href: i.sesion ? `/zona-traductor/presupuesto?session=${encodeURIComponent(i.sesion)}` : "/zona-traductor/presupuesto",
      },
    };
  }
  return { clave: "perdido", grupo: "cerrado", titulo: i.estado === "PERDIDO" ? "Perdido: nada vivo" : `Cerrado (${i.estado})`, accion: null };
}
