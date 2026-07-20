// scripts/stripe-quotes-reconcile-check.mjs
// SOLO LECTURA. Busca presupuestos (Quote) COBRADOS en Stripe que NO quedaron
// marcados como pagados en la BD — el agujero que existió antes del fix PR #145
// (17-jun-2026), cuando el webhook de quotes nunca estuvo registrado en Stripe.
//
// No escribe NADA: solo stripe.checkout.sessions.list + prisma.quote.findUnique.
//
// Uso:  node scripts/stripe-quotes-reconcile-check.mjs [desde=2026-03-01]
//
// Necesita STRIPE_SECRET_KEY y DATABASE_URL en .env.local (o .env).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ── Cargar solo las claves de una línea que necesitamos (evita el JSON multilínea) ──
function loadKey(name) {
  for (const file of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(ROOT, file), "utf8");
      const m = txt.match(new RegExp(`^${name}=(.*)$`, "m"));
      if (m) {
        let v = m[1].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (v) return v;
      }
    } catch {}
  }
  return "";
}

const STRIPE_KEY = loadKey("STRIPE_SECRET_KEY");
const DB_URL = loadKey("DATABASE_URL");
if (!STRIPE_KEY) { console.error("✗ Falta STRIPE_SECRET_KEY en .env.local"); process.exit(1); }
if (!DB_URL) { console.error("✗ Falta DATABASE_URL en .env.local/.env"); process.exit(1); }
process.env.DATABASE_URL = DB_URL;

const Stripe = (await import("stripe")).default;
const { PrismaClient } = await import("@prisma/client");

const stripe = new Stripe(STRIPE_KEY);
const prisma = new PrismaClient();

// Ventana: desde (argv) hasta ahora. El fix se desplegó el 2026-06-17 ~08:06 UTC.
const sinceStr = process.argv[2] || "2026-03-01";
const sinceTs = Math.floor(new Date(`${sinceStr}T00:00:00Z`).getTime() / 1000);
const FIX_TS = Math.floor(new Date("2026-06-17T08:06:09Z").getTime() / 1000);

const isPaid = (s) =>
  s.payment_status === "paid" ||
  (s.status === "complete" && s.payment_status !== "unpaid");

const eur = (cents) => (cents == null ? "—" : (cents / 100).toFixed(2) + "€");
const day = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);

async function main() {
  console.log(`\n🔎 Escaneando checkout sessions de Stripe (live) desde ${sinceStr}…\n`);

  // ── 1) Recorrer TODAS las sesiones de la ventana, quedarnos con las que tienen quoteId ──
  const quoteSessions = [];
  let startingAfter;
  let scanned = 0;
  for (let page = 0; page < 200; page++) {
    const res = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: sinceTs },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of res.data) {
      scanned++;
      const quoteId = String(s.metadata?.quoteId || "").trim();
      if (quoteId) quoteSessions.push({ s, quoteId });
    }
    if (!res.has_more) break;
    startingAfter = res.data[res.data.length - 1].id;
  }

  console.log(`   ${scanned} sesiones escaneadas · ${quoteSessions.length} con metadata.quoteId\n`);

  const paid = quoteSessions.filter(({ s }) => isPaid(s));
  if (paid.length === 0) {
    console.log("✅ No hay ni una sola sesión de presupuesto PAGADA en la ventana. Nada que reconciliar.\n");
    await prisma.$disconnect();
    return;
  }

  // ── 2) Cruzar cada sesión pagada con el Quote en BD ──
  const rows = [];
  for (const { s, quoteId } of paid) {
    let q = null;
    try {
      q = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: {
          id: true, status: true, paidAt: true, total: true,
          customerEmail: true, customerName: true,
          orders: { select: { reference: true } },
        },
      });
    } catch {}

    const reconciled =
      q != null &&
      (q.status === "PAID" || q.status === "IN_PROGRESS" || q.status === "DELIVERED" ||
        q.paidAt != null || (q.orders?.length || 0) > 0);

    rows.push({
      quoteId,
      sessionId: s.id,
      created: s.created,
      beforeFix: s.created < FIX_TS,
      amount: s.amount_total,
      email: s.customer_details?.email || q?.customerEmail || "—",
      quoteFound: q != null,
      quoteStatus: q?.status || "(no existe en BD)",
      paidAt: q?.paidAt ? new Date(q.paidAt).toISOString().slice(0, 10) : "—",
      orders: q?.orders?.length || 0,
      reconciled,
    });
  }

  const problems = rows.filter((r) => !r.reconciled);

  // ── 3) Informe ──
  console.log(`💳 ${paid.length} presupuesto(s) PAGADO(s) en Stripe en la ventana:\n`);
  const fmt = (r) =>
    `  ${r.reconciled ? "✅" : "⚠️ "} ${day(r.created)} ${r.beforeFix ? "[pre-fix]" : "[post-fix]"} ` +
    `· ${eur(r.amount).padStart(9)} · ${r.email.padEnd(28)} · Quote ${r.quoteStatus.padEnd(16)} ` +
    `· paidAt ${r.paidAt} · pedidos ${r.orders} · ${r.quoteId}`;
  for (const r of rows.sort((a, b) => a.created - b.created)) console.log(fmt(r));

  console.log("\n" + "─".repeat(70));
  if (problems.length === 0) {
    console.log(`✅ Las ${paid.length} están reconciliadas (Quote pagado / con pedido). NADA pendiente.\n`);
  } else {
    console.log(`⚠️  ${problems.length} COBRO(S) SIN RECONCILIAR — cobrado en Stripe pero el Quote no figura pagado:\n`);
    for (const r of problems) {
      console.log(`   • ${day(r.created)} ${r.beforeFix ? "(antes del fix)" : "(DESPUÉS del fix ⚠ revisar)"} · ${eur(r.amount)} · ${r.email}`);
      console.log(`     quoteId: ${r.quoteId} · estado BD: ${r.quoteStatus} · session: ${r.sessionId}`);
    }
    console.log(`\n   → Reconciliar a mano: marcar estos Quote como pagados / generar su pedido,`);
    console.log(`     y cuadrarlos en el IVA del trimestre correspondiente.\n`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n✗ Error:", e?.message || e);
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
