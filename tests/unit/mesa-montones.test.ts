import test from "node:test";
import assert from "node:assert/strict";
import { clasificarCaso, montarMesa, tarjetasDeLeads, etapasHechas, esPropio, duracion, type CasoMesa, type PedidoMesa, type LprMesa } from "../../lib/mesa/montones.ts";
import type { QuotePaso } from "../../lib/caso/siguiente-paso.ts";
import type { SlaLead } from "../../lib/lead-sla-core.ts";
import { mesaV2On } from "../../lib/mesa/flag.ts";

const AHORA = new Date("2026-11-21T10:00:00Z"); // sábado 11:00 en Madrid
const antes = (h: number) => new Date(AHORA.getTime() - h * 36e5);
const dentro = (dias: number) => new Date(AHORA.getTime() + dias * 864e5);
const BASE = "https://www.traduccionesjuradas.net";

const quote = (o: Partial<QuotePaso> = {}): QuotePaso => ({
  id: "q1",
  quoteNumber: "2026-00420",
  status: "SENT",
  deletedAt: null,
  lostReason: null,
  lostReasonNote: null,
  liveCasoKey: "c1",
  supersededAt: null,
  expiredAt: null,
  paymentFrozenAt: null,
  paidAt: null,
  sentAt: antes(2),
  openedAt: null,
  publicToken: "tok",
  createdAt: antes(2),
  ...o,
});
const lpr = (o: Partial<LprMesa> = {}): LprMesa => ({
  ref: "LEAD-X1",
  par: "DE>ES",
  status: "SENT",
  priceCents: null,
  miembroNombre: "Morton",
  candidatos: ["m1"],
  quoteId: null,
  expedienteRef: "puerta:abc",
  createdAt: antes(2),
  updatedAt: antes(2),
  ...o,
});
const pedido = (o: Partial<PedidoMesa> = {}): PedidoMesa => ({
  reference: "26_ABC123",
  status: "PAID",
  paymentStatus: "PAID",
  deliveryState: "EN_PROCESO",
  langPair: "fr->es",
  dueDate: dentro(3),
  traductor: null,
  plazoJurado: null,
  entregaJuradoAt: null,
  ...o,
});
const caso = (o: Partial<CasoMesa> = {}): CasoMesa => ({
  id: "c1",
  ref: "CASO-AAA111",
  estado: "ABIERTO",
  nombre: "Odile G.",
  email: "odile@correo.example",
  phone9: null,
  pares: ["FR>ES"],
  origen: "puerta",
  dudoso: false,
  urgency: null,
  neededBy: null,
  createdAt: antes(1),
  lastActivityAt: antes(1),
  quotes: [],
  lprs: [],
  pedidos: [],
  sesion: "sess1",
  ...o,
});
const tarjeta = (o: Partial<CasoMesa> = {}) => clasificarCaso(caso(o), AHORA, BASE);

test("lead recién llegado: me toca, reloj de 3 h que no ha vencido", () => {
  const t = tarjeta()!;
  assert.equal(t.monton, "yo");
  assert.equal(t.clave, "sin_nada");
  assert.equal(t.reloj?.tipo, "lead");
  assert.equal(t.reloj?.estado, "ok");
  assert.equal(t.reloj?.vence.toISOString(), "2026-11-21T12:00:00.000Z");
  assert.match(t.reloj!.texto, /Responder a las 13:00 \(quedan 2 h\)/);
  assert.equal(t.accion?.href, "/zona-traductor/presupuesto?session=sess1");
  assert.equal(t.ficha, "/zona-traductor/caso/c1");
  assert.equal(t.canal, "Web");
});

test("lead a 2 h 30: reloj pronto; a 4 h: vencido", () => {
  assert.equal(tarjeta({ createdAt: antes(2.5) })!.reloj?.estado, "pronto");
  const t = tarjeta({ createdAt: antes(4) })!;
  assert.equal(t.reloj?.estado, "vencido");
  assert.match(t.reloj!.texto, /Plazo de 3 h pasado hace 1 h/);
});

test("esperando precio del jurado: espero a otro, pasa a mí a las 24 h", () => {
  const t = tarjeta({ lprs: [lpr()] })!;
  assert.equal(t.monton, "espera");
  assert.equal(t.reloj?.tipo, "precio_jurado");
  assert.match(t.reloj!.texto, /pasa a ti mañana a las 09:00/);
});

test("jurado sin precio a las 30 h: me toca, reloj vencido", () => {
  const t = tarjeta({ lprs: [lpr({ createdAt: antes(30), updatedAt: antes(30) })] })!;
  assert.equal(t.monton, "yo");
  assert.equal(t.clave, "jurado_no_responde");
  assert.equal(t.reloj?.estado, "vencido");
});

test("precio recibido hace 3 h: me toca enviar, ya pasado el plazo de 2 h", () => {
  const t = tarjeta({ lprs: [lpr({ status: "PRICED", priceCents: 4500, updatedAt: antes(3) })] })!;
  assert.equal(t.monton, "yo");
  assert.equal(t.clave, "precio_recibido");
  assert.equal(t.reloj?.tipo, "enviar");
  assert.equal(t.reloj?.estado, "vencido");
  assert.match(t.accion!.href, /lead=LEAD-X1/);
});

