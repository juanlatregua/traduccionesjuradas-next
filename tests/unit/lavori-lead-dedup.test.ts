import test from "node:test";
import assert from "node:assert/strict";
import { leadDocKeys, leadDocKeyVariants, type LeadDocKeyed as LeadDoc } from "../../lib/lavori-doc-keys.ts";

// Caso real (19-sep-2026): Walid subió su certificado tres veces. Blob le dio
// una url distinta cada vez, así que la ref del lead salía distinta y la guarda
// de "repetido" no saltaba. Dos de las veces entró con OTRO email, así que el
// guardia por identidad tampoco. Resultado: tres encargos abiertos en lavori y
// dos presupuestos enviados al cliente, de 78,65 € y 58,08 €.
const HASH = "5e9327cad8c0f1aa2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7081920";

test("el MISMO fichero subido dos veces da la misma clave, aunque cambie la url", () => {
  const a: LeadDoc[] = [{ url: "https://blob.example/abc-1.jpeg", hash: HASH }];
  const b: LeadDoc[] = [{ url: "https://blob.example/xyz-2.jpeg", hash: HASH }];
  assert.equal(leadDocKeys(a), leadDocKeys(b));
});

test("ficheros distintos dan claves distintas", () => {
  const a: LeadDoc[] = [{ url: "https://blob.example/a.pdf", hash: HASH }];
  const b: LeadDoc[] = [{ url: "https://blob.example/b.pdf", hash: "otrohash" }];
  assert.notEqual(leadDocKeys(a), leadDocKeys(b));
});

test("sin hash (documentos anteriores al 19-sep) se sigue usando la url", () => {
  const a: LeadDoc[] = [{ url: "https://blob.example/viejo.pdf" }];
  const b: LeadDoc[] = [{ url: "https://blob.example/viejo.pdf" }];
  const c: LeadDoc[] = [{ url: "https://blob.example/otro.pdf" }];
  assert.equal(leadDocKeys(a), leadDocKeys(b));
  assert.notEqual(leadDocKeys(a), leadDocKeys(c));
});

test("el orden de los documentos no cambia la clave", () => {
  const a: LeadDoc[] = [{ url: "u1", hash: "h1" }, { url: "u2", hash: "h2" }];
  const b: LeadDoc[] = [{ url: "u2", hash: "h2" }, { url: "u1", hash: "h1" }];
  assert.equal(leadDocKeys(a), leadDocKeys(b));
});

test("el mismo fichero con distinto rango de páginas SÍ es otra solicitud", () => {
  const a: LeadDoc[] = [{ url: "u", hash: HASH, pageStart: 1, pageEnd: 2 }];
  const b: LeadDoc[] = [{ url: "u", hash: HASH, pageStart: 3, pageEnd: 4 }];
  assert.notEqual(leadDocKeys(a), leadDocKeys(b));
});

test("un expediente de dos documentos no colisiona con el de uno solo", () => {
  const uno: LeadDoc[] = [{ url: "u1", hash: "h1" }];
  const dos: LeadDoc[] = [{ url: "u1", hash: "h1" }, { url: "u2", hash: "h2" }];
  assert.notEqual(leadDocKeys(uno), leadDocKeys(dos));
});

// Caso real (5-oct-2026, Susana ES>PT): la puerta manda el documento sin pageEnd y
// el constructor con pageEnd = nº de páginas. Misma cosa, dos huellas.
test("documento entero: sin pageEnd (puerta) y con pageEnd = pageCount (constructor) dan la MISMA huella", () => {
  const puerta: LeadDoc[] = [{ url: "u", hash: HASH, pageCount: 3 }];
  const constructor: LeadDoc[] = [{ url: "u", hash: HASH, pageStart: 1, pageEnd: 3, pageCount: 3 }];
  assert.equal(leadDocKeys(puerta), leadDocKeys(constructor));
  const una: LeadDoc[] = [{ url: "u", hash: HASH, pageCount: 1 }];
  const unaB: LeadDoc[] = [{ url: "u", hash: HASH, pageStart: 1, pageEnd: 1, pageCount: 1 }];
  assert.equal(leadDocKeys(una), leadDocKeys(unaB));
});

test("un rango parcial de un documento más largo NO es el entero", () => {
  const entero: LeadDoc[] = [{ url: "u", hash: HASH, pageCount: 4 }];
  const parcial: LeadDoc[] = [{ url: "u", hash: HASH, pageStart: 1, pageEnd: 2, pageCount: 4 }];
  assert.notEqual(leadDocKeys(entero), leadDocKeys(parcial));
});

test("transición: las variantes de una solicitud nueva incluyen las dos huellas antiguas", () => {
  const puertaVieja = leadDocKeyVariants([{ url: "u", hash: HASH, pageCount: 3 }]);
  const constructorViejo = `${HASH}#1-3`;
  const puertaViejaKey = `${HASH}#1-`;
  assert.ok(puertaVieja.includes(puertaViejaKey));
  assert.ok(leadDocKeyVariants([{ url: "u", hash: HASH, pageStart: 1, pageEnd: 3, pageCount: 3 }]).includes(constructorViejo));
  // y ambas variantes se solapan: cualquiera de los dos orígenes reconoce al otro
  const a = new Set(leadDocKeyVariants([{ url: "u", hash: HASH, pageCount: 3 }]));
  const b = leadDocKeyVariants([{ url: "u", hash: HASH, pageStart: 1, pageEnd: 3, pageCount: 3 }]);
  assert.ok(b.some((k) => a.has(k)));
});
