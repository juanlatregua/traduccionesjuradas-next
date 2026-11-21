// lib/mesa/montones.ts — R3 «mesa del gestor», lógica PURA: cada caso vivo va a UNO de tres
// montones por turno (decisión de Juan 18-nov, portada A): me toca · espero a otro (con reloj) ·
// en marcha. El «qué toca» sale de siguientePaso (lib/caso); aquí solo se decide el montón,
// el reloj y el botón. Sin lógica de dinero.

import { siguientePaso, quoteVigente, hrefPedido, ESPERA_JURADO_HORAS, type AccionPaso, type LprPaso, type PedidoPaso, type QuotePaso } from "../caso/siguiente-paso.ts";
import { lprViva } from "../caso/estados.ts";
import { CLOSE_AFTER_HOURS, REMINDER_AFTER_HOURS, SEND_OVERDUE_HOURS } from "../cierre-math.ts";
import { deadlineLine, isUrgentDeadline } from "../needed-by.ts";
import type { SlaLead } from "../lead-sla-core.ts";

/** Regla de Juan: al lead se le contesta con presupuesto en 3 h (los clientes piden a varias agencias). */
export const PLAZO_LEAD_HORAS = 3;

export type Monton = "yo" | "espera" | "marcha";
export const MONTONES: { key: Monton; titulo: string; sub: string }[] = [
  { key: "yo", titulo: "Me toca a mí", sub: "Lo que espera una acción tuya." },
  { key: "espera", titulo: "Espero a otro", sub: "Cliente o jurado, cada uno con su reloj." },
  { key: "marcha", titulo: "En marcha", sub: "Nada que hacer ahora." },
];

export type PedidoMesa = PedidoPaso & {
  langPair: string | null;
  dueDate: Date | null;
  /** Jurado externo que lo traduce (asignación ganadora o assignedTo); null = nadie. */
  traductor: string | null;
  /** Plazo que dio el jurado al aceptar (CollaboratorAssignment.quotedDeadline). */
  plazoJurado: Date | null;
  /** getTranslatorDeliveredAt: el jurado ya subió su entrega. */
  entregaJuradoAt: Date | null;
};
export type LprMesa = LprPaso & { updatedAt: Date };

export type CasoMesa = {
  id: string;
  ref: string;
  estado: string;
  nombre: string | null;
  email: string | null;
  phone9: string | null;
  pares: string[];
  origen: string;
  dudoso: boolean;
  urgency: string | null;
  neededBy: Date | null;
  createdAt: Date;
  lastActivityAt: Date;
  quotes: QuotePaso[];
  lprs: LprMesa[];
  pedidos: PedidoMesa[];
  sesion: string | null;
};

export type RelojTipo = "lead" | "precio_jurado" | "enviar" | "recordatorio" | "cierre" | "entrega" | "entrega_jurado";
export type Reloj = { tipo: RelojTipo; vence: Date; texto: string; estado: "ok" | "pronto" | "vencido" };

export type Tarjeta = {
  key: string;
  casoId: string | null;
  ref: string | null;
  cliente: string;
  contacto: string | null;
  pares: string[];
  canal: string;
  monton: Monton;
  clave: string;
  titulo: string;
  detalle?: string;
  reloj: Reloj | null;
  plazoCliente: string | null;
  urgente: boolean;
  dudoso: boolean;
  accion: AccionPaso | null;
  ficha: string | null;
  entro: Date;
};

export type Mesa = { yo: Tarjeta[]; espera: Tarjeta[]; marcha: Tarjeta[]; vencidos: number; entreganHoy: number };

const TZ = "Europe/Madrid";
const H = 36e5;
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const diasCalendario = (d: Date, ahora: Date) => Math.round((Date.parse(ymd(d)) - Date.parse(ymd(ahora))) / 864e5);
const hhmm = (d: Date) => d.toLocaleTimeString("es-ES", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const diaCorto = (d: Date) => d.toLocaleDateString("es-ES", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });
const cuando = (d: Date, ahora: Date) => {
  const dias = diasCalendario(d, ahora);
  return dias === 0 ? `a las ${hhmm(d)}` : dias === 1 ? `mañana a las ${hhmm(d)}` : `el ${diaCorto(d)} a las ${hhmm(d)}`;
};
export function duracion(ms: number): string {
  const min = Math.max(0, Math.round(Math.abs(ms) / 6e4));
  if (min < 60) return `${min} min`;
  if (min < 48 * 60) return `${Math.floor(min / 60)} h${min % 60 ? ` ${String(min % 60).padStart(2, "0")} min` : ""}`;
  return `${Math.floor(min / 1440)} días`;
}

