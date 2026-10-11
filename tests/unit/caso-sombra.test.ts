import test from "node:test";
import assert from "node:assert/strict";
import {
  anclasDeExpediente,
  compararDecisiones,
  decidirBarrido,
  quoteCuentaViva,
  soloEventosDesechables,
  decidirDiscrepancia,
  entradaDeCreador,
  paresDe,
  planRecalculo,
  vivoEnCaso,
  NADA_VIVO,
  type QuoteDelCaso,
} from "../../lib/caso/sombra-plan.ts";
import type { Decision } from "../../lib/caso/resolver.ts";

const AHORA = new Date("2026-10-11T12:00:00Z");
const hace = (d: number) => new Date(AHORA.getTime() - d * 864e5);
const adjunta: Decision = { accion: "adjuntar", casoId: "c1", regla: "mismo_documento", posibles: [] };
const crea: Decision = { accion: "crear", regla: "nuevo", posibles: [] };
const quote = (o: Partial<QuoteDelCaso>): QuoteDelCaso => ({
  id: "q1",
  status: "SENT",
  deletedAt: null,
  lostReason: null,
  liveCasoKey: "c1",
  supersededAt: null,
  createdAt: hace(1),
  ...o,
});

test("entrada desde createdBy del chokepoint de lavori-lead", () => {
  assert.equal(entradaDeCreador("puerta-directo"), "directo");
  assert.equal(entradaDeCreador("puerta-directo:escalado"), "directo");
  assert.equal(entradaDeCreador("puerta-auto"), "puerta");
  assert.equal(entradaDeCreador("one-tap"), "one_tap");
  assert.equal(entradaDeCreador("directo-escalado"), "escalado");
  assert.equal(entradaDeCreador("juan@traduccionesjuradas.net"), "price_request");
  assert.equal(entradaDeCreador(null), "price_request");
});

test("anclas desde expedienteRef: puerta y EXP son sesión; el resto solo expediente", () => {
  assert.deepEqual(anclasDeExpediente("puerta:abc"), { expedienteRef: "puerta:abc", sessionToken: "abc" });
  assert.deepEqual(anclasDeExpediente("EXP-AB23CD"), { expedienteRef: "EXP-AB23CD", sessionToken: "exp:EXP-AB23CD" });
  assert.deepEqual(anclasDeExpediente("26_C3617B"), { expedienteRef: "26_C3617B" });
  assert.deepEqual(anclasDeExpediente(null), {});
  assert.deepEqual(anclasDeExpediente("  "), {});
});

test("pares: par o nada", () => {
  assert.deepEqual(paresDe("de", "es"), ["DE>ES"]);
  assert.deepEqual(paresDe("es->en"), ["ES>EN"]);
  assert.deepEqual(paresDe(null, "es"), []);
  assert.deepEqual(paresDe("unknown", ""), []);
});

test("vivo en el caso: solicitud viva del mismo par y vigente viva con la clave", () => {
  const lprs = [{ par: "DE>ES", status: "SENT", createdAt: hace(2) }];
  assert.deepEqual(vivoEnCaso({ casoId: "c1", par: "DE>ES", quotes: [], lprs, ahora: AHORA }), { lprMismoPar: true, vigente: false });
  assert.equal(vivoEnCaso({ casoId: "c1", par: "ES>DE", quotes: [], lprs, ahora: AHORA }).lprMismoPar, false, "dirección importa");
  assert.equal(vivoEnCaso({ casoId: "c1", par: null, quotes: [], lprs, ahora: AHORA }).lprMismoPar, true, "par desconocido casa");
  assert.equal(
    vivoEnCaso({ casoId: "c1", par: "DE>ES", quotes: [], lprs: [{ par: "DE>ES", status: "SENT", createdAt: hace(40) }], ahora: AHORA }).lprMismoPar,
    false,
    "solicitud vieja ya no está viva"
  );
  assert.equal(vivoEnCaso({ casoId: "c1", par: null, quotes: [quote({})], lprs: [], ahora: AHORA }).vigente, true);
  assert.equal(vivoEnCaso({ casoId: "c1", par: null, quotes: [quote({ lostReason: "NO_LONGER_NEEDED" })], lprs: [], ahora: AHORA }).vigente, false);
  assert.equal(vivoEnCaso({ casoId: "c1", par: null, quotes: [quote({ liveCasoKey: null })], lprs: [], ahora: AHORA }).vigente, true, "vivo aunque no tenga la clave");
  assert.equal(vivoEnCaso({ casoId: "c1", par: null, quotes: [quote({ deletedAt: hace(1) })], lprs: [], ahora: AHORA }).vigente, false);
});

