import test from "node:test";
import assert from "node:assert/strict";
import {
  LAVORI_CANDIDATES,
  LAVORI_NO_AVISAR,
  applyLiveFallback,
  buildSolicitudPayload,
  fetchLavoriCartera,
  isEncargoMuerto,
  isLavoriNoAvisar,
  lavoriManualRoute,
  pickLavoriAuto,
  resolveLavoriCandidatos,
  sendLavoriPrecioAceptado,
  sendLavoriSolicitud,
  sameTranslatorName,
  type LavoriMember,
} from "../../lib/lavori-bridge.ts";

// Cruce con lavori del 8-oct-2026.

const CARMEN = "1h8tul4zycnayru8bsi1tmu4";
const MARGARITA = "0saaznz1jnylzn7ufmhd152c";
const m = (id: string, langs: string[], extra: Partial<LavoriMember> = {}): LavoriMember => ({
  id,
  nombre: id,
  langs,
  canal: true,
  enPaz: false,
  disponible: true,
  papelUnico: true,
  ...extra,
});

function withFetch<T>(handler: (url: string, init: any) => { status: number; body: any }, fn: () => Promise<T>) {
  const real = globalThis.fetch;
  const calls: Array<{ url: string; body: any }> = [];
  (globalThis as any).fetch = async (url: string, init: any) => {
    const body = init?.body ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), body });
    const r = handler(String(url), init);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.body };
  };
  process.env.MOTOR_LAVORI_SECRET = "test-secret";
  return fn().finally(() => {
    (globalThis as any).fetch = real;
  }).then((out) => ({ out, calls }));
}

// 1. Pago con encargo caducado → 409 con estado muerto → reactivación con SU cifra

test("1. isEncargoMuerto: cancelado/caducado/retirado sin aceptante se reactiva; con aceptante o 'lo llevo yo' no", () => {
  for (const e of ["cancelado", "caducado", "expirado", "retirado", "Cancelada", "desconocido", ""]) {
    assert.equal(isEncargoMuerto(e, null), true, e);
  }
  assert.equal(isEncargoMuerto("aceptado", null), false);
  assert.equal(isEncargoMuerto("cancelado", "someMemberId"), false); // alguien lo aceptó: nunca se abre otro
  assert.equal(isEncargoMuerto("publicado", "x"), false);
});

test("1. pago con encargo caducado: el 409 se lee como conflicto y la reactivación sale dirigida al mismo jurado con su cifra", async () => {
  // a) precio_aceptado responde 409 «caducado» (no lanza: el pago no se rompe)
  const { out: aceptado } = await withFetch(
    () => ({ status: 409, body: { ok: false, estado: "caducado" } }),
    () => sendLavoriPrecioAceptado({ ref: "LEAD-X-precio", precioParaTi: "70.00", refPedido: "26_TEST01" })
  );
  assert.ok(!aceptado.ok && "conflicto" in aceptado && aceptado.conflicto);
  assert.equal(isEncargoMuerto((aceptado as any).estado, (aceptado as any).aceptadoPor), true);

  // b) la reactivación: solicitud dirigida, ref del pedido (sin sufijo), paraTi = SU cifra, solo él
  const payload = buildSolicitudPayload({
    reference: "26_TEST01",
    route: { lang: "en", par: "EN>ES", candidatos: ["exwzhhwv5fyegllvblt76uvb"] },
    amountCents: 12100,
    documentos: [{ nombre: "a.pdf", contentType: "application/pdf", url: "https://x/a.pdf", bytes: 10, sha256: "0".repeat(64) }],
    paraTiCents: 7000,
  });
  assert.equal(payload.ref, "26_TEST01");
  assert.equal(payload.paraTi, "70.00"); // su cifra, NO el 75 % recalculado (75.00)
  assert.deepEqual(payload.candidatos, ["exwzhhwv5fyegllvblt76uvb"]);
  const { out: envio, calls } = await withFetch(
    () => ({ status: 200, body: { ok: true, encargoId: "enc-nuevo" } }),
    () => sendLavoriSolicitud(payload)
  );
  assert.ok(envio.ok && envio.encargoId === "enc-nuevo");
  assert.equal(calls[0].body.paraTi, "70.00");
});

