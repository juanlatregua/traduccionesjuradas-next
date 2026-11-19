// Rellena DocumentAnalysis.fileHash (sha256 de los bytes) en filas de los últimos 30 días que lo
// tienen a NULL. DRY-RUN por defecto: no escribe; con --apply sí. Tope 200 filas y 25 MB por archivo.
//   npx tsx --env-file=.env.local scripts/backfill-filehash.ts [--apply] [--days=30]
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";

const APPLY = process.argv.includes("--apply");
const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.slice(7)) || 30;
const MAX_ROWS = 200;
const MAX_BYTES = 25 * 1024 * 1024;

async function main() {
  const since = new Date(Date.now() - DAYS * 864e5);
  const rows = await prisma.documentAnalysis.findMany({
    where: { fileHash: null, fileUrl: { not: "" }, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: { id: true, fileName: true, fileUrl: true, fileSize: true, sessionToken: true, clientEmail: true, clientPhone: true },
  });
  console.log(`${APPLY ? "APPLY" : "DRY-RUN"} · ${rows.length} fila(s) sin fileHash en ${DAYS} días (tope ${MAX_ROWS})`);
  const computed: { id: string; name: string; session: string | null; hash: string }[] = [];
  let skipped = 0, failed = 0;
  for (const r of rows) {
    try {
      if (r.fileSize > MAX_BYTES) { skipped++; console.log(`  salto >25 MB: ${r.fileName}`); continue; }
      const res = await fetch(r.fileUrl);
      if (!res.ok) { failed++; console.log(`  fallo ${res.status}: ${r.fileName}`); continue; }
      const len = Number(res.headers.get("content-length") || 0);
      if (len > MAX_BYTES) { skipped++; console.log(`  salto >25 MB: ${r.fileName}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) { skipped++; continue; }
      computed.push({ id: r.id, name: r.fileName, session: r.sessionToken, hash: createHash("sha256").update(buf).digest("hex") });
    } catch (e: any) { failed++; console.log(`  error: ${r.fileName}: ${e?.message}`); }
  }
  // Colisiones: mismo hash en sesiones distintas, entre las calculadas y las ya guardadas.
  const hashes = [...new Set(computed.map((c) => c.hash))];
  const known = hashes.length ? await prisma.documentAnalysis.findMany({ where: { fileHash: { in: hashes } }, select: { fileHash: true, sessionToken: true, fileName: true } }) : [];
  const groups = new Map<string, Set<string>>();
  for (const c of computed) groups.set(c.hash, new Set([...(groups.get(c.hash) || []), c.session || `(sin sesión) ${c.id}`]));
  for (const k of known) groups.set(k.fileHash!, new Set([...(groups.get(k.fileHash!) || []), k.sessionToken || "(sin sesión)"]));
  const collisions = [...groups.entries()].filter(([, s]) => s.size > 1);
  console.log(`calculadas ${computed.length} · saltadas ${skipped} · fallidas ${failed} · colisiones entre sesiones ${collisions.length}`);
  for (const [h, s] of collisions) console.log(`  ${h.slice(0, 16)}… (${computed.find((c) => c.hash === h)?.name ?? "ya guardado"}) en: ${[...s].join(" | ")}`);
  if (APPLY) {
    for (const c of computed) await prisma.documentAnalysis.update({ where: { id: c.id }, data: { fileHash: c.hash } });
    console.log(`escritas ${computed.length} huellas`);
  } else console.log("Sin cambios (dry-run). Añade --apply para escribir.");
  const t = computed.filter((c) => c.session === "exp:EXP-QARAXZ");
  if (t.length) console.log(`EXP-QARAXZ → ${t.map((c) => c.hash.slice(0, 16)).join(", ")} ${t.some((c) => c.hash.startsWith("1176acb13419e259")) ? "(COINCIDE con 1176acb1…)" : "(no coincide)"}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
