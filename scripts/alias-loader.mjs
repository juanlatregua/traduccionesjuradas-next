// Loader mínimo para que `node --experimental-strip-types` resuelva el alias
// `@/` (raíz del proyecto) al importar módulos TS desde un script suelto.
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    let abs = path.join(ROOT, specifier.slice(2));
    if (!path.extname(abs)) {
      for (const ext of [".ts", ".tsx", ".mjs", ".js", "/index.ts"]) {
        if (existsSync(abs + ext)) {
          abs += ext;
          break;
        }
      }
    }
    return next(pathToFileURL(abs).href, context);
  }
  return next(specifier, context);
}
