// lib/client-invoice.ts — Factura al cliente con numeración fiscal secuencial.
// Sustituye el "F-{ref}" sin valor legal. Una factura por pedido (orderId único),
// número correlativo por año FAC-AAAA-NNNNN, congelando los datos fiscales y el
// desglose de IVA en el momento de emisión.

import { prisma } from "@/lib/prisma";

async function generateInvoiceNumber(year: number): Promise<string> {
  const prefix = `FAC-${year}-`;
  const count = await prisma.clientInvoice.count({ where: { number: { startsWith: prefix } } });
  for (let i = 0; i < 8; i += 1) {
    const candidate = `${prefix}${String(count + i + 1).padStart(5, "0")}`;
    const exists = await prisma.clientInvoice.findUnique({ where: { number: candidate }, select: { id: true } });
    if (!exists) return candidate;
  }
  throw new Error("No se pudo generar número de factura único.");
}

type BillingSnapshot = {
  fiscalName: string;
  nif: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
};

// Idempotente por orderId. amountCents es el total con IVA incluido.
export async function getOrCreateClientInvoice(input: {
  orderId: string;
  amountCents: number;
  billing: BillingSnapshot;
}) {
  const existing = await prisma.clientInvoice.findUnique({ where: { orderId: input.orderId } });
  if (existing) return existing;

  const year = new Date().getFullYear();
  const number = await generateInvoiceNumber(year);
  const total = input.amountCents;
  const base = Math.round(total / 1.21);
  const vat = total - base;

  try {
    return await prisma.clientInvoice.create({
      data: {
        number,
        orderId: input.orderId,
        fiscalName: input.billing.fiscalName,
        nif: input.billing.nif,
        address: input.billing.address,
        city: input.billing.city,
        postalCode: input.billing.postalCode,
        country: input.billing.country,
        email: input.billing.email,
        baseCents: base,
        vatRate: 0.21,
        vatCents: vat,
        totalCents: total,
      },
    });
  } catch (err: any) {
    if (err?.code === "P2002") {
      const again = await prisma.clientInvoice.findUnique({ where: { orderId: input.orderId } });
      if (again) return again;
    }
    throw err;
  }
}
