import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const collaborators = [
  {
    fullName: "Vanessa Bech",
    email: "bechtraducciones@gmail.com",
    phone: "658900828",
    languages: ["en"],
    swornNumber: "8272",
    supplierType: "AUTONOMO" as const,
  },
  {
    fullName: "Juan Amor Fernández",
    email: "juan@gestremor.com",
    languages: ["de", "en", "it", "ca", "pt"],
    swornNumber: "132",
    supplierType: "AUTONOMO" as const,
  },
  {
    fullName: "Inge Luken",
    email: "inge.luken@gmail.com",
    phone: "+34 629 70 93 86",
    languages: ["nl"],
    supplierType: "AUTONOMO" as const,
  },
  {
    fullName: "Maria Murariu Ursu",
    email: "tradintro@gmail.com",
    phone: "+34 642 79 97 85",
    languages: ["ro"],
    supplierType: "AUTONOMO" as const,
  },
  {
    fullName: "Olaf Medina",
    email: "olaf@wallinpartners.com",
    languages: ["sv"],
    supplierType: "EMPRESA" as const,
    companyName: "Wallin & Partners / Bufete Hispano-Sueco SL",
    nif: "B92812973",
    address: "CC Centro Idea, Crta. de Mijas km 3.6, 29650 Mijas",
  },
  {
    fullName: "MadeInTranslation",
    email: "info@madeintranslation.com",
    languages: ["ar"],
    supplierType: "EMPRESA" as const,
    companyName: "MadeInTranslation",
  },
  {
    // Ruso ofrecido SOLO vía cotización del colaborador (no auto-precio). uk sigue excluido.
    fullName: "Babylon Systems",
    email: "info@babylonsystems.es",
    languages: ["ru"],
    supplierType: "EMPRESA" as const,
    companyName: "Babylon Systems",
  },
  {
    // Juan Silva como colaborador formal de FR: asignación auto-aceptada + recordatorios.
    fullName: "Juan Silva Moreno",
    email: "juansilva@traduccionesjuradas.net",
    languages: ["fr"],
    swornNumber: "3850",
    supplierType: "AUTONOMO" as const,
  },
];

async function main() {
  for (const c of collaborators) {
    const result = await prisma.collaborator.upsert({
      where: { email: c.email },
      update: {
        fullName: c.fullName,
        phone: c.phone ?? null,
        languages: c.languages,
        swornNumber: c.swornNumber ?? null,
        supplierType: c.supplierType,
        companyName: c.companyName ?? null,
        nif: c.nif ?? null,
        address: c.address ?? null,
      },
      create: {
        fullName: c.fullName,
        email: c.email,
        phone: c.phone ?? null,
        languages: c.languages,
        swornNumber: c.swornNumber ?? null,
        supplierType: c.supplierType,
        companyName: c.companyName ?? null,
        nif: c.nif ?? null,
        address: c.address ?? null,
      },
    });
    console.log(`Upserted: ${result.fullName} (${result.email})`);
  }
}

main()
  .then(() => {
    console.log("Seed completed.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