test("discrepancia: vieja crea y el caso ya tenía lo mismo vivo", () => {
  const viva = { decision: adjunta, vivo: { lprMismoPar: true, vigente: false } };
  assert.equal(decidirDiscrepancia("crea", viva, "solicitud"), "crea_solicitud_con_viva_en_caso");
  assert.equal(decidirDiscrepancia("crea", viva, "presupuesto"), null, "una solicitud viva no estorba a un presupuesto");
  assert.equal(
    decidirDiscrepancia("crea", { decision: adjunta, vivo: { lprMismoPar: false, vigente: true } }, "presupuesto"),
    "crea_presupuesto_con_vigente_en_caso"
  );
  assert.equal(decidirDiscrepancia("crea", { decision: crea, vivo: NADA_VIVO }, "solicitud"), null, "caso nuevo: coinciden");
  assert.equal(decidirDiscrepancia("crea", { decision: adjunta, vivo: NADA_VIVO }, "solicitud"), null, "caso sin nada vivo: coinciden");
});

test("discrepancia: vieja bloquea y el resolver no ve nada vivo", () => {
  assert.equal(decidirDiscrepancia("bloquea", { decision: adjunta, vivo: { lprMismoPar: true, vigente: false } }, "solicitud"), null);
  assert.equal(decidirDiscrepancia("bloquea", { decision: adjunta, vivo: { lprMismoPar: false, vigente: true } }, "solicitud"), null);
  assert.equal(decidirDiscrepancia("bloquea", { decision: adjunta, vivo: NADA_VIVO }, "solicitud"), "bloquea_caso_sin_nada_vivo");
  assert.equal(decidirDiscrepancia("bloquea", { decision: crea, vivo: NADA_VIVO }, "solicitud", true), "bloquea_resolver_crearia_caso", "dry-run");
  assert.equal(decidirDiscrepancia("bloquea", { decision: crea, vivo: NADA_VIVO }, "solicitud"), "bloquea_resolver_creo_caso", "la puerta resolvió de verdad");
  assert.equal(
    decidirDiscrepancia("bloquea", { decision: { accion: "dudoso", regla: "agencia", posibles: ["c1"] }, vivo: NADA_VIVO }, "solicitud", true),
    "bloquea_resolver_crearia_caso"
  );
});

test("discrepancia: sin opinión del resolver (falló) no se anota nada", () => {
  assert.equal(decidirDiscrepancia("crea", null, "solicitud"), null);
  assert.equal(decidirDiscrepancia("bloquea", null, "solicitud"), null);
});

const base = { casoId: "c1", estado: "ABIERTO", closedAt: null, pedidos: [], quotes: [], lprs: [], ahora: AHORA };

test("recalcular: el pedido manda y cierra", () => {
  assert.deepEqual(planRecalculo({ ...base, pedidos: [{ status: "PENDING_PAYMENT" }] }), { estado: "EN_CURSO", cambia: true, closedAt: "dejar" });
  assert.deepEqual(planRecalculo({ ...base, estado: "EN_CURSO", pedidos: [{ status: "DELIVERED" }] }), { estado: "ENTREGADO", cambia: true, closedAt: "poner" });
  assert.deepEqual(planRecalculo({ ...base, estado: "EN_CURSO", pedidos: [{ status: "CANCELLED" }] }), { estado: "CANCELADO", cambia: true, closedAt: "poner" });
});

test("recalcular: sin pedido manda la vigente; perdida → PERDIDO; caso perdido que reabre", () => {
  assert.deepEqual(planRecalculo({ ...base, quotes: [quote({ status: "EXPIRED", lostReason: "PRICE" })] }), { estado: "PERDIDO", cambia: true, closedAt: "poner" });
  assert.equal(planRecalculo({ ...base, quotes: [quote({})] })!.cambia, false);
  assert.deepEqual(
    planRecalculo({ ...base, estado: "PERDIDO", closedAt: hace(3), quotes: [quote({})] }),
    { estado: "ABIERTO", cambia: true, closedAt: "quitar" }
  );
  // Sin ninguno vivo y sin clave: la última no sustituida.
  const vieja = quote({ id: "q0", liveCasoKey: null, status: "EXPIRED", createdAt: hace(5) });
  const nueva = quote({ id: "q2", liveCasoKey: null, status: "EXPIRED", lostReason: "PRICE", createdAt: hace(1) });
  assert.equal(planRecalculo({ ...base, quotes: [vieja, nueva] })!.estado, "PERDIDO");
  // Con presupuesto manda él aunque haya solicitud viva.
  assert.equal(
    planRecalculo({ ...base, quotes: [quote({ status: "EXPIRED", lostReason: "PRICE" })], lprs: [{ par: "DE>ES", status: "PRICED", createdAt: hace(1) }] })!.estado,
    "PERDIDO"
  );
});

test("recalcular: sin presupuesto, la solicitud viva; caso vacío o estado raro no se toca", () => {
  assert.equal(planRecalculo({ ...base, lprs: [{ par: "DE>ES", status: "SENT", createdAt: hace(1) }] })!.cambia, false);
  assert.equal(planRecalculo({ ...base, lprs: [{ par: "DE>ES", status: "RETIRED", createdAt: hace(1) }] })!.estado, "PERDIDO");
  assert.deepEqual(planRecalculo(base), { estado: "ABIERTO", cambia: false, closedAt: "dejar" });
  assert.equal(planRecalculo({ ...base, estado: "PAGADO" }), null);
});

