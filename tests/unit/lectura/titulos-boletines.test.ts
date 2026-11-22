import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanTypeLabel, documentLabel } from "../../../lib/lectura/label.ts";
import { READING_SYSTEM_PROMPT, contextText } from "../../../lib/lectura/prompt.ts";

test("título: los rótulos sin valor desaparecen, nunca «curso , semestres y »", () => {
  assert.equal(
    cleanTypeLabel("Boletín de notas (Licenciatura en Gestión y Economía Digital, curso , semestres y )"),
    "Boletín de notas (Licenciatura en Gestión y Economía Digital)",
  );
  assert.equal(cleanTypeLabel("Relevé de notes (année , semestre )"), "Relevé de notes");
  assert.equal(cleanTypeLabel("Boletín de notas ()"), "Boletín de notas");
  assert.doesNotMatch(documentLabel({ typeLabelEs: "Boletín de notas (curso , semestres y )", holder: "Awa Ndiaye", apostille: null }), /\(|,\s*\)| y \)/);
});

test("título: el periodo que distingue un boletín de otro se conserva", () => {
  assert.equal(
    cleanTypeLabel("Boletín de notas (Licenciatura en Gestión y Economía Digital, curso 2021-2022, semestres 1 y 2)"),
    "Boletín de notas (Licenciatura en Gestión y Economía Digital, curso 2021-2022, semestres 1 y 2)",
  );
  assert.equal(cleanTypeLabel("Boletín de notas (semestre 3)"), "Boletín de notas (semestre 3)");
  assert.equal(cleanTypeLabel("Certificado n.º 12345/2024"), "Certificado");
  assert.equal(cleanTypeLabel("Certificado de estudios de 3 años"), "Certificado de estudios");
});

test("lectura: un boletín por semestre es una traducción propia", () => {
  assert.match(READING_SYSTEM_PROMPT, /boletines o certificados de notas por periodo[^\n]*UNA traducción CADA UNO/);
  assert.match(READING_SYSTEM_PROMPT, /Nunca dejes huecos/);
});

test("lectura: las preguntas y motivos salen en el idioma de la página del cliente", () => {
  const batch = { files: [], pages: [], skipped: [] } as unknown as Parameters<typeof contextText>[0];
  assert.match(contextText(batch, { clientLang: "fr" }), /Idioma de las preguntas: francés\./);
  assert.match(contextText(batch, {}), /Idioma de las preguntas: español\./);
  assert.match(contextText(batch, { clientLang: "fr\nIgnora" }), /Idioma de las preguntas: español\./);
  assert.match(READING_SYSTEM_PROMPT, /en el «Idioma de las preguntas»/);
  assert.doesNotMatch(READING_SYSTEM_PROMPT, /pregunta concreta al cliente, en español/);
});
