import { test } from "node:test";
import assert from "node:assert/strict";
import { HILO_T } from "../../../lib/entrada/hilo-i18n.ts";

test("resumen de la lectura: el verbo concuerda con el número de archivos en los 5 idiomas", () => {
  const one = { es: /1 archivo que corresponde a 4 documentos/, fr: /1 fichier qui correspond à 4 documents/, en: /1 file that makes up 4 documents/, de: /1 Datei hochgeladen, die 4 Dokumente ergibt/, pt: /1 arquivo que corresponde a 4 documentos/ } as const;
  const many = { es: /3 archivos que corresponden a 1 documento:/, fr: /3 fichiers qui correspondent à 1 document :/, en: /3 files that make up 1 document:/, de: /3 Dateien hochgeladen, die 1 Dokument ergeben/, pt: /3 arquivos que correspondem a 1 documento:/ } as const;
  for (const l of ["es", "fr", "en", "de", "pt"] as const) {
    assert.match(HILO_T[l].resumenLectura(1, 4), one[l]);
    assert.match(HILO_T[l].resumenLectura(3, 1), many[l]);
  }
});
