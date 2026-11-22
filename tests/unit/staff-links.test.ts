import test from "node:test";
import assert from "node:assert/strict";
import { abs, hrefBandeja, hrefCaso, hrefCliente, hrefConstructor, hrefLectura, hrefPedido, hrefPresupuesto, hrefSolicitud } from "../../lib/staff-links.ts";

test("enlaces de staff: mismas URLs que los literales de antes", () => {
  assert.equal(abs(hrefPedido("TJ-2026-0042")), "https://www.traduccionesjuradas.net/zona-traductor/pedido/TJ-2026-0042");
  assert.equal(abs(hrefPresupuesto("abc"), "http://x"), "http://x/zona-traductor/presupuestos/abc");
  assert.equal(hrefCaso("c1"), "/zona-traductor/caso/c1");
  assert.equal(hrefCliente("a+b@x.com"), "/zona-traductor/clientes/a%2Bb%40x.com");
  assert.equal(hrefConstructor(), "/zona-traductor/presupuesto");
  assert.equal(hrefConstructor({ lead: "L 1", exp: undefined }), "/zona-traductor/presupuesto?lead=L%201");
  assert.equal(hrefConstructor(new URLSearchParams({ session: "s", customerEmail: "a@b.c" })), "/zona-traductor/presupuesto?session=s&customerEmail=a%40b.c");
  assert.equal(hrefLectura({ caso: "C1" }), "/zona-traductor/lectura?caso=C1");
  assert.equal(hrefBandeja(), "/admin/inbox");
  assert.equal(hrefBandeja("m 1"), "/admin/inbox?id=m%201");
  assert.equal(hrefSolicitud({ ref: "R1", expedienteRef: "puerta:x" }), "/zona-traductor/presupuesto?lead=R1");
  assert.equal(hrefSolicitud({ ref: "R1", expedienteRef: "E1" }), "/zona-traductor/presupuesto?lead=R1&exp=E1");
});
