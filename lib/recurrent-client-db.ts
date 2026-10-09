import { prisma } from "@/lib/prisma";
import { classifyRecurrent, pickBillingToInherit, type RecurrentMatch } from "@/lib/recurrent-client";
import { emailKey, realEmailKey, phoneKey, isPlaceholderEmailKey } from "@/lib/client-identity";

/** Datos de facturación de los pedidos anteriores de este email EXACTO (más reciente primero). */
export async function billingHistoryForEmail(email: string) {
  return prisma.billingData.findMany({
    where: { order: { clientEmail: { equals: emailKey(email), mode: "insensitive" } }, fiscalName: { not: "" } },
    orderBy: { order: { createdAt: "desc" } },
    take: 50,
    select: { fiscalName: true, nif: true, address: true, city: true, postalCode: true, country: true },
  });
}

/**
 * Cliente que vuelve (MISMO email exacto): si su ficha NO tiene ningún dato fiscal y su
 * historial tiene UN solo titular de facturación, se copia el último a la ficha — /q y la
 * factura leen de ahí. Con varios titulares distintos (despacho vs particular) no se copia
 * y se devuelve "multiple" para marcarlo a staff. Por teléfono, nunca.
 */
export async function inheritBillingFromHistory(customerId: string, email: string): Promise<"inherited" | "multiple" | "company" | "none" | "has-data"> {
  // Email-marcador de WhatsApp: no es un email; nunca se hereda por teléfono.
  if (isPlaceholderEmailKey(email)) return "none";
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { fiscalName: true, nif: true, address: true } });
  if (!customer) return "none";
  if ([customer.fiscalName, customer.nif, customer.address].some((v) => String(v || "").trim())) return "has-data";
  const pick = pickBillingToInherit(await billingHistoryForEmail(email));
  if (pick.kind === "inherit") {
    await prisma.customer.update({ where: { id: customerId }, data: pick.billing });
    return "inherited";
  }
  return pick.kind;
}

/** Cruza email/teléfono con los pedidos PAGADOS anteriores. Nunca lanza. */
export async function findRecurrentClient(input: { email?: string | null; phone?: string | null }): Promise<RecurrentMatch> {
  const email = realEmailKey(input.email);
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
      orderBy: { createdAt: "desc" },
      select: { reference: true, clientEmail: true, clientPhone: true, amountCents: true, paidAt: true, createdAt: true },
      take: 3000,
    });
    return classifyRecurrent({ email, phone }, rows);
  } catch (err) {
    console.error("[recurrent-client] cruce fallo:", err);
    return { kind: "none" };
  }
}