test("borrador de hoy lleva el reloj del lead; borrador viejo no", () => {
  const hoy = tarjeta({ quotes: [quote({ status: "DRAFT", sentAt: null })] })!;
  assert.equal(hoy.monton, "yo");
  assert.equal(hoy.reloj?.tipo, "lead");
  assert.equal(tarjeta({ createdAt: antes(40), quotes: [quote({ status: "DRAFT", sentAt: null })] })!.reloj, null);
});

test("presupuesto enviado: espero al cliente; recordatorio a 24 h, cierre a 48 h, luego sin reloj", () => {
  const a = tarjeta({ quotes: [quote()] })!;
  assert.equal(a.monton, "espera");
  assert.equal(a.reloj?.tipo, "recordatorio");
  assert.equal(a.reloj?.estado, "ok");
  const b = tarjeta({ quotes: [quote({ sentAt: antes(30) })] })!;
  assert.equal(b.reloj?.tipo, "cierre");
  assert.equal(tarjeta({ quotes: [quote({ sentAt: antes(50) })] })!.reloj, null);
  assert.equal(a.accion?.copiar, true);
});

test("pedido francés de Juan: en marcha si falta, me toca si vence mañana o no tiene fecha", () => {
  const lejos = tarjeta({ estado: "EN_CURSO", pedidos: [pedido()] })!;
  assert.equal(lejos.monton, "marcha");
  assert.equal(lejos.clave, "traducir_yo");
  assert.equal(lejos.reloj?.tipo, "entrega");
  assert.equal(lejos.accion?.href, "/zona-traductor/pedido/26_ABC123");
  assert.equal(tarjeta({ estado: "EN_CURSO", pedidos: [pedido({ dueDate: dentro(1) })] })!.monton, "yo");
  const sinFecha = tarjeta({ estado: "EN_CURSO", pedidos: [pedido({ dueDate: null })] })!;
  assert.equal(sinFecha.monton, "yo");
  assert.match(sinFecha.detalle!, /sin fecha/);
});

test("Juan Silva puesto como traductor sigue siendo trabajo propio", () => {
  assert.equal(esPropio({ langPair: "fr->es", traductor: "Juan Silva Moreno" }), true);
  assert.equal(esPropio({ langPair: "pt->es", traductor: null }), false);
  assert.equal(esPropio({ langPair: "fr->es", traductor: "Otra Jurada" }), false);
});

test("jurado externo traduciendo: espero con su plazo; plazo pasado → me toca reclamar", () => {
  const ok = tarjeta({ estado: "EN_CURSO", pedidos: [pedido({ langPair: "pt->es", traductor: "Cristina", dueDate: dentro(2) })] })!;
  assert.equal(ok.monton, "espera");
  assert.equal(ok.reloj?.tipo, "entrega_jurado");
  assert.match(ok.reloj!.texto, /Entrega de Cristina/);
  const plazoPropio = tarjeta({ estado: "EN_CURSO", pedidos: [pedido({ langPair: "pt->es", traductor: "Cristina", dueDate: dentro(5), plazoJurado: dentro(-1) })] })!;
  assert.equal(plazoPropio.monton, "yo");
  assert.equal(plazoPropio.clave, "jurado_tarde");
  assert.equal(plazoPropio.accion?.label, "Reclamar entrega");
});

test("el jurado ya entregó: me toca verificar y enviar", () => {
  const t = tarjeta({ estado: "EN_CURSO", pedidos: [pedido({ langPair: "de->es", traductor: "Morton", entregaJuradoAt: antes(1) })] })!;
  assert.equal(t.monton, "yo");
  assert.equal(t.clave, "verificar_entrega");
  assert.equal(t.accion?.label, "Verificar y entregar");
});

test("pagado sin traductor (no francés): me toca asignar", () => {
  const t = tarjeta({ estado: "EN_CURSO", pedidos: [pedido({ langPair: "nl->es" })] })!;
  assert.equal(t.monton, "yo");
  assert.equal(t.clave, "sin_traductor");
});

test("pedido sin cobrar: espero al cliente", () => {
  assert.equal(tarjeta({ estado: "EN_CURSO", pedidos: [pedido({ paymentStatus: "PENDING", status: "PENDING_PAYMENT" })] })!.monton, "espera");
});

test("fuera de la mesa: entregado, cancelado y perdido sin nada pagable", () => {
  assert.equal(tarjeta({ estado: "ENTREGADO", pedidos: [pedido({ status: "DELIVERED" })] }), null);
  assert.equal(tarjeta({ estado: "PERDIDO", quotes: [quote({ status: "EXPIRED", expiredAt: antes(5) })] }), null);
  assert.equal(tarjeta({ estado: "PERDIDO" }), null);
});