function relojHoras(tipo: RelojTipo, vence: Date, ahora: Date, antes: (c: string, resta: string) => string, despues: (hace: string) => string, sinPrisa = false): Reloj {
  const diff = vence.getTime() - ahora.getTime();
  const estado = sinPrisa ? "ok" : diff < 0 ? "vencido" : diff <= H ? "pronto" : "ok";
  return { tipo, vence, estado, texto: diff < 0 ? despues(duracion(diff)) : antes(cuando(vence, ahora), duracion(diff)) };
}

function relojDia(tipo: RelojTipo, vence: Date, ahora: Date, que: string): Reloj {
  const dias = diasCalendario(vence, ahora);
  const texto =
    dias < 0 ? `${que}: atrasado ${-dias} ${dias === -1 ? "día" : "días"} (${diaCorto(vence)})` : dias === 0 ? `${que}: hoy` : dias === 1 ? `${que}: mañana` : `${que}: ${diaCorto(vence)} (en ${dias} días)`;
  return { tipo, vence, texto, estado: dias < 0 ? "vencido" : dias <= 1 ? "pronto" : "ok" };
}

export const relojLead = (desde: Date, ahora: Date) =>
  relojHoras(
    "lead",
    new Date(desde.getTime() + PLAZO_LEAD_HORAS * H),
    ahora,
    (c, resta) => `Responder ${c} (quedan ${resta})`,
    (hace) => `Plazo de ${PLAZO_LEAD_HORAS} h pasado hace ${hace}`
  );

const ORIGEN: Record<string, string> = {
  puerta: "Web",
  puerta_pago: "Web",
  "entrada:web": "Web",
  whatsapp: "WhatsApp",
  email: "Email",
  constructor: "Constructor",
  expediente: "Expediente",
  price_request: "lavori",
  backfill: "Histórico",
};
export const canalDe = (origen: string) => ORIGEN[origen] || origen;

const esFr = (par: string | null | undefined) => /(^|[^a-z])fr([^a-z]|$)/i.test(String(par || ""));
/** Lo traduce Juan: francés sin jurado externo (o con él mismo puesto como traductor). */
export const esPropio = (p: Pick<PedidoMesa, "langPair" | "traductor">) => esFr(p.langPair) && (!p.traductor || /juan silva/i.test(p.traductor));

const pedidoAbierto = (p: PedidoMesa) => p.paymentStatus === "PAID" && p.status !== "CANCELLED" && p.status !== "DELIVERED" && p.deliveryState !== "TRADUCIDO";

