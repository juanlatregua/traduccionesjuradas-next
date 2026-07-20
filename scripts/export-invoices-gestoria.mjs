// scripts/export-invoices-gestoria.mjs
// SOLO LECTURA. Genera un paquete para la gestoría con TODAS las facturas
// EMITIDAS (ClientInvoice status=ISSUED) de un periodo: un PDF por factura +
// un CSV contable. No escribe nada en la BD.
//
// Uso:
//   node --experimental-strip-types --import ./scripts/alias-loader.mjs \
//        scripts/export-invoices-gestoria.mjs 2026 6
//   (año mes)  →  carpeta ./exports/facturas-2026-06/ + zip
//
// Necesita DATABASE_URL en .env (o .env.local).

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Cargar DATABASE_URL de .env / .env.local (línea simple) ──
function loadEnv(name) {
  for (const f of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(join(ROOT, f), "utf8");
      for (const line of txt.split("\n")) {
        const m = line.match(new RegExp(`^\\s*${name}\\s*=\\s*(.*)$`));
        if (m) return m[1].trim().replace(/^["']|["']$/g, "");
      }
    } catch {}
  }
  return undefined;
}
if (!process.env.DATABASE_URL) {
  const v = loadEnv("DATABASE_URL");
  if (v) process.env.DATABASE_URL = v;
}
if (!process.env.DATABASE_URL) {
  console.error("Falta DATABASE_URL en .env / .env.local");
  process.exit(1);
}

const { PrismaClient } = await import("@prisma/client");
const { generateInvoicePdf } = await import("@/lib/invoice-pdf.ts");
const { getBrand } = await import("@/lib/invoice-brands.ts");

const year = Number(process.argv[2] || 2026);
const period = String(process.argv[3] || "6"); // "1".."12" (mes) o "Q1".."Q4"/"T1".."T4" (trimestre)
if (!(year >= 2020)) {
  console.error("Uso: node ... export-invoices-gestoria.mjs <year> <mes 1-12 | Q1-Q4>");
  process.exit(1);
}

let gte, lt, tag;
const qm = period.match(/^[QqTt]([1-4])$/);
if (qm) {
  const q = Number(qm[1]);
  const startMonth = (q - 1) * 3;
  gte = new Date(Date.UTC(year, startMonth, 1));
  lt = new Date(Date.UTC(year, startMonth + 3, 1));
  tag = `${year}-T${q}`;
} else {
  const month = Number(period);
  if (!(month >= 1 && month <= 12)) { console.error("Mes inválido (1-12) o trimestre (Q1-Q4)."); process.exit(1); }
  gte = new Date(Date.UTC(year, month - 1, 1));
  lt = new Date(Date.UTC(year, month, 1));
  tag = `${year}-${String(month).padStart(2, "0")}`;
}

const prisma = new PrismaClient();

function eur(cents) {
  return (cents / 100).toFixed(2).replace(".", ",");
}
function csvCell(v) {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function loadBrandLogo(brandKey) {
  const brand = getBrand(brandKey);
  if (brand.logo.kind !== "image") return undefined;
  try {
    const buf = readFileSync(join(ROOT, brand.logo.path));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

const invoices = await prisma.clientInvoice.findMany({
  where: { status: "ISSUED", issuedAt: { gte, lt } },
  orderBy: { number: "asc" },
  include: { order: { select: { reference: true } } },
});

if (invoices.length === 0) {
  console.log(`No hay facturas EMITIDAS con issuedAt en ${tag}.`);
  await prisma.$disconnect();
  process.exit(0);
}

const outDir = join(ROOT, "exports", `facturas-${tag}`);
if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

let totalBase = 0,
  totalVat = 0,
  totalTotal = 0;

const header = [
  "Numero",
  "Fecha",
  "Pedido",
  "Cliente",
  "NIF",
  "Base imponible",
  "IVA %",
  "Cuota IVA",
  "Total",
  "Email",
].join(";");

const rows = [];

for (const inv of invoices) {
  const lines = Array.isArray(inv.lineItemsJson) ? inv.lineItemsJson : undefined;
  const pdf = generateInvoicePdf({
    reference: inv.order?.reference,
    title: inv.concept || lines?.[0]?.description || "Traducción jurada",
    amountCents: inv.totalCents,
    baseCents: inv.baseCents,
    vatCents: inv.vatCents,
    vatRate: inv.vatRate,
    brand: inv.brand,
    logoDataUrl: loadBrandLogo(inv.brand),
    poNumber: inv.poNumber,
    holderNames: inv.holderNames,
    simplified: inv.simplified,
    draft: false,
    langPair: inv.langPair,
    createdAt: inv.createdAt,
    invoiceNumber: inv.number || undefined,
    issuedAt: inv.issuedAt,
    lines: lines && lines.length > 0 ? lines : undefined,
    billing: {
      fiscalName: inv.fiscalName,
      nif: inv.nif || "",
      address: inv.address || "",
      city: inv.city || "",
      postalCode: inv.postalCode || "",
      country: inv.country || "España",
      email: inv.email || "",
    },
  });
  const fname = `${(inv.number || `borrador-${inv.id.slice(0, 8)}`).replace(/[^\w.-]/g, "_")}.pdf`;
  writeFileSync(join(outDir, fname), Buffer.from(pdf));

  totalBase += inv.baseCents;
  totalVat += inv.vatCents;
  totalTotal += inv.totalCents;

  rows.push(
    [
      inv.number || "",
      (inv.issuedAt || inv.createdAt).toISOString().slice(0, 10),
      inv.order?.reference || "",
      inv.fiscalName,
      inv.nif || "",
      eur(inv.baseCents),
      String(Math.round(inv.vatRate * 100)),
      eur(inv.vatCents),
      eur(inv.totalCents),
      inv.email || "",
    ]
      .map(csvCell)
      .join(";")
  );
  console.log(`  ✓ ${fname}  ${eur(inv.totalCents)} €  ${inv.fiscalName}`);
}

const csv = "﻿" + [header, ...rows].join("\r\n");
writeFileSync(join(outDir, `facturas-${tag}.csv`), csv);

await prisma.$disconnect();

// ── ZIP ──
const zipPath = join(ROOT, "exports", `facturas-${tag}.zip`);
if (existsSync(zipPath)) rmSync(zipPath);
try {
  execFileSync("zip", ["-r", "-j", zipPath, outDir], { stdio: "ignore" });
} catch (e) {
  console.warn("No se pudo crear el zip automáticamente:", e.message);
}

console.log(`\n${invoices.length} facturas emitidas en ${tag}`);
console.log(`  Base: ${eur(totalBase)} €  ·  IVA: ${eur(totalVat)} €  ·  Total: ${eur(totalTotal)} €`);
console.log(`\nCarpeta: ${outDir}`);
if (existsSync(zipPath)) console.log(`ZIP:     ${zipPath}`);
