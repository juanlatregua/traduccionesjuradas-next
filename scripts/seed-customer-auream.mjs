// scripts/seed-customer-auream.mjs
// Siembra/actualiza la ficha de cliente B2B de Auream (Farah). Idempotente.
// Ejecutar: node --env-file=.env scripts/seed-customer-auream.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const data = {
  name: "Farah · Auream",
  email: "info@aureamgroup.com",
  phone: "+34663727415",
  companyName: "AUREAM COAST REAL ESTATE & CONSULTING SL",
  nif: "B93645398",
  fiscalName: "AUREAM COAST REAL ESTATE & CONSULTING SL",
  address: "Bulevar Marie Curie 2 - Mijas Costa",
  city: "Mijas Costa",
  postalCode: "29649",
  country: "España",
  isBusiness: true,
};

const c = await prisma.customer.upsert({
  where: { email: data.email },
  update: data,
  create: data,
});
console.log("✓ Customer Auream sembrado/actualizado:", c.email, "·", c.companyName);
await prisma.$disconnect();
