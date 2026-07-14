// scripts/migrate-isp-taxtreatment.mjs
// Migra los gastos ISP históricos (vatRate 0 + nota de texto "Inversión del
// sujeto pasivo") al campo estructurado Expense.taxTreatment:
//   · isp_intracom — NIF del proveedor empieza por IE, o proveedor Microsoft/Adobe/Stripe
//   · isp_import   — proveedor Anthropic/Vercel/OpenAI (US, importación de servicios)
//
//   Modo simulación (por defecto):  node scripts/migrate-isp-taxtreatment.mjs
//   Escribir de verdad:             node scripts/migrate-isp-taxtreatment.mjs --commit

import { readFileSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  try {
    for (const l of readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^\s*(DATABASE_URL)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const COMMIT = process.argv.includes("--commit");

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const INTRACOM_SUPPLIERS = /microsoft|adobe|stripe/i;
const IMPORT_SUPPLIERS = /anthropic|vercel|openai/i;

function classify(e) {
  if ((e.supplierNif || "").trim().toUpperCase().startsWith("IE")) return "isp_intracom";
  if (INTRACOM_SUPPLIERS.test(e.supplier || "")) return "isp_intracom";
  if (IMPORT_SUPPLIERS.test(e.supplier || "")) return "isp_import";
  return null;
}

const candidates = await prisma.expense.findMany({
  where: { notes: { contains: "inversión del sujeto pasivo", mode: "insensitive" } },
  orderBy: { date: "asc" },
});

console.log(`${COMMIT ? "COMMIT" : "DRY-RUN (usa --commit para escribir)"} — ${candidates.length} gasto(s) con nota de ISP\n`);

let changed = 0;
let skipped = 0;
let unknown = 0;
for (const e of candidates) {
  const target = classify(e);
  const label = `${e.date.toISOString().slice(0, 10)}  ${(e.supplier || "(sin proveedor)").padEnd(30)} ${(e.baseCents / 100).toFixed(2)} €  [${e.taxTreatment}]`;
  if (!target) {
    unknown++;
    console.log(`  ?  ${label} → SIN CLASIFICAR (revisar a mano)`);
    continue;
  }
  if (e.taxTreatment === target) {
    skipped++;
    console.log(`  =  ${label} ya es ${target}`);
    continue;
  }
  changed++;
  console.log(`  →  ${label} → ${target}`);
  if (COMMIT) {
    await prisma.expense.update({ where: { id: e.id }, data: { taxTreatment: target } });
  }
}

console.log(`\n${COMMIT ? "Actualizados" : "Se actualizarían"}: ${changed} · ya correctos: ${skipped} · sin clasificar: ${unknown}`);
await prisma.$disconnect();
