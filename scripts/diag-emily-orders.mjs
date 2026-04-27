// Diagnose 7 duplicated orders for emilyfr186@gmail.com
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const refs = [
  "TJ-2026-Q4W46170",
  "TJ-2026-KOQL4420",
  "TJ-2026-IC5M9405",
  "TJ-2026-C4KS1003",
  "TJ-2026-AV6A1408",
  "TJ-2026-8HUR7754",
  "TJ-2026-5XCT6822",
];

const orders = await prisma.order.findMany({
  where: { reference: { in: refs } },
  orderBy: { createdAt: "asc" },
  select: {
    reference: true,
    createdAt: true,
    source: true,
    idempotencyKey: true,
    clientEmail: true,
    clientName: true,
    status: true,
    paymentStatus: true,
    deliveryState: true,
    assignedTo: true,
    amountCents: true,
    quoteSnapshotJson: true,
  },
});

console.log(`Encontrados ${orders.length} pedidos\n`);
for (const o of orders) {
  const ts = o.createdAt.toISOString();
  const delta = orders[0] ? ((o.createdAt - orders[0].createdAt) / 1000).toFixed(0) : "0";
  console.log(`${o.reference}`);
  console.log(`  createdAt:   ${ts} (+${delta}s)`);
  console.log(`  source:      ${o.source}`);
  console.log(`  idempotency: ${o.idempotencyKey || "—"}`);
  console.log(`  status/pay:  ${o.status} / ${o.paymentStatus} / ${o.deliveryState}`);
  console.log(`  assignedTo:  ${o.assignedTo || "—"}`);
  console.log(`  amountCents: ${o.amountCents}`);
  console.log("");
}

// Check for related events
const events = await prisma.orderEvent.findMany({
  where: { order: { reference: { in: refs } } },
  orderBy: { createdAt: "asc" },
  include: { order: { select: { reference: true } } },
});
console.log(`\n--- ${events.length} events ---`);
for (const e of events) {
  console.log(`${e.createdAt.toISOString()} | ${e.order.reference} | ${e.type} | ${e.message?.slice(0, 80)}`);
}

await prisma.$disconnect();
