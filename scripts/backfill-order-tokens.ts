/**
 * Backfill: genera URLs firmadas para pedidos activos y las muestra por consola.
 *
 * Modo dry-run (por defecto): solo lista los pedidos afectados y sus URLs.
 * Modo --send: envía un email recordatorio a cada cliente con la URL firmada.
 *
 * Uso:
 *   npx tsx scripts/backfill-order-tokens.ts              # dry-run
 *   npx tsx scripts/backfill-order-tokens.ts --send        # envía emails
 */

import { PrismaClient } from "@prisma/client";
import { generateOrderToken } from "../lib/order-token";

const prisma = new PrismaClient();
const SEND = process.argv.includes("--send");

async function main() {
  // Pedidos no pagados y no cancelados (los que aún podrían usar la URL)
  const activeOrders = await prisma.order.findMany({
    where: {
      paymentStatus: "PENDING",
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      reference: true,
      clientEmail: true,
      clientName: true,
      title: true,
      amountCents: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n📋 Pedidos activos sin pagar: ${activeOrders.length}\n`);

  if (activeOrders.length === 0) {
    console.log("No hay pedidos pendientes. Nada que hacer.");
    return;
  }

  const baseUrl = (
    process.env.NEXTAUTH_URL || "https://www.traduccionesjuradas.net"
  ).replace(/\/$/, "");

  for (const order of activeOrders) {
    const token = generateOrderToken(order.reference);
    const signedUrl = `${baseUrl}/area-cliente/pedido/${order.reference}/pagar?token=${token}`;

    console.log(
      `  ${order.reference}  ${order.clientEmail.padEnd(35)} ${signedUrl}`,
    );

    if (SEND) {
      try {
        const { sendOrderCreatedEmail } = await import("../lib/email");
        await sendOrderCreatedEmail({
          toEmail: order.clientEmail,
          clientName: order.clientName || undefined,
          reference: order.reference,
          title: order.title,
          amountCents: order.amountCents,
          paymentUrl: signedUrl,
        });
        console.log(`    ✅ Email enviado a ${order.clientEmail}`);
      } catch (err: any) {
        console.error(
          `    ❌ Error enviando a ${order.clientEmail}: ${err?.message}`,
        );
      }
    }
  }

  if (!SEND) {
    console.log(
      "\n💡 Esto fue un dry-run. Para enviar los emails ejecuta:\n" +
        "   npx tsx scripts/backfill-order-tokens.ts --send\n",
    );
  } else {
    console.log(`\n✅ Proceso completado. ${activeOrders.length} emails enviados.\n`);
  }
}

main()
  .catch((err) => {
    console.error("Error fatal:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
