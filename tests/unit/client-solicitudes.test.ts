import test from "node:test";
import assert from "node:assert/strict";
import { langLabel, pendingSolicitudes, type SolicitudRow } from "../../lib/client-solicitudes.ts";
import { ackAreaLine, areaLinkLabel } from "../../lib/price-request-ack.ts";

const row = (o: Partial<SolicitudRow>): SolicitudRow => ({
  id: "e1", casoId: "c1", lang: "es", confirmedAt: new Date("2026-11-20T10:00:00Z"), createdAt: new Date("2026-11-20T09:00:00Z"),
  sourceLang: "fr", targetLang: "es", targetLangs: [], urgency: null, neededBy: null, documentos: 2, paginas: 5, ...o,
});

test("una solicitud cuyo caso ya tiene presupuesto o pedido no se duplica", () => {
  const r = pendingSolicitudes([row({ id: "a", casoId: "c1" }), row({ id: "b", casoId: "c2" })], [{ casoId: "c1" }, { casoId: null }]);
  assert.deepEqual(r.map((x) => x.id), ["b"]);
});

test("sin caso se queda, ordena por fecha desc y usa targetLang si no hay lista", () => {
  const r = pendingSolicitudes([
    row({ id: "old", casoId: null, confirmedAt: new Date("2026-11-01T00:00:00Z") }),
    row({ id: "new", casoId: null, confirmedAt: null, createdAt: new Date("2026-11-22T00:00:00Z"), targetLangs: ["es", "en"] }),
  ], []);
  assert.deepEqual(r.map((x) => x.id), ["new", "old"]);
  assert.deepEqual(r[0].targets, ["es", "en"]);
  assert.deepEqual(r[1].targets, ["es"]);
});

test("nombre del idioma según el idioma del cliente; unknown vacío", () => {
  assert.equal(langLabel("fr", "es-ES"), "francés");
  assert.equal(langLabel("fr", "en-GB"), "French");
  assert.equal(langLabel("unknown", "es-ES"), "");
  assert.equal(langLabel(null, "es-ES"), "");
});

test("enlace «Ver tu solicitud»: sin URL no hay línea; 5 idiomas", () => {
  assert.equal(ackAreaLine("es", null), "");
  assert.equal(ackAreaLine("fr", "https://x.test/a"), "Voir votre demande: https://x.test/a");
  for (const l of ["es", "fr", "en", "de", "pt", "zz"]) assert.ok(areaLinkLabel(l).length > 3);
});

test("el enlace del área va a producción, firmado y verificable (30 días)", async () => {
  process.env.ORDER_TOKEN_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "";
  const { buildClientPortalUrl, verifyClientToken } = await import("../../lib/client-token.ts");
  const url = new URL(buildClientPortalUrl("Ana@Example.com"));
  assert.equal(url.origin, "https://www.traduccionesjuradas.net");
  assert.equal(url.pathname, "/area-cliente");
  const email = url.searchParams.get("email")!;
  const token = url.searchParams.get("token")!;
  assert.equal(email, "ana@example.com");
  assert.ok(verifyClientToken(email, token));
  assert.ok(!verifyClientToken("otra@example.com", token));
  const exp = Number(token.split(".")[0]);
  assert.ok(Math.abs(exp - (Date.now() / 1000 + 30 * 86400)) < 60);
});
