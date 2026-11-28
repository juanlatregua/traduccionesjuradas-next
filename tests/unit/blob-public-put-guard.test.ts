import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Paso a Blob privado (RGPD): todo put NUEVO va por lib/blob-store.ts (putDoc).
// Lista blanca = los `access: "public"` que había el 28-nov-2026 (las fases 2-5
// los irán quitando). Si falla: usa putDoc en vez de put(..., { access: "public" }).
const ALLOWED: Record<string, number> = {
  "app/api/encargo/[token]/upload/route.ts": 1,
  "app/api/entrega/[token]/upload/route.ts": 1,
  "app/api/lavori/eventos/route.ts": 3,
  "app/api/orders/[reference]/documents/route.ts": 1,
  "app/api/orders/[reference]/payment-proof/route.ts": 1,
  "app/api/traduccion-automatica/route.ts": 1,
  "app/api/upload/route.ts": 1,
  "app/api/zona-traductor/expediente/agrupar/route.ts": 1,
  "components/AdminInboxPanel.tsx": 1,
  "components/entrada/PuertaPortada.tsx": 1,
  "components/entrada/PuertaV2.tsx": 1,
  "components/ExpedientePublicIntake.tsx": 1,
  "components/ia/DocumentUploader.tsx": 1,
  "components/QuoteJourney.tsx": 1,
  "components/StaffExpedienteIntake.tsx": 1,
  "lib/blob-store.ts": 1,
  "lib/expediente-unzip.ts": 1,
  "lib/inbox.ts": 2,
  "lib/lavori-lead.ts": 1,
  "lib/lavori-upload.ts": 1,
  "lib/quote-pdf.ts": 1,
  "lib/staff-upload-client.ts": 1,
  "lib/whatsapp-inbox.ts": 1,
};

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const RE = /access:\s*["'`]public["'`]/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

test('ningún put nuevo con access "public" fuera de lib/blob-store.ts', () => {
  const found: Record<string, number> = {};
  for (const d of ["app", "lib", "components", "hooks", "src"]) {
    let files: string[] = [];
    try {
      files = walk(join(ROOT, d));
    } catch {
      continue;
    }
    for (const f of files) {
      const n = (readFileSync(f, "utf8").match(RE) || []).length;
      if (n) found[relative(ROOT, f)] = n;
    }
  }
  const extra = Object.entries(found).filter(([f, n]) => n > (ALLOWED[f] ?? 0));
  assert.deepEqual(extra, [], `access "public" nuevo (usa putDoc de lib/blob-store.ts): ${JSON.stringify(extra)}`);
});