test("recalcular: transiciones prohibidas se quedan (un entregado no vuelve a abierto)", () => {
  assert.deepEqual(planRecalculo({ ...base, estado: "ENTREGADO", closedAt: hace(1), pedidos: [{ status: "PAID" }] }), {
    estado: "ENTREGADO",
    cambia: false,
    closedAt: "dejar",
  });
  assert.equal(planRecalculo({ ...base, estado: "EN_CURSO", quotes: [quote({ status: "EXPIRED", lostReason: "PRICE" })], pedidos: [] })!.estado, "EN_CURSO");
});

test("comparación: registra acuerdo, regla original (no la del ancla) y si es el mismo caso que cita la guarda", () => {
  const porAncla: Decision = { accion: "adjuntar", casoId: "c1", regla: "ancla", posibles: [] };
  const c = compararDecisiones({
    vieja: "bloquea",
    objeto: "solicitud",
    sombra: { casoId: "c1", decision: porAncla, decisionSinAncla: adjunta, vivo: { lprMismoPar: true, vigente: false } },
    casoGuarda: "c1",
    simulado: false,
  });
  assert.deepEqual(
    { acuerdo: c.acuerdo, motivo: c.motivo, regla: c.reglaOriginal, mismo: c.mismoCaso, caso: c.casoResolver },
    { acuerdo: true, motivo: null, regla: "mismo_documento", mismo: true, caso: "c1" }
  );
  const d = compararDecisiones({ vieja: "bloquea", objeto: "solicitud", sombra: { casoId: "c9", decision: crea, vivo: NADA_VIVO }, casoGuarda: "c1", simulado: true });
  assert.deepEqual(
    { acuerdo: d.acuerdo, motivo: d.motivo, regla: d.reglaOriginal, mismo: d.mismoCaso, sim: d.simulacion },
    { acuerdo: false, motivo: "bloquea_resolver_crearia_caso", regla: "nuevo", mismo: false, sim: true }
  );
  assert.equal(compararDecisiones({ vieja: "crea", objeto: "solicitud", sombra: { casoId: "c1", decision: adjunta, vivo: NADA_VIVO }, casoGuarda: null, simulado: false }).mismoCaso, null);
});

const barrido = { estado: "ABIERTO", ahora: AHORA, hijos: 1, quotes: [], lprs: [], pedidos: 0, tiposEventos: ["creado"] };

test("barrido: vacío >1 d se borra (o se pierde si tiene rastro útil); sin vida >7 d → PERDIDO", () => {
  assert.equal(decidirBarrido({ ...barrido, hijos: 0, lastActivityAt: hace(2) }), "borrar");
  assert.equal(decidirBarrido({ ...barrido, hijos: 0, lastActivityAt: hace(0.5) }), null);
  assert.equal(decidirBarrido({ ...barrido, hijos: 0, lastActivityAt: hace(2), tiposEventos: ["creado", "comparacion"] }), "perder");
  assert.equal(decidirBarrido({ ...barrido, lastActivityAt: hace(3) }), null, "con hijos espera 7 días");
  assert.equal(decidirBarrido({ ...barrido, lastActivityAt: hace(8) }), "perder", "solo documentos/emails");
  assert.equal(decidirBarrido({ ...barrido, lastActivityAt: hace(8), quotes: [quote({})] }), null, "presupuesto vivo");
  assert.equal(decidirBarrido({ ...barrido, lastActivityAt: hace(8), lprs: [{ par: "DE>ES", status: "SENT", createdAt: hace(8) }] }), null, "solicitud viva");
  assert.equal(decidirBarrido({ ...barrido, lastActivityAt: hace(8), pedidos: 1 }), null);
  assert.equal(decidirBarrido({ ...barrido, estado: "EN_CURSO", hijos: 0, lastActivityAt: hace(30) }), null);
});

test("recalcular: un presupuesto vivo manda aunque la clave la tenga uno muerto", () => {
  const muerta = quote({ id: "q0", status: "EXPIRED", lostReason: "PRICE", liveCasoKey: "c1", createdAt: hace(5) });
  const viva = quote({ id: "q2", liveCasoKey: null, createdAt: hace(1) });
  assert.equal(planRecalculo({ ...base, estado: "PERDIDO", closedAt: hace(2), quotes: [muerta, viva] })!.estado, "ABIERTO");
});

test("formalizado cuenta como vivo para el estado; borrado no", () => {
  assert.ok(quoteCuentaViva(quote({ status: "PAID", lostReason: null })));
  assert.ok(quoteCuentaViva(quote({ status: "DELIVERED" })));
  assert.ok(!quoteCuentaViva(quote({ status: "PAID", deletedAt: hace(1) })));
  assert.ok(!quoteCuentaViva(quote({ status: "EXPIRED" })));
  assert.equal(planRecalculo({ ...base, quotes: [quote({ status: "PAID", liveCasoKey: null })] })!.estado, "ABIERTO", "pagado sin pedido aún: no se pierde");
  assert.equal(decidirBarrido({ ...barrido, lastActivityAt: hace(8), quotes: [quote({ status: "IN_PROGRESS" })] }), null);
  assert.ok(soloEventosDesechables(["creado", "adjuntado"]) && !soloEventosDesechables(["creado", "comparacion"]));
});
