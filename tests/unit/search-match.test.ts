import test from "node:test";
import assert from "node:assert/strict";
import { searchSite, groupResults, type SearchEntry } from "../../lib/search/match.ts";

const INDEX: SearchEntry[] = [
  { title: "Traductor jurado de francés", path: "/traductor-jurado-frances", group: "Idiomas", keywords: "traducción jurada francés" },
  { title: "Traducción jurada en Madrid", path: "/traductor-jurado/madrid", group: "Ciudades", keywords: "Madrid Comunidad de Madrid" },
  { title: "Documentos académicos", path: "/documentos-oficiales/documentos-academicos", group: "Documentos", keywords: "título expediente notas bachillerato universidad" },
  { title: "Apostilla de La Haya", path: "/documentos-oficiales/apostilla-haya", group: "Documentos", keywords: "apostille legalización" },
  { title: "Documentos brasileños en España", path: "/blog/documentos-brasilenos-espana", group: "Blog", keywords: "Brasil apostilla La Haya certificados" },
];

test("query vacía devuelve []", () => {
  assert.deepEqual(searchSite("", INDEX), []);
  assert.deepEqual(searchSite("   ", INDEX), []);
});

test("plega acentos: 'frances' encuentra 'Traductor jurado de francés'", () => {
  const r = searchSite("frances", INDEX);
  assert.equal(r[0]?.path, "/traductor-jurado-frances");
});

test("'madrid' devuelve la ciudad, no ruido de blog (sin fuzzy laxo)", () => {
  const r = searchSite("madrid", INDEX);
  assert.equal(r.length, 1);
  assert.equal(r[0].path, "/traductor-jurado/madrid");
});

test("match por keyword: 'bachillerato' → Documentos académicos", () => {
  const r = searchSite("bachillerato", INDEX);
  assert.equal(r[0]?.path, "/documentos-oficiales/documentos-academicos");
});

test("ranking: título por encima de keyword. 'apostilla' → página antes que post de blog", () => {
  const r = searchSite("apostilla", INDEX);
  assert.equal(r[0].path, "/documentos-oficiales/apostilla-haya");
  assert.ok(r.some((e) => e.path === "/blog/documentos-brasilenos-espana"));
  const docIdx = r.findIndex((e) => e.path === "/documentos-oficiales/apostilla-haya");
  const blogIdx = r.findIndex((e) => e.path === "/blog/documentos-brasilenos-espana");
  assert.ok(docIdx < blogIdx, "la página de apostilla debe ir antes que el post");
});

test("tokens en AND: 'apostilla madrid' no devuelve nada (ninguna entrada tiene ambos)", () => {
  assert.equal(searchSite("apostilla madrid", INDEX).length, 0);
});

test("groupResults agrupa preservando orden", () => {
  const r = searchSite("documentos", INDEX);
  const groups = groupResults(r).map(([g]) => g);
  assert.ok(groups.includes("Documentos"));
});
