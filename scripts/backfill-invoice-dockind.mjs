// Backfill docKind="quote" en los ClientInvoice que son PRESUPUESTOS emitidos
// por el módulo de facturas (comparten serie AA_NNN pero no son facturas).
// Uso:  node scripts/backfill-invoice-dockind.mjs            → dry-run (lista)
//       node scripts/backfill-invoice-dockind.mjs --apply    → aplica
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
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

const NUMBERS = ["26_011", "26_030", "26_033", "26_041", "26_045"];
const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient();
const rows = await prisma.clientInvoice.findMany({
  where: { number: { in: NUMBERS } },
  select: {
    id: true, number: true, status: true, docKind: true, fiscalName: true,
    clientName: true, concept: true, totalCents: true, issuedAt: true, paidAt: true,
    order: { select: { reference: true } },
  },
  orderBy: { number: "asc" },
});

for (const r of rows) {
  console.log(
    `${r.number} · ${r.status} · docKind=${r.docKind} · ${(r.totalCents / 100).toFixed(2)}€ · ` +
    `${r.fiscalName}${r.clientName ? ` (${r.clientName})` : ""} · concepto="${r.concept || "—"}" · ` +
    `pedido=${r.order?.reference || "—"} · emitida=${r.issuedAt?.toISOString().slice(0, 10) || "—"} · pagada=${r.paidAt ? "sí" : "no"}`
  );
}
const missing = NUMBERS.filter((n) => !rows.some((r) => r.number === n));
if (missing.length) console.log("NO ENCONTRADAS:", missing.join(", "));

if (APPLY) {
  const res = await prisma.clientInvoice.updateMany({
    where: { number: { in: rows.map((r) => r.number) }, docKind: "invoice" },
    data: { docKind: "quote" },
  });
  console.log(`\nAPLICADO: ${res.count} filas → docKind=quote`);
} else {
  console.log("\nDRY-RUN (nada tocado). Ejecuta con --apply para marcar como quote.");
}
await prisma.$disconnect();
