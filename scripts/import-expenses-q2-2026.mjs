// scripts/import-expenses-q2-2026.mjs
// Carga los gastos (facturas recibidas) del 2º trimestre 2026 desde el folder
// del Escritorio, subiendo cada PDF/imagen a Vercel Blob y creando el Expense.
//
//   Modo simulación (por defecto):  node scripts/import-expenses-q2-2026.mjs
//   Escribir de verdad:             node scripts/import-expenses-q2-2026.mjs --commit
//
// Idempotente por número de factura (no duplica si ya existe). Intracomunitarios
// e importación → IVA 0 con nota de ISP (autorrepercusión 303). Necesita
// DATABASE_URL y BLOB_READ_WRITE_TOKEN en .env.local.

import { readFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

for (const f of [".env.local", ".env"]) {
  try {
    for (const l of readFileSync(f, "utf8").split("\n")) {
      const m = l.match(/^\s*(DATABASE_URL|BLOB_READ_WRITE_TOKEN)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  } catch {}
}

const COMMIT = process.argv.includes("--commit");
const DIR = "/Users/nip/Desktop/2trimestes";

const { PrismaClient } = await import("@prisma/client");
const { put } = await import("@vercel/blob");
const prisma = new PrismaClient();

const ISP_NOTE = "Inversión del sujeto pasivo (art. 84 LIVA) — IVA autorrepercutido por HBTJ en el 303. Factura sin IVA (intracomunitario/importación de servicios).";

// base/vat en céntimos. vatRate en fracción. Cada entrada -> un Expense.
const ENTRIES = [
  // ── LABORLEX (asesoría, 21%) — la de abril (1274) ya está cargada ──
  { file: "261F0001682-01464F.PDF", date: "2026-05-31", supplier: "LABORLEX ASESORES, S.L.", nif: "B92733948", num: "1682", concept: "Asesoramiento Fiscal-Contable-Laboral y cuota laboral nómina autónomo (dto. 25%)", category: "asesoría", base: 9082, vatRate: 0.21 },
  { file: "261F0001979-01464F.PDF", date: "2026-06-30", supplier: "LABORLEX ASESORES, S.L.", nif: "B92733948", num: "1979", concept: "Asesoramiento Fiscal-Contable-Laboral y cuota laboral nómina autónomo (dto. 25%)", category: "asesoría", base: 9082, vatRate: 0.21 },

  // ── ORANGE (telefonía) — dos líneas por factura: servicios 21% + (exento+dispositivos a plazos) sin IVA ──
  { file: "orange abril 26.pdf", date: "2026-04-05", supplier: "Orange Espagne, S.A.U.", nif: "A82009812", num: "E10010903935-0426", concept: "Servicios telecomunicaciones (marzo)", category: "telefonía", base: 8388, vatRate: 0.21 },
  { file: "orange abril 26.pdf", date: "2026-04-05", supplier: "Orange Espagne, S.A.U.", nif: "A82009812", num: "E10010903935-0426-B", concept: "Orange: servicios exentos (15,50) + compra dispositivos a plazos (56,22) — sin IVA deducible", category: "telefonía", base: 7172, vatRate: 0 },
  // mayo Row A = corrige el apunte de banco existente (ver UPDATE_MAY abajo)
  { file: "orange mayo 26.pdf", date: "2026-05-05", supplier: "Orange Espagne, S.A.U.", nif: "A82009812", num: "E10011001559-0526-B", concept: "Orange: servicios exentos (15,50) + compra dispositivos a plazos (56,22) — sin IVA deducible", category: "telefonía", base: 7172, vatRate: 0 },
  { file: "orange junio26.pdf", date: "2026-06-05", supplier: "Orange Espagne, S.A.U.", nif: "A82009812", num: "E10011099302-0626", concept: "Servicios telecomunicaciones (mayo)", category: "telefonía", base: 9726, vatRate: 0.21 },
  { file: "orange junio26.pdf", date: "2026-06-05", supplier: "Orange Espagne, S.A.U.", nif: "A82009812", num: "E10011099302-0626-B", concept: "Orange: compra dispositivos a plazos (66,84) — sin IVA deducible", category: "telefonía", base: 6684, vatRate: 0 },

  // ── MICROSOFT Office 365 (Irlanda, ISP, IVA 0) ──
  { file: "E0100Z6UCA.pdf", date: "2026-04-07", supplier: "Microsoft Ireland Operations Ltd", nif: "IE8256796U", num: "E0100Z6UCA", concept: "Office 365 A3 (5 licencias)", category: "software", base: 1775, vatRate: 0, note: ISP_NOTE },
  { file: "E0100ZFFG1.pdf", date: "2026-05-07", supplier: "Microsoft Ireland Operations Ltd", nif: "IE8256796U", num: "E0100ZFFG1", concept: "Office 365 A3 (5 licencias)", category: "software", base: 1775, vatRate: 0, note: ISP_NOTE },
  { file: "E0100ZNUI2.pdf", date: "2026-06-07", supplier: "Microsoft Ireland Operations Ltd", nif: "IE8256796U", num: "E0100ZNUI2", concept: "Office 365 A3 (5 licencias)", category: "software", base: 1775, vatRate: 0, note: ISP_NOTE },

  // ── ADOBE (Irlanda, ISP, IVA 0). El abono de -52,43 se trata aparte (rectificativa, no soportada como gasto negativo) ──
  { file: "invoice-4.pdf", date: "2026-04-27", supplier: "Adobe Systems Software Ireland Ltd", nif: "IE6364992H", num: "IEE2026007827699", concept: "Adobe Creative Cloud", category: "software", base: 6554, vatRate: 0, note: ISP_NOTE },
  { file: "invoice-3.pdf", date: "2026-05-27", supplier: "Adobe Systems Software Ireland Ltd", nif: "IE6364992H", num: "IEE2026009891211", concept: "Adobe Creative Cloud", category: "software", base: 6554, vatRate: 0, note: ISP_NOTE },
  { file: "invoice.pdf", date: "2026-06-03", supplier: "Adobe Systems Software Ireland Ltd", nif: "IE6364992H", num: "IEE2026010341071", concept: "Adobe Acrobat Pro", category: "software", base: 1999, vatRate: 0, note: ISP_NOTE },

  // ── ANTHROPIC (EUR, ISP, IVA 0) ──
  { file: "Invoice-NQTHQ5HS-0005.pdf", date: "2026-04-29", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0005", concept: "Claude — uso API/plan", category: "software", base: 3825, vatRate: 0, note: ISP_NOTE },
  { file: "Invoice-NQTHQ5HS-0006.pdf", date: "2026-05-03", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0006", concept: "Claude — uso API/plan", category: "software", base: 9000, vatRate: 0, note: ISP_NOTE },
  { file: "Invoice-NQTHQ5HS-0007.pdf", date: "2026-05-04", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0007", concept: "Claude — uso API/plan", category: "software", base: 1017, vatRate: 0, note: ISP_NOTE },
  { file: "Invoice-NQTHQ5HS-0008.pdf", date: "2026-05-19", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0008", concept: "Claude — uso API/plan", category: "software", base: 1005, vatRate: 0, note: ISP_NOTE },
  { file: "Invoice-NQTHQ5HS-0009.pdf", date: "2026-05-19", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0009", concept: "Claude — uso API/plan", category: "software", base: 1096, vatRate: 0, note: ISP_NOTE },
  { file: "Invoice-NQTHQ5HS-0010.pdf", date: "2026-06-03", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0010", concept: "Claude — uso API/plan", category: "software", base: 9000, vatRate: 0, note: ISP_NOTE },
  { file: "Invoice-NQTHQ5HS-0011.pdf", date: "2026-06-06", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0011", concept: "Claude — uso API/plan", category: "software", base: 3825, vatRate: 0, note: ISP_NOTE },
  { file: "Invoice-NQTHQ5HS-0012.pdf", date: "2026-06-07", supplier: "Anthropic, PBC", nif: null, num: "NQTHQ5HS-0012", concept: "Claude — uso API/plan", category: "software", base: 10020, vatRate: 0, note: ISP_NOTE },

  // ── VERCEL (USD → EUR, tipo BCE del día de la factura, ISP importación EEUU, IVA 0) ──
  { file: "Invoice-DOCCDF6F-0002.pdf", date: "2026-04-10", supplier: "Vercel Inc.", nif: null, num: "DOCCDF6F-0002", concept: "Vercel (hosting) — $24,20 × 0,8539 BCE", category: "software", base: 2066, vatRate: 0, note: ISP_NOTE + " Importe original 24,20 USD, tipo BCE 10/04/2026 = 0,8539." },
  { file: "Invoice-DOCCDF6F-0003.pdf", date: "2026-05-10", supplier: "Vercel Inc.", nif: null, num: "DOCCDF6F-0003", concept: "Vercel (hosting) — $20,00 × 0,85027 BCE", category: "software", base: 1701, vatRate: 0, note: ISP_NOTE + " Importe original 20,00 USD, tipo BCE 08/05/2026 = 0,85027." },
  { file: "Invoice-DOCCDF6F-0004.pdf", date: "2026-06-02", supplier: "Vercel Inc.", nif: null, num: "DOCCDF6F-0004", concept: "Vercel (hosting) — $25,26 × 0,85844 BCE", category: "software", base: 2168, vatRate: 0, note: ISP_NOTE + " Importe original 25,26 USD, tipo BCE 02/06/2026 = 0,85844." },
  { file: "Invoice-DOCCDF6F-0006.pdf", date: "2026-06-10", supplier: "Vercel Inc.", nif: null, num: "DOCCDF6F-0006", concept: "Vercel (hosting) — $34,83 × 0,86663 BCE", category: "software", base: 3018, vatRate: 0, note: ISP_NOTE + " Importe original 34,83 USD, tipo BCE 10/06/2026 = 0,86663." },

  // ── MODIFIX (protector cristal, 21%) ──
  { file: "WhatsApp Image 2026-06-30 at 18.53.39.jpeg", date: "2026-06-29", supplier: "Modifix (Jiangping Yang)", nif: "X7335574T", num: "2026000084", concept: "Protector de cristal (móvil)", category: "material", base: 1240, vatRate: 0.21 },
];

const eur = (c) => (c / 100).toFixed(2);
let created = 0, skipped = 0, uploaded = 0;

for (const e of ENTRIES) {
  const path = `${DIR}/${e.file}`;
  const exists = await prisma.expense.findFirst({ where: { supplierInvoiceNumber: e.num } });
  if (exists) {
    console.log(`  = SKIP  ${e.num.padEnd(20)} ya existe (${eur(exists.baseCents)} base)`);
    skipped++;
    continue;
  }
  const vat = Math.round(e.base * e.vatRate);
  console.log(`  ${COMMIT ? "+" : "·"} ${e.num.padEnd(20)} ${e.date}  ${e.supplier.slice(0, 24).padEnd(24)}  base ${eur(e.base).padStart(7)}  IVA ${eur(vat).padStart(6)}  [${e.file}]`);
  if (!COMMIT) { created++; continue; }

  if (!existsSync(path)) { console.log(`     ! FALTA el archivo ${path} — omitido`); continue; }
  const buf = readFileSync(path);
  const ext = e.file.split(".").pop().toLowerCase();
  const ct = ext === "jpeg" || ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "application/pdf";
  const blob = await put(`gastos/2026-q2/${e.num}-${basename(e.file)}`, buf, { access: "public", addRandomSuffix: true, contentType: ct });
  uploaded++;

  await prisma.expense.create({
    data: {
      date: new Date(e.date),
      brand: "traduccionesjuradas",
      supplier: e.supplier,
      supplierNif: e.nif,
      supplierInvoiceNumber: e.num,
      concept: e.concept,
      category: e.category,
      baseCents: e.base,
      vatRate: e.vatRate,
      vatCents: vat,
      ivaDeducible: true,
      irpfRetentionPct: 0,
      irpfCents: 0,
      totalCents: e.base + vat,
      payableCents: e.base + vat,
      attachmentUrl: blob.url,
      attachmentKey: blob.pathname,
      attachmentName: e.file,
      notes: e.note || null,
    },
  });
  created++;
}

// ── ORANGE MAYO: corregir el apunte de banco existente (base 172,96 / IVA 0) → servicios 21% ──
const mayBank = await prisma.expense.findFirst({
  where: { concept: { contains: "ADEUDO ORANGE" }, date: { gte: new Date("2026-05-01"), lt: new Date("2026-06-01") } },
});
if (mayBank && !mayBank.supplierInvoiceNumber) {
  console.log(`\n  ~ ORANGE MAYO: corregir apunte banco ${mayBank.id.slice(0, 8)} (base ${eur(mayBank.baseCents)} IVA 0) → base 83,67 + IVA 17,57`);
  if (COMMIT) {
    await prisma.expense.update({
      where: { id: mayBank.id },
      data: {
        supplier: "Orange Espagne, S.A.U.", supplierNif: "A82009812", supplierInvoiceNumber: "E10011001559-0526",
        concept: "Servicios telecomunicaciones (abril)", category: "telefonía",
        baseCents: 8367, vatRate: 0.21, vatCents: 1757, totalCents: 10124, payableCents: 10124,
        notes: "Corrección: el apunte era el cargo de banco (172,96) sin desglose. Parte exenta+dispositivos (71,72) en línea aparte. ⚠ RE-VERIFICAR conciliación bancaria de Orange mayo (ahora en 2 líneas).",
      },
    });
  }
} else {
  console.log(`\n  ~ ORANGE MAYO: no encontrado apunte de banco corregible (o ya corregido).`);
}

console.log(`\n${COMMIT ? "HECHO" : "SIMULACIÓN"} — nuevos: ${created}, ya existentes: ${skipped}, PDFs subidos: ${uploaded}`);
if (!COMMIT) console.log("Para escribir de verdad:  node scripts/import-expenses-q2-2026.mjs --commit");
await prisma.$disconnect();