test("perdido con presupuesto aún pagable: espero al cliente", () => {
  const t = tarjeta({ estado: "PERDIDO", quotes: [quote({ lostReason: "NO_RESPONSE", lostReasonNote: "auto:sin_respuesta", sentAt: antes(60) })] })!;
  assert.equal(t.clave, "pagable_cerrado");
  assert.equal(t.monton, "espera");
  assert.equal(t.plegada, true);
  assert.equal(tarjeta({ quotes: [quote()] })!.plegada, false);
});

test("fecha del cliente urgente se marca en la tarjeta", () => {
  const t = tarjeta({ urgency: "ASAP" })!;
  assert.equal(t.urgente, true);
  assert.equal(t.plazoCliente, "Lo necesita: lo antes posible");
});

const lead = (o: Partial<SlaLead> = {}): SlaLead => ({
  root: "r1",
  keyBase: "e:nuevo@correo.example",
  altBases: [],
  name: "Nuevo",
  email: "nuevo@correo.example",
  phone: null,
  pairs: ["en→es"],
  motor: null,
  firstAt: antes(0.5),
  minutes: 30,
  stage: 1,
  hasDraft: false,
  noPresupuestable: null,
  via: ["email"],
  links: ["https://www.traduccionesjuradas.net/admin/inbox?vista=todos"],
  deadline: null,
  urgent: false,
  ...o,
});

test("leads sueltos: entran en me toca con reloj de 3 h y enlace relativo; los que ya tienen tarjeta no se repiten", () => {
  const yaEsta = tarjeta()!;
  const ts = tarjetasDeLeads([lead(), lead({ root: "r2", email: "ODILE@correo.example" }), lead({ root: "r3", email: null, phone: "+34 600 111 222" })], [yaEsta, tarjeta({ id: "c2", email: null, phone9: "600111222" })!], AHORA);
  assert.equal(ts.length, 1);
  assert.equal(ts[0].monton, "yo");
  assert.equal(ts[0].accion?.href, "/admin/inbox?vista=todos");
  assert.equal(ts[0].accion?.label, "Abrir en la bandeja");
  assert.equal(ts[0].reloj?.tipo, "lead");
  assert.equal(ts[0].ficha, null);
});

test("montarMesa: reparte, ordena por reloj y cuenta vencidos y entregas de hoy", () => {
  const m = montarMesa({
    casos: [
      caso({ id: "a", createdAt: antes(1) }),
      caso({ id: "b", createdAt: antes(5), email: "b@x.example" }),
      caso({ id: "c", estado: "EN_CURSO", email: "c@x.example", pedidos: [pedido({ dueDate: new Date("2026-11-21T18:00:00Z") })] }),
      caso({ id: "d", email: "d@x.example", lprs: [lpr()] }),
      caso({ id: "e", estado: "EN_CURSO", email: "e@x.example", pedidos: [pedido({ dueDate: dentro(6) })] }),
      caso({ id: "f", estado: "ENTREGADO", email: "f@x.example", pedidos: [pedido({ status: "DELIVERED" })] }),
    ],
    leads: [lead()],
    ahora: AHORA,
    baseUrl: BASE,
  });
  assert.deepEqual(m.yo.map((t) => t.key), ["b", "a", "lead:r1", "c"]);
  assert.deepEqual(m.espera.map((t) => t.key), ["d"]);
  assert.deepEqual(m.marcha.map((t) => t.key), ["e"]);
  assert.equal(m.vencidos, 1);
  assert.equal(m.entreganHoy, 1);
});

test("etapas de la ficha: acumulativas", () => {
  assert.equal(etapasHechas({ entradas: 0, quotes: [], pedidos: [] }), 0);
  assert.equal(etapasHechas({ entradas: 2, quotes: [], pedidos: [] }), 1);
  assert.equal(etapasHechas({ entradas: 1, quotes: [quote()], pedidos: [] }), 2);
  assert.equal(etapasHechas({ entradas: 1, quotes: [quote({ paidAt: antes(1) })], pedidos: [pedido()] }), 3);
  assert.equal(etapasHechas({ entradas: 1, quotes: [quote({ paidAt: antes(1) })], pedidos: [pedido({ entregaJuradoAt: antes(1) })] }), 4);
  assert.equal(etapasHechas({ entradas: 1, quotes: [quote({ paidAt: antes(1) })], pedidos: [pedido({ status: "DELIVERED" })] }), 5);
  assert.equal(etapasHechas({ entradas: 1, quotes: [quote({ deletedAt: antes(1) })], pedidos: [] }), 1);
});

test("duración legible", () => {
  assert.equal(duracion(-45 * 6e4), "45 min");
  assert.equal(duracion(150 * 6e4), "2 h 30 min");
  assert.equal(duracion(3 * 864e5), "3 días");
});

test("interruptor MESA_V2: kill-switch, solo «off» exacto apaga", () => {
  for (const v of ["on", undefined, "", "ON", "1", "true"]) assert.equal(mesaV2On({ MESA_V2: v }), true);
  assert.equal(mesaV2On({ MESA_V2: "off" }), false);
});
