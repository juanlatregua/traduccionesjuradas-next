import { test } from "node:test";
import assert from "node:assert/strict";
import { acuseRespuesta, conSeguimiento, loQuePide } from "../../../lib/entrada/acuse.ts";

const Q = "Del curso 2024-2025 solo ha llegado el boletín de notas del semestre 6, aunque en él consta la media del semestre 5: ¿puede enviar el boletín del semestre 5?";

test("lo que pide la pregunta de la lectura", () => {
  assert.equal(loQuePide(Q), "el boletín del semestre 5");
  assert.equal(loQuePide("¿Tiene el reverso del DNI?"), "el reverso del DNI");
  assert.equal(loQuePide("¿Para qué trámite necesitas la traducción?"), null);
});

test("caso Juan: pide una sola traducción y no dice si tiene el semestre 5 → acuse de agrupar + repregunta solo eso", () => {
  const a = acuseRespuesta("es", Q, "pon todo en una traducción jurada con una sola firma");
  assert.match(a.texto, /^Anotado: lo prepararemos como una sola traducción jurada; Juan lo confirma en el presupuesto\./);
  assert.equal(a.repregunta, "¿Y el boletín del semestre 5: lo tienes o seguimos sin él?");
});

test("tras «No lo tengo» / «Lo añado» la respuesta queda contestada y Juan lee ambas cosas juntas", () => {
  const r = conSeguimiento("es", Q, "pon todo en una traducción jurada con una sola firma", false);
  assert.equal(r, "pon todo en una traducción jurada con una sola firma · el boletín del semestre 5: no lo tengo");
  assert.equal(acuseRespuesta("es", Q, r).repregunta, null);
  assert.match(acuseRespuesta("es", Q, r).texto, /una sola traducción jurada/);
  assert.equal(acuseRespuesta("es", Q, conSeguimiento("es", Q, "x", true)).repregunta, null);
  for (const lang of ["fr", "en", "de", "pt"] as const) {
    for (const tiene of [true, false]) assert.equal(acuseRespuesta(lang, Q, conSeguimiento(lang, Q, "une seule traduction", tiene)).repregunta, null, `${lang} ${tiene}`);
  }
});

test("respuesta que sí contesta: acuse corriente, sin repregunta", () => {
  for (const r of ["Sí, ahora lo subo", "No lo tengo", "no", "Lo pido a la universidad", "Je ne l'ai pas", "I don't have it", "Não tenho"]) {
    assert.equal(acuseRespuesta("es", Q, r).repregunta, null, r);
  }
  assert.equal(acuseRespuesta("es", Q, "Sí").texto, "Anotado. Juan lo tiene en cuenta al preparar tu presupuesto.");
});

test("pregunta que no pide un documento: nunca repregunta", () => {
  assert.deepEqual(acuseRespuesta("es", "¿Para qué trámite necesitas la traducción?", "Homologación del título"), { texto: "Anotado. Juan lo tiene en cuenta al preparar tu presupuesto.", repregunta: null });
  assert.equal(acuseRespuesta("es", Q, "francés", { idioma: true }).repregunta, null);
});

test("los 5 idiomas: acuse de agrupar y repregunta en el idioma del cliente", () => {
  const cases = { fr: [/une seule traduction assermentée/, /vous l'avez/], en: [/single sworn translation/, /do you have it/], de: [/einzige beeidigte/, /Haben Sie es/], pt: [/uma só tradução juramentada/, /você tem/] } as const;
  for (const [lang, [ack, re]] of Object.entries(cases)) {
    const a = acuseRespuesta(lang as "fr", Q, "tout ensemble, une seule traduction");
    assert.match(a.texto, ack, lang);
    assert.match(a.repregunta ?? "", re, lang);
  }
  assert.match(acuseRespuesta("fr", Q, "merci").texto, /^C'est noté\. Juan en tient compte/);
});
