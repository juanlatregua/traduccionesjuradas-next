// scripts/seed-recurring-expenses.mjs
// Da de alta las plantillas de gastos recurrentes (datos reales verificados del 2T-2026).
// Idempotente por label (no duplica si ya existe). Los variables (amountCents null)
// generan gastos "pendientes de confirmar" cada mes.
//
//   Modo simulación (por defecto):  node scripts/seed-recurring-expenses.mjs
//   Escribir de verdad:             node scripts/seed-recurring-expenses.mjs --commit
//
// Días elegidos para los variables (fecha típica de factura): Orange 5, Anthropic 5,
// Vercel 10, Stripe 28 (comisión del mes cerrado). Necesita DATABASE_URL en .env.local.

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

const TEMPLATES = [
  // ── Fijos (nacen contabilizados, needsReview=false) ──
  {
    label: "Nómina Isabelle",
    brand: "holabonjour",
    supplier: "Isabelle M.V. Guitton (nómina)",
    supplierNif: null,
    category: "nomina-especie",
    conceptTemplate: "Nómina Isabelle Guitton — {MES} {AÑO} (retribución en especie)",
    vatRate: 0,
    taxTreatment: "general",
    amountCents: 77766,
    dayOfMonth: 28,
  },
  {
    label: "TGSS aplazamiento",
    supplier: "TGSS",
    supplierNif: null,
    category: "seguros-sociales",
    conceptTemplate: "TGSS — cuota 023 deudas y fraccionamiento {MES} {AÑO}",
    vatRate: 0,
    taxTreatment: "general",
    amountCents: 10493,
    dayOfMonth: 28,
  },
  {
    label: "Laborlex asesoría",
    supplier: "LABORLEX ASESORES, S.L.",
    supplierNif: "B92733948",
    category: "asesoría",
    conceptTemplate: "Asesoramiento Fiscal-Contable-Laboral y cuota laboral nómina autónomo (dto. 25%) — {MES} {AÑO}",
    vatRate: 0.21,
    taxTreatment: "general",
    amountCents: 9082,
    dayOfMonth: 28,
  },
  {
    label: "Microsoft 365",
    supplier: "Microsoft Ireland Operations Ltd",
    supplierNif: "IE8256796U",
    category: "software",
    conceptTemplate: "Office 365 A3 (5 licencias) — {MES} {AÑO}",
    vatRate: 0,
    taxTreatment: "isp_intracom",
    amountCents: 1775,
    dayOfMonth: 7,
  },
  {
    label: "Adobe Creative Cloud",
    supplier: "Adobe Systems Software Ireland Ltd",
    supplierNif: "IE6364992H",
    category: "software",
    conceptTemplate: "Adobe Creative Cloud — {MES} {AÑO}",
    vatRate: 0,
    taxTreatment: "isp_intracom",
    amountCents: 6554,
    dayOfMonth: 27,
  },

  // ── Variables (amountCents null → nacen needsReview=true, se confirman a mano) ──
  {
    label: "Anthropic",
    supplier: "Anthropic, PBC",
    supplierNif: null,
    category: "software",
    conceptTemplate: "Claude — uso API/plan {MES} {AÑO}",
    vatRate: 0,
    taxTreatment: "isp_import",
    amountCents: null,
    dayOfMonth: 5,
  },
  {
    label: "Vercel",
    supplier: "Vercel Inc.",
    supplierNif: null,
    category: "software",
    conceptTemplate: "Vercel (hosting) — {MES} {AÑO}",
    vatRate: 0,
    taxTreatment: "isp_import",
    amountCents: null,
    dayOfMonth: 10,
  },
  {
    label: "Stripe comisión",
    supplier: "Stripe Technology Europe Ltd",
    supplierNif: "IE3206488LH",
    category: "comisiones",
    conceptTemplate: "Comisiones Stripe — {MES} {AÑO}",
    vatRate: 0,
    taxTreatment: "isp_intracom",
    amountCents: null,
    dayOfMonth: 28,
  },
  {
    label: "Orange",
    supplier: "Orange Espagne, S.A.U.",
    supplierNif: "A82009812",
    category: "telefonía",
    conceptTemplate: "Orange — {MES} {AÑO}",
    vatRate: 0.21,
    taxTreatment: "general",
    amountCents: null,
    dayOfMonth: 5,
    lineItemsJson: [
      { concept: "Servicios telecomunicaciones — {MES} {AÑO}", baseCents: 0, vatRate: 0.21, ivaDeducible: true },
      { concept: "Orange: servicios exentos + compra dispositivos a plazos — {MES} {AÑO} (sin IVA deducible)", baseCents: 0, vatRate: 0, ivaDeducible: false },
    ],
  },
];

const eur = (c) => (c == null ? "variable" : (c / 100).toFixed(2) + " €");
let created = 0, skipped = 0;

for (const t of TEMPLATES) {
  const exists = await prisma.recurringExpense.findFirst({ where: { label: t.label } });
  if (exists) {
    console.log(`  = SKIP  ${t.label.padEnd(24)} ya existe`);
    skipped++;
    continue;
  }
  const lines = t.lineItemsJson ? ` [${t.lineItemsJson.length} líneas]` : "";
  console.log(`  ${COMMIT ? "+" : "·"} ${t.label.padEnd(24)} día ${String(t.dayOfMonth).padStart(2)}  ${eur(t.amountCents).padStart(10)}  ${t.taxTreatment}${lines}`);
  if (!COMMIT) { created++; continue; }

  await prisma.recurringExpense.create({
    data: {
      label: t.label,
      active: true,
      brand: t.brand || "traduccionesjuradas",
      supplier: t.supplier,
      supplierNif: t.supplierNif,
      category: t.category,
      conceptTemplate: t.conceptTemplate,
      lineItemsJson: t.lineItemsJson ?? undefined,
      vatRate: t.vatRate,
      taxTreatment: t.taxTreatment,
      irpfRetentionPct: 0,
      amountCents: t.amountCents,
      dayOfMonth: t.dayOfMonth,
    },
  });
  created++;
}

console.log(`\n${COMMIT ? "HECHO" : "SIMULACIÓN"} — nuevas: ${created}, ya existentes: ${skipped}`);
if (!COMMIT) console.log("Para escribir de verdad:  node scripts/seed-recurring-expenses.mjs --commit");
await prisma.$disconnect();
