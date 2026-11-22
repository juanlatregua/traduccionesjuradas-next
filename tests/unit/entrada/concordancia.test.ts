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

test("vista: cada documento apunta a las páginas de los archivos del cliente (miniaturas)", async () => {
  const { partesOf } = await import("../../../lib/entrada/view.ts");
  const files = [{ position: 1, url: "u/a.pdf" }, { position: 2, url: "u/b.jpg" }, { position: 3, url: "u/borrado.jpg" }];
  const archivos = [{ id: "A", url: "u/a.pdf" }, { id: "B", url: "u/b.jpg" }];
  const d = {
    parts: [{ fileIndex: 1, page: 3 }, { fileIndex: 1, page: 4 }, { fileIndex: 3, page: 1 }],
    annexes: [],
    apostille: { parts: [{ fileIndex: 2, page: 1 }], onDocumentPage: false, number: null, matchedBy: "weak" as const },
  };
  assert.deepEqual(partesOf(d, files, archivos), [
    { archivoId: "A", page: 3, rol: "pagina" },
    { archivoId: "A", page: 4, rol: "pagina" },
    { archivoId: "B", page: 1, rol: "apostilla" },
  ]);
});