export function clasificarCaso(c: CasoMesa, ahora: Date, baseUrl: string, nombreDe?: (miembroId: string) => string | null | undefined): Tarjeta | null {
  const paso = siguientePaso({ casoId: c.id, estado: c.estado, quotes: c.quotes, lprs: c.lprs, pedidos: c.pedidos, baseUrl, ahora, sesion: c.sesion, nombreDe });
  if (paso.grupo === "cerrado") return null;
  // Igual que la lista de Casos: un PERDIDO solo sigue vivo si su presupuesto aún se puede pagar.
  if (c.estado === "PERDIDO" && paso.clave !== "pagable_cerrado") return null;

  const deadline = c.urgency || c.neededBy ? { urgency: c.urgency, neededBy: c.neededBy } : null;
  const t: Tarjeta = {
    key: c.id,
    casoId: c.id,
    ref: c.ref,
    cliente: c.nombre || c.email || (c.phone9 ? `+34 ${c.phone9}` : "(sin identificar)"),
    contacto: c.email || (c.phone9 ? `+34 ${c.phone9}` : null),
    pares: c.pares,
    canal: canalDe(c.origen),
    monton: paso.grupo === "accion" ? "yo" : paso.grupo === "en_curso" ? "marcha" : "espera",
    clave: paso.clave,
    titulo: paso.titulo,
    detalle: paso.detalle,
    reloj: null,
    plazoCliente: deadlineLine(deadline, ahora),
    urgente: isUrgentDeadline(deadline, ahora),
    dudoso: c.dudoso,
    accion: paso.accion,
    ficha: `/zona-traductor/caso/${c.id}`,
    entro: c.createdAt,
  };

  switch (paso.clave) {
    case "sin_nada":
      t.reloj = relojLead(c.createdAt, ahora);
      break;
    case "borrador":
      // El borrador todavía no ha llegado al cliente: si el caso es de hoy, corre el reloj del lead.
      if (ahora.getTime() - c.createdAt.getTime() < 24 * H) t.reloj = relojLead(c.createdAt, ahora);
      break;
    case "precio_recibido": {
      const l = c.lprs.filter((x) => x.status === "PRICED" && x.priceCents && !x.quoteId && lprViva(x, ahora)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
      if (l)
        t.reloj = relojHoras("enviar", new Date(l.updatedAt.getTime() + SEND_OVERDUE_HOURS * H), ahora, (cu) => `Enviar el presupuesto ${cu}`, (hace) => `Precio recibido: envío pendiente desde hace ${hace}`);
      break;
    }
    case "esperando_precio":
    case "jurado_no_responde": {
      const l = c.lprs.filter((x) => lprViva(x, ahora) && !x.quoteId && x.status !== "PRICED").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (l)
        t.reloj = relojHoras(
          "precio_jurado",
          new Date(l.createdAt.getTime() + ESPERA_JURADO_HORAS * H),
          ahora,
          (cu) => `Si no da precio, pasa a ti ${cu}`,
          (hace) => `Sin precio: ${ESPERA_JURADO_HORAS} h cumplidas hace ${hace}`
        );
      break;
    }
    case "presupuesto_enviado": {
      const q = quoteVigente(c.id, c.quotes);
      if (q?.sentAt) {
        const recordatorio = new Date(q.sentAt.getTime() + REMINDER_AFTER_HOURS * H);
        const cierre = new Date(recordatorio.getTime() + CLOSE_AFTER_HOURS * H);
        if (ahora < recordatorio) t.reloj = relojHoras("recordatorio", recordatorio, ahora, (cu) => `Recordatorio automático ${cu}`, () => "", true);
        else if (ahora < cierre) t.reloj = relojHoras("cierre", cierre, ahora, (cu) => `Si no contesta, se cierra solo ${cu}`, () => "", true);
      }
      break;
    }
    case "pedido_en_curso": {
      const p = c.pedidos.find(pedidoAbierto);
      if (!p) break;
      const ver = (label: string) => ({ label, href: hrefPedido(p.reference) });
      const entrega = p.dueDate ? relojDia("entrega", p.dueDate, ahora, "Entrega al cliente") : null;
      if (p.entregaJuradoAt) {
        Object.assign(t, { monton: "yo", clave: "verificar_entrega", titulo: `${p.traductor || "El jurado"} ya entregó: verificar y enviar al cliente`, detalle: p.reference, accion: ver("Verificar y entregar"), reloj: entrega });
      } else if (esPropio(p)) {
        const pronto = !p.dueDate || diasCalendario(p.dueDate, ahora) <= 1;
        Object.assign(t, {
          monton: pronto ? "yo" : "marcha",
          clave: "traducir_yo",
          titulo: `Traduces tú (${p.langPair || "francés"})`,
          detalle: p.dueDate ? p.reference : `${p.reference} · sin fecha de entrega: ponla en el pedido`,
          accion: ver(pronto ? "Abrir el pedido" : "Ver pedido"),
          reloj: entrega,
        });
      } else if (!p.traductor) {
        Object.assign(t, { monton: "yo", clave: "sin_traductor", titulo: "Pagado y sin traductor: asignarlo", detalle: `${p.reference} · ${p.langPair || "par sin indicar"}`, accion: ver("Asignar traductor"), reloj: entrega });
      } else {
        const plazo = p.plazoJurado || p.dueDate;
        const r = plazo ? relojDia("entrega_jurado", plazo, ahora, `Entrega de ${p.traductor}`) : null;
        const tarde = r?.estado === "vencido";
        Object.assign(t, {
          monton: tarde ? "yo" : "espera",
          clave: tarde ? "jurado_tarde" : "traduce_jurado",
          titulo: tarde ? `${p.traductor} no ha entregado y el plazo ha pasado` : `Traduce ${p.traductor}`,
          detalle: `${p.reference} · ${p.langPair || ""}`.replace(/ · $/, ""),
          accion: ver(tarde ? "Reclamar entrega" : "Ver pedido"),
          reloj: r || entrega,
        });
      }
      break;
    }
  }
  return t;
}

const norm = (e: string | null | undefined) => (e || "").trim().toLowerCase();
const nueve = (p: string | null | undefined) => String(p || "").replace(/\D/g, "").slice(-9);
const SITE = /^https?:\/\/(www\.)?traduccionesjuradas\.net/;

/** Leads de lib/lead-sla (puerta, email, WhatsApp, lavori) que todavía no están en ninguna tarjeta. */
export function tarjetasDeLeads(leads: SlaLead[], yaEnMesa: Tarjeta[], ahora: Date): Tarjeta[] {
  const emails = new Set(yaEnMesa.map((t) => norm(t.contacto)).filter((x) => x.includes("@")));
  const tels = new Set(yaEnMesa.map((t) => nueve(t.contacto)).filter((x) => x.length === 9));
  return leads
    .filter((l) => !(l.email && emails.has(norm(l.email))) && !(l.phone && tels.has(nueve(l.phone))))
    .map((l) => {
      const link = (l.links[0] || "").replace(SITE, "") || "/zona-traductor/presupuesto";
      return {
        key: `lead:${l.root}`,
        casoId: null,
        ref: null,
        cliente: l.name || l.email || l.phone || "Lead",
        contacto: l.email || l.phone,
        pares: l.pairs.filter((p) => !p.includes("?")),
        canal: l.via.map((v) => (v === "puerta" ? "Web" : v === "email" ? "Email" : v === "whatsapp" ? "WhatsApp" : v)).join(" / "),
        monton: "yo" as const,
        clave: "lead",
        titulo: "Lead sin presupuesto",
        detalle: l.links.length > 1 ? `${l.links.length} entradas` : undefined,
        reloj: relojLead(l.firstAt, ahora),
        plazoCliente: deadlineLine(l.deadline, ahora),
        urgente: l.urgent,
        dudoso: false,
        accion: { label: link.startsWith("/admin/inbox") ? "Abrir en la bandeja" : "Montar presupuesto", href: link },
        ficha: null,
        entro: l.firstAt,
      };
    });
}

const orden = (a: Tarjeta, b: Tarjeta) => (a.reloj?.vence.getTime() ?? Infinity) - (b.reloj?.vence.getTime() ?? Infinity) || b.entro.getTime() - a.entro.getTime();

export function montarMesa(i: { casos: CasoMesa[]; leads: SlaLead[]; ahora: Date; baseUrl: string; nombreDe?: (miembroId: string) => string | null | undefined }): Mesa {
  const deCasos = i.casos.map((c) => clasificarCaso(c, i.ahora, i.baseUrl, i.nombreDe)).filter((t): t is Tarjeta => !!t);
  const todas = [...deCasos, ...tarjetasDeLeads(i.leads, deCasos, i.ahora)];
  const de = (m: Monton) => todas.filter((t) => t.monton === m).sort(orden);
  return {
    yo: de("yo"),
    espera: de("espera"),
    marcha: de("marcha"),
    vencidos: todas.filter((t) => t.reloj?.estado === "vencido").length,
    entreganHoy: todas.filter((t) => (t.reloj?.tipo === "entrega" || t.reloj?.tipo === "entrega_jurado") && diasCalendario(t.reloj.vence, i.ahora) === 0).length,
  };
}

export type EtapaKey = "solicitud" | "presupuesto" | "pago" | "traduccion" | "entrega";
export const ETAPAS: { key: EtapaKey; titulo: string }[] = [
  { key: "solicitud", titulo: "Solicitud" },
  { key: "presupuesto", titulo: "Presupuesto" },
  { key: "pago", titulo: "Pago" },
  { key: "traduccion", titulo: "Traducción" },
  { key: "entrega", titulo: "Entrega" },
];

/** Cuántas etapas de la ficha están hechas (0-5), acumulativo como en la maqueta. */
export function etapasHechas(i: { entradas: number; quotes: Pick<QuotePaso, "sentAt" | "paidAt" | "deletedAt">[]; pedidos: Pick<PedidoMesa, "status" | "paymentStatus" | "deliveryState" | "entregaJuradoAt">[] }): number {
  const quotes = i.quotes.filter((q) => !q.deletedAt);
  const vivos = i.pedidos.filter((p) => p.status !== "CANCELLED" && p.paymentStatus !== "REFUNDED");
  const entregado = vivos.length > 0 && vivos.every((p) => p.status === "DELIVERED" || p.deliveryState === "TRADUCIDO");
  const pasos = [
    i.entradas > 0 || quotes.length > 0 || vivos.length > 0,
    quotes.some((q) => q.sentAt) || vivos.length > 0,
    quotes.some((q) => q.paidAt) || vivos.some((p) => p.paymentStatus === "PAID"),
    entregado || (vivos.length > 0 && vivos.every((p) => p.entregaJuradoAt)),
    entregado,
  ];
  const n = pasos.findIndex((x) => !x);
  return n === -1 ? pasos.length : n;
}
