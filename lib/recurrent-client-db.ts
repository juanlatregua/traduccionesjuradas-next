import { prisma } from "@/lib/prisma";
import { classifyRecurrent, type RecurrentMatch } from "@/lib/recurrent-client";
import { emailKey, phoneKey } from "@/lib/client-identity";

/**
 * Cliente que vuelve (MISMO email): si su ficha no tiene datos fiscales y un pedido
 * anterior suyo sí, se copian a la ficha — /q y la factura leen de ahí. Solo por email;
 * por teléfono nunca (ver lib/recurrent-client.ts). No pisa datos ya existentes.
 */
export async function inheritBillingFromHistory(customerId: string, email: string): Promise<boolean> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { fiscalName: true } });
  if (!customer || customer.fiscalName?.trim()) return false;
  const prev = await prisma.billingData.findFirst({
    where: { order: { clientEmail: { equals: emailKey(email), mode: "insensitive" } }, fiscalName: { not: "" } },
    orderBy: { order: { createdAt: "desc" } },
    select: { fiscalName: true, nif: true, address: true, city: true, postalCode: true, country: true },
  });
  if (!prev) return false;
  await prisma.customer.update({ where: { id: customerId }, data: prev });
  return true;
}

/** Cruza email/teléfono con los pedidos PAGADOS anteriores. Nunca lanza. */
export async function findRecurrentClient(input: { email?: string | null; phone?: string | null }): Promise<RecurrentMatch> {
  const email = emailKey(input.email);
  const phone = phoneKey(input.phone);
  if (!email && !phone) return { kind: "none" };
  try {
    const rows = await prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        OR: [
          ...(email ? [{ clientEmail: { equals: email, mode: "insensitive" as const } }] : []),
          ...(phone ? [{ clientPhone: { not: null } }] : []),
        ],
      },
      select: { reference: true, clientEmail: true, clientPhone: true, amountCents: true, paidAt: true, createdAt: true },
      take: 3000,
    });
    return classifyRecurrent({ email, phone }, rows);
  } catch (err) {
    console.error("[recurrent-client] cruce fallo:", err);
    return { kind: "none" };
  }
}
