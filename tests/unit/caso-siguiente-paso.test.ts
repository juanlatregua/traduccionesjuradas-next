import test from "node:test";
import assert from "node:assert/strict";
import { siguientePaso, hrefSolicitud, quoteVigente, type QuotePaso, type LprPaso, type PedidoPaso } from "../../lib/caso/siguiente-paso.ts";
import { clavesDocs, decidirAvisoHumano, dedupeAviso, AVISO_REPETIDO_HORAS } from "../../lib/caso/aviso-humano.ts";

const AHORA = new Date("2026-10-11T12:00:00Z");
const horasAntes = (h: number) => new Date(AHORA.getTime() - h * 36e5);
const BASE = "https://www.traduccionesjuradas.net";
const quote = (o: Partial<QuotePaso> = {}): QuotePaso => ({
  id: "q1",
  quoteNumber: "2026-00250",
  status: "SENT",
  deletedAt: null,
  lostReason: null,
  liveCasoKey: "c1",
  supersededAt: null,
  paymentFrozenAt: null,
  paidAt: null,
  sentAt: horasAntes(26),
  openedAt: null,
  publicToken: "tok",
  createdAt: horasAntes(26),
  ...o,
});
const lpr = (o: Partial<LprPaso> = {}): LprPaso => ({
  ref: "LEAD-C701784649",
  par: "DE>ES",
  status: "SENT",
  priceCents: null,
  miembroNombre: null,
  candidatos: ["m1"],
  quoteId: null,
  expedienteRef: "puerta:abc",
  createdAt: horasAntes(2),
  ...o,
});
const pedido = (o: Partial<PedidoPaso> = {}): PedidoPaso => ({ reference: "2026-00300", status: "PAID", paymentStatus: "PAID", deliveryState: "EN_PROCESO", ...o });
const paso = (o: { quotes?: QuotePaso[]; lprs?: LprPaso[]; pedidos?: PedidoPaso[]; estado?: string; sesion?: string | null }) =>
  siguientePaso({
    casoId: "c1",
    estado: o.estado ?? "ABIERTO",
    quotes: o.quotes ?? [],
    lprs: o.lprs ?? [],
    pedidos: o.pedidos ?? [],
    baseUrl: BASE,
    ahora: AHORA,
    sesion: o.sesion,
    nombreDe: (id) => (id === "m1" ? "Morton" : null),
  });

test("esperando precio: jurado por nombre, botón abrir solicitud", () => {
  const p = paso({ lprs: [lpr()] });
  assert.equal(p.clave, "esperando_precio");
  assert.equal(p.grupo, "jurado");
  assert.match(p.titulo, /Esperando precio de Morton desde/);
  assert.equal(p.accion?.href, "/zona-traductor/presupuesto?lead=LEAD-C701784649");
});

test("jurado sin responder ≥ 24 h pasa a necesitar acción", () => {
  const p = paso({ lprs: [lpr({ createdAt: horasAntes(30) })] });
  assert.equal(p.clave, "jurado_no_responde");
  assert.equal(p.grupo, "accion");
});

test("precio recibido → montar presupuesto (con exp si no es de la puerta)", () => {
  const p = paso({ lprs: [lpr({ status: "PRICED", priceCents: 4000, miembroNombre: "Morton", expedienteRef: "EXP-AB12CD" })] });
  assert.equal(p.clave, "precio_recibido");
  assert.equal(p.grupo, "accion");
  assert.match(p.titulo, /40,00 €/);
  assert.equal(p.accion?.href, "/zona-traductor/presupuesto?lead=LEAD-C701784649&exp=EXP-AB12CD");
});

test("presupuesto enviado (caso Florian): copiar /q aunque la solicitud tenga precio", () => {
  const p = paso({
    quotes: [quote({ status: "OPENED", openedAt: horasAntes(1) }), quote({ id: "q0", quoteNumber: "2026-00249", status: "DRAFT", liveCasoKey: null, deletedAt: horasAntes(26) })],
    lprs: [lpr({ status: "PRICED", priceCents: 4000, quoteId: "q1" })],
  });
  assert.equal(p.clave, "presupuesto_enviado");
  assert.equal(p.grupo, "cliente");
  assert.equal(p.accion?.copiar, true);
  assert.equal(p.accion?.href, `${BASE}/q/tok`);
  assert.match(p.detalle || "", /abierto el/);
});

test("borrador vigente → revisar y enviar", () => {
  const p = paso({ quotes: [quote({ status: "DRAFT", sentAt: null })] });
  assert.equal(p.clave, "borrador");
  assert.equal(p.accion?.href, "/zona-traductor/presupuestos/q1");
});

