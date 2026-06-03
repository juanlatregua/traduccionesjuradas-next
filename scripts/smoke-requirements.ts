// scripts/smoke-requirements.ts — Smoke test del lector de requerimientos.
//
// Ejercita lib/ai/requirements.ts (prompt + tabla HCCH + modelo) sobre un
// archivo real, sin pasar por el funnel de upload. Imprime el JSON crudo para
// auditar la prudencia YMYL del prompt.
//
//   node --experimental-strip-types scripts/smoke-requirements.ts <ruta> [lang]
//
// lang ∈ {es,fr,en,de,pt} (default es).

import fs from "node:fs";
import path from "node:path";
// @ts-ignore — registerHooks es API nueva, aún no en @types/node
import { registerHooks, createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// extract-text.ts usa require("pdf-parse"); en prod lo resuelve webpack, pero el
// runner ESM puro no tiene require global → shim para ejercitar el camino TEXT/Haiku.
// @ts-ignore
globalThis.require = createRequire(import.meta.url);

// Cargar .env.local (ANTHROPIC_API_KEY) — sin dependencia externa.
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

// Resolver alias @/ → cwd, y añadir .ts a imports extensionless (relativos y alias).
registerHooks({
  resolve(specifier: string, context: any, nextResolve: Function) {
    let spec = specifier;
    if (spec.startsWith("@/")) {
      spec = pathToFileURL(path.resolve(process.cwd(), spec.slice(2))).href;
    }
    const isPathish = spec.startsWith("file:") || spec.startsWith("./") || spec.startsWith("../");
    if (isPathish && !/\.(ts|tsx|js|mjs|cjs|json)$/.test(spec)) {
      try {
        return nextResolve(spec + ".ts", context);
      } catch {
        /* cae al intento normal */
      }
    }
    return nextResolve(spec, context);
  },
});

const mimeByExt: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
};

const filePath = process.argv[2];
const lang = process.argv[3] || "es";
if (!filePath) {
  console.error("Uso: node --experimental-strip-types scripts/smoke-requirements.ts <ruta> [lang]");
  process.exit(1);
}
if (!fs.existsSync(filePath)) {
  console.error("No existe el archivo:", filePath);
  process.exit(1);
}

const { analyzeRequirement } = await import("../lib/ai/requirements.ts");

const buffer = fs.readFileSync(filePath);
const ext = path.extname(filePath).toLowerCase();
const mimeType = mimeByExt[ext] || "application/pdf";
const fileName = path.basename(filePath);

console.error(`\n[smoke] archivo=${fileName} mime=${mimeType} lang=${lang} bytes=${buffer.length}\n`);

const t0 = Date.now();
const result = await analyzeRequirement({ buffer, mimeType, fileName, lang });
const ms = Date.now() - t0;

console.log(JSON.stringify(result, null, 2));
console.error(`\n[smoke] OK en ${ms}ms — isRequirement=${result.isRequirement} docs=${result.documents.length} country=${result.procedure?.country}\n`);