test("1. un fallo de red al aceptar no lanza: devuelve error para que el pago siga y se avise", async () => {
  const real = globalThis.fetch;
  process.env.MOTOR_LAVORI_SECRET = "s";
  (globalThis as any).fetch = async () => {
    throw new Error("ECONNRESET");
  };
  try {
    const r = await sendLavoriPrecioAceptado({ ref: "LEAD-X-precio", precioParaTi: "10.00" });
    assert.ok(!r.ok && !("conflicto" in r && r.conflicto));
  } finally {
    (globalThis as any).fetch = real;
  }
});

// 2. Papel único

test("2. papel único: pickLavoriAuto, carril por defecto y manual solo con papelUnico", () => {
  const cartera = [m("con", ["xx"]), m("sin", ["xx"], { papelUnico: false }), m("con2", ["xx"])];
  assert.deepEqual(pickLavoriAuto("xx", cartera, 10).map((x) => x.id).sort(), ["con", "con2"]);
  const r = lavoriManualRoute("xx->es", cartera);
  assert.deepEqual(r?.candidatos.sort(), ["con", "con2"]);
  // carril fijo (ar): los sin papel salen
  const ar = LAVORI_CANDIDATES.ar;
  const carteraAr = ar.map((id, i) => m(id, ["ar"], { papelUnico: i !== 0 }));
  const fijo = lavoriManualRoute("ar->es", carteraAr)!;
  assert.ok(!fijo.candidatos.includes(ar[0]) && fijo.candidatos.length === ar.length - 1);
});

test("2. applyLiveFallback: los sin papel se quitan; si ninguno tiene papel -> error (aviso a staff), nada a ciegas", () => {
  const cartera = [m("a", ["pt"], { papelUnico: false }), m("b", ["pt"], { papelUnico: true })];
  const parcial = applyLiveFallback({ lang: "pt", par: "PT>ES", candidatos: ["a", "b"] }, cartera, true);
  assert.ok(parcial.ok && parcial.route.candidatos.join() === "b");
  assert.match(parcial.ok ? parcial.respaldo?.motivo || "" : "", /a \(sin papel único\)/);
  const ninguno = applyLiveFallback({ lang: "pt", par: "PT>ES", candidatos: ["a"] }, [m("a", ["pt"], { papelUnico: false })], true);
  assert.ok(!ninguno.ok);
  assert.match(ninguno.ok ? "" : ninguno.error, /papel único/);
  // cartera estática (lavori no responde): no se afirma nada
  assert.ok(applyLiveFallback({ lang: "pt", par: "PT>ES", candidatos: ["a"] }, cartera, false).ok);
});

test("2. una elección a mano con alguien sin papel se rechaza con su nombre", () => {
  const cartera = [m("a", ["xx"], { nombre: "Ana", papelUnico: false }), m("b", ["xx"])];
  const route = { lang: "xx", par: "XX>ES", candidatos: ["b"] };
  const r = resolveLavoriCandidatos(route, ["a", "b"], cartera);
  assert.ok(!r.ok);
  assert.match(r.ok ? "" : r.error, /Ana/);
  assert.ok(resolveLavoriCandidatos(route, ["b"], cartera).ok);
});

// 3. Exclusiones