test("congelado manda sobre todo, también cobrado con pedido", () => {
  const p = paso({ quotes: [quote({ status: "PAID", paidAt: horasAntes(1), paymentFrozenAt: horasAntes(3) })], pedidos: [pedido()] });
  assert.equal(p.clave, "congelado");
  assert.equal(p.grupo, "accion");
  assert.equal(p.accion?.href, "/zona-traductor/presupuestos/q1");
});

test("pedido: en curso, sin cobrar y entregado", () => {
  assert.equal(paso({ pedidos: [pedido()] }).clave, "pedido_en_curso");
  assert.equal(paso({ pedidos: [pedido({ paymentStatus: "PENDING", status: "PENDING_PAYMENT", deliveryState: "PRESUPUESTO" })] }).grupo, "cliente");
  const e = paso({ pedidos: [pedido({ status: "DELIVERED", deliveryState: "TRADUCIDO" })] });
  assert.equal(e.clave, "entregado");
  assert.equal(e.accion?.href, "/zona-traductor/pedido/2026-00300");
});

test("nada vivo: abierto → montar con la sesión; perdido → sin botón", () => {
  const a = paso({ sesion: "s1", lprs: [lpr({ createdAt: horasAntes(24 * 40) })] });
  assert.equal(a.clave, "sin_nada");
  assert.equal(a.accion?.href, "/zona-traductor/presupuesto?session=s1");
  const b = paso({ estado: "PERDIDO", quotes: [quote({ status: "EXPIRED" })] });
  assert.equal(b.clave, "perdido");
  assert.equal(b.accion, null);
});

test("vigente: la de la clave del caso antes que la más reciente; perdida no cuenta", () => {
  const v = quoteVigente("c1", [quote({ id: "a", liveCasoKey: "c1", createdAt: horasAntes(10) }), quote({ id: "b", liveCasoKey: null, createdAt: horasAntes(1) })]);
  assert.equal(v?.id, "a");
  assert.equal(quoteVigente("c1", [quote({ lostReason: "PRICE" })]), null);
  assert.equal(hrefSolicitud({ ref: "LEAD-X", expedienteRef: null }), "/zona-traductor/presupuesto?lead=LEAD-X");
});

test("aviso humano: primera vez completo; mismo doc dentro de 12 h nada; pasado 12 h corto", () => {
  const docs = clavesDocs([{ id: "d1", hash: "aa" }]);
  assert.equal(decidirAvisoHumano({ casoId: "c1", docs, previos: [], solicitudNueva: false, ahora: AHORA }).tipo, "completo");
  const previo = { tipo: "aviso_humano" as const, createdAt: horasAntes(1), docs };
  assert.equal(decidirAvisoHumano({ casoId: "c1", docs, previos: [previo], solicitudNueva: false, ahora: AHORA }).tipo, "nada");
  const viejo = { ...previo, createdAt: horasAntes(AVISO_REPETIDO_HORAS + 1) };
  assert.equal(decidirAvisoHumano({ casoId: "c1", docs, previos: [viejo], solicitudNueva: false, ahora: AHORA }).tipo, "corto");
  const corto = { tipo: "aviso_humano_repetido" as const, createdAt: horasAntes(2), docs };
  assert.equal(decidirAvisoHumano({ casoId: "c1", docs, previos: [viejo, corto], solicitudNueva: false, ahora: AHORA }).tipo, "nada");
});

test("aviso humano: documento nuevo o solicitud nueva = completo; sin caso = completo", () => {
  const docs = clavesDocs([{ id: "d1", hash: "aa" }, { id: "d2", hash: "bb" }]);
  const previo = { tipo: "aviso_humano" as const, createdAt: horasAntes(1), docs: clavesDocs([{ id: "d1", hash: "aa" }]) };
  const d = decidirAvisoHumano({ casoId: "c1", docs, previos: [previo], solicitudNueva: false, ahora: AHORA });
  assert.equal(d.tipo, "completo");
  assert.deepEqual(d.docsNuevos, ["h:bb"]);
  assert.equal(decidirAvisoHumano({ casoId: "c1", docs: previo.docs, previos: [previo], solicitudNueva: true, ahora: AHORA }).tipo, "completo");
  assert.equal(decidirAvisoHumano({ casoId: null, docs, previos: [previo], solicitudNueva: false, ahora: AHORA }).tipo, "completo");
});

test("claves de documentos: hash o id, sin duplicados y ordenadas", () => {
  assert.deepEqual(clavesDocs([{ id: "z", hash: null }, { id: "a", hash: "ff" }, { id: "b", hash: "ff" }]), ["d:z", "h:ff"]);
  assert.equal(dedupeAviso([]), "sin-docs");
});
