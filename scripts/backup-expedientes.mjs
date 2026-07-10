// Backup local de expedientes: descarga los documentos fuente (DocumentAnalysis)
// de cada presupuesto (Quote con expedienteRef) y los adjuntos de sus pedidos a
// ~/Desktop/expedientes-backup/<quoteNumber>/<fileName>.
// Uso:  node scripts/backup-expedientes.mjs
import { readFileSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, basename } from "node:path";
import { PrismaClient } from "@prisma/client";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) {
  try {
    for (const line of readFileSync(resolve(root, f), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {}
}

const BACKUP_DIR = join(homedir(), "Desktop", "expedientes-backup");

function safeName(name) {
  return basename(name || "documento").replace(/[/\\:*?"<>|]/g, "_");
}

async function downloadFile(url, destPath, expectedSize) {
  try {
    const existing = await stat(destPath);
    if (expectedSize && existing.size === expectedSize) return "skipped";
  } catch {}
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(destPath, buf);
  return "downloaded";
}

const prisma = new PrismaClient();

const quotes = await prisma.quote.findMany({
  where: { expedienteRef: { not: null } },
  orderBy: { createdAt: "asc" },
  select: {
    quoteNumber: true,
    expedienteRef: true,
    orders: { select: { id: true, reference: true } },
  },
});

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const quote of quotes) {
  const expDocs = await prisma.documentAnalysis.findMany({
    where: { sessionToken: `exp:${quote.expedienteRef}` },
    select: { fileName: true, fileUrl: true, fileSize: true },
  });
  const orderIds = quote.orders.map((o) => o.id);
  const orderDocs = orderIds.length
    ? await prisma.documentAnalysis.findMany({
        where: { orderId: { in: orderIds } },
        select: { fileName: true, fileUrl: true, fileSize: true },
      })
    : [];

  const files = [...expDocs, ...orderDocs].filter(
    (d, i, arr) => d.fileUrl && arr.findIndex((x) => x.fileUrl === d.fileUrl) === i
  );
  if (files.length === 0) continue;

  const dir = join(BACKUP_DIR, safeName(quote.quoteNumber));
  await mkdir(dir, { recursive: true });
  console.log(`\n${quote.quoteNumber} (exp:${quote.expedienteRef}) — ${files.length} archivo(s)`);

  for (const file of files) {
    const dest = join(dir, safeName(file.fileName));
    try {
      const result = await downloadFile(file.fileUrl, dest, file.fileSize);
      if (result === "skipped") {
        skipped += 1;
        console.log(`  = ${file.fileName} (ya descargado)`);
      } else {
        downloaded += 1;
        console.log(`  ✓ ${file.fileName}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${file.fileName}: ${err.message}`);
    }
  }
}

console.log(
  `\nRESUMEN: ${quotes.length} presupuestos con expediente · ` +
  `${downloaded} descargados · ${skipped} ya existían · ${failed} fallos` +
  `\nCarpeta: ${BACKUP_DIR}`
);
await prisma.$disconnect();
process.exit(failed > 0 ? 1 : 0);