test("3. Carmen Lencastre y Margarita Aguiló: fuera del carril, de la cartera y de todo envío", async () => {
  assert.ok(isLavoriNoAvisar(CARMEN) && isLavoriNoAvisar(MARGARITA));
  assert.ok(Object.keys(LAVORI_NO_AVISAR).length >= 2);
  assert.ok(!LAVORI_CANDIDATES.pt.includes(CARMEN));
  // pickLavoriAuto / manual / fallback no las eligen aunque estén en la cartera viva
  const cartera = [m(CARMEN, ["pt"]), m(MARGARITA, ["it"]), m("ok-pt", ["pt"]), m("ok-it", ["it"])];
  assert.ok(!pickLavoriAuto("pt", cartera, 10).some((x) => x.id === CARMEN));
  assert.ok(!pickLavoriAuto("it", cartera, 10).some((x) => x.id === MARGARITA));
  assert.ok(!lavoriManualRoute("pt->es", cartera)!.candidatos.includes(CARMEN));
  const fb = applyLiveFallback({ lang: "pt", par: "PT>ES", candidatos: [CARMEN, "ok-pt"] }, cartera, true);
  assert.ok(fb.ok && fb.route.candidatos.join() === "ok-pt");
  // chokepoint: aunque un camino las cuele, sendLavoriSolicitud las quita del payload
  const payload = buildSolicitudPayload({
    reference: "26_T",
    route: { lang: "pt", par: "PT>ES", candidatos: [CARMEN, "ok-pt"] },
    amountCents: 12100,
    documentos: [{ nombre: "a.pdf", contentType: "application/pdf", url: "https://x/a.pdf", bytes: 1, sha256: "0".repeat(64) }],
  });
  const { calls } = await withFetch(() => ({ status: 200, body: { ok: true, encargoId: "e" } }), () => sendLavoriSolicitud(payload));
  assert.deepEqual(calls[0].body.candidatos, ["ok-pt"]);
  // si SOLO quedan excluidas, no sale nada
  const solo = { ...payload, candidatos: [CARMEN, MARGARITA] };
  const { out, calls: c2 } = await withFetch(() => ({ status: 200, body: { ok: true, encargoId: "e" } }), () => sendLavoriSolicitud(solo));
  assert.ok(!out.ok);
  assert.equal(c2.length, 0);
  // y la cartera viva tampoco las enseña (picker "todos" / uno en concreto)
  const { out: viva } = await withFetch(
    () => ({
      status: 200,
      body: {
        miembros: [
          { id: CARMEN, nombre: "Carmen", pares: ["PT>ES"], jurado: true, papelUnico: true, email: true },
          { id: "otra", nombre: "Otra", pares: ["PT>ES"], jurado: true, papelUnico: true, email: true },
        ],
      },
    }),
    () => fetchLavoriCartera("pt")
  );
  assert.deepEqual(viva.miembros.map((x) => x.id), ["otra"]);
});

// 4. FR no entra

test("4. francés: sendLavoriSolicitud lo corta para todos los caminos; solo forzarCasa lo deja salir", async () => {
  const payload = buildSolicitudPayload({
    reference: "26_FR",
    route: { lang: "fr", par: "FR>ES", candidatos: ["a", "b", "c", "d", "e", "f", "g"] },
    amountCents: 12100,
    documentos: [{ nombre: "a.pdf", contentType: "application/pdf", url: "https://x/a.pdf", bytes: 1, sha256: "0".repeat(64) }],
  });
  const { out, calls } = await withFetch(() => ({ status: 200, body: { ok: true, encargoId: "e" } }), () => sendLavoriSolicitud(payload));
  assert.ok(!out.ok);
  assert.match(out.ok ? "" : out.error, /casa/);
  assert.equal(calls.length, 0);
  const inversa = { ...payload, par: "ES>FR" };
  assert.ok(!(await withFetch(() => ({ status: 200, body: { ok: true, encargoId: "e" } }), () => sendLavoriSolicitud(inversa))).out.ok);
  // el staff, desde el constructor con candidatos explícitos, sí puede forzarlo
  const forzado = await withFetch(() => ({ status: 200, body: { ok: true, encargoId: "e" } }), () => sendLavoriSolicitud(payload, { forzarCasa: true }));
  assert.ok(forzado.out.ok);
  // el resto de pares no se ve afectado
  const pt = { ...payload, par: "PT>ES" };
  assert.ok((await withFetch(() => ({ status: 200, body: { ok: true, encargoId: "e" } }), () => sendLavoriSolicitud(pt))).out.ok);
});

// 5. Nombre del jurado

test("5. sameTranslatorName: mismas personas con tilde o nombre corto no cambian; otras personas sí", () => {
  assert.equal(sameTranslatorName("Maria Lourdes Yagüe", "María Lourdes Yagüe Lobo"), true);
  assert.equal(sameTranslatorName("Cristina Aguilera Viladés", "María Carmen Lencastre De Albuquerque Charrua"), false);
  assert.equal(sameTranslatorName("Leticia Sánchez Balsalobre", "María Lourdes Yagüe Lobo"), false);
  assert.equal(sameTranslatorName(null, "María Lourdes Yagüe Lobo"), false);
});
