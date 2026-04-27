// Cancel 6 duplicated orders, keep TJ-2026-Q4W46170 (the paid one)
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const TO_CANCEL = [
  "TJ-2026-5XCT6822",
  "TJ-2026-8HUR7754",
  "TJ-2026-AV6A1408",
  "TJ-2026-C4KS1003",
  "TJ-2026-IC5M9405",
  "TJ-2026-KOQL4420",
];

const KEEP = "TJ-2026-Q4W46170";

console.log(`Manteniendo: ${KEEP}`);
console.log(`Cancelando: ${TO_CANCEL.length} duplicados\n`);

const reason = "Duplicado del cliente — el bueno es TJ-2026-Q4W46170 (pagado).";

for (const ref of TO_CANCEL) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { reference: ref } });
    if (!order) return { ref, status: "NOT_FOUND" };

    await tx.order.update({
      where: { reference: ref },
      data: { status: "CANCELLED" },
    });

    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        type: "order.cancelled",
        message: reason,
      },
    });

    return { ref, status: "CANCELLED" };
  });
  console.log(`  ${result.status === "CANCELLED" ? "✓" : "✗"} ${result.ref} → ${result.status}`);
}

// Verify final state
console.log(`\n--- Estado final ---`);
const all = await prisma.order.findMany({
  where: { reference: { in: [...TO_CANCEL, KEEP] } },
  select: { reference: true, status: true },
  orderBy: { reference: "asc" },
});
for (const o of all) {
  const tag = o.reference === KEEP ? "[BUENO]" : "[FANTASMA]";
  console.log(`  ${tag} ${o.reference} | ${o.status}`);
}

await prisma.$disconnect();
