// scripts/backfill-quote-order-files.mjs
// Repara los pedidos que nacieron de un presupuesto SIN expediente y se
// quedaron sin archivos (bug corregido en f3ad789: sourceFileUrl se caía en el
// select del puente). Los archivos siguen vivos en QuoteLine.sourceFileUrl.
//
// Reconstruye lo que el camino de expediente ya hacía:
//   · OrderDocumentItem.fileUrl  (si el item existe y está vacío, lo rellena)
//   · evento order.source_document_uploaded (lo ÚNICO que lee el enlace del
//     colaborador externo, ver getDocumentsFromOrder)
//
// DRY-RUN por defecto. Para escribir:  node scripts/backfill-quote-order-files.mjs --apply
//
// Idempotente: no duplica eventos ni pisa fileUrl ya presentes.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(APPLY ? "MODO ESCRITURA (--apply)\n" : "DRY-RUN (sin --apply no se escribe nada)\n");

  const quotes = await prisma.quote.findMany({
    where: { orders: { some: {} }, expedienteRef: null },
    select: {
      quoteNumber: true,
      lines: { select: { description: true, sourceFileUrl: true, pageStart: true, pageEnd: true }, orderBy: { createdAt: "asc" } },
      orders: { select: { id: true, reference: true } },
    },
  });

  let repaired = 0;
  for (const q of quotes) {
    const withFiles = q.lines.filter((l) => l.sourceFileUrl);
    if (!withFiles.length) continue;

    for (const o of q.orders) {
      const existingEvents = await prisma.orderEvent.count({
        where: { orderId: o.id, type: "order.source_document_uploaded" },
      });
      if (existingEvents > 0) {
        console.log(`· ${o.reference}: ya tiene ${existingEvents} evento(s) de documento → se salta`);
        continue;
      }

      const items = await prisma.orderDocumentItem.findMany({
        where: { orderId: o.id },
        select: { id: true, fileName: true, fileUrl: true },
        orderBy: { createdAt: "asc" },
      });

      console.log(`\n⚠ ${o.reference} (presup ${q.quoteNumber}): ${withFiles.length} archivo(s) a reenganchar`);

      // 1) Rellenar fileUrl en los items existentes, casando por descripción.
      for (const l of withFiles) {
        const item = items.find((i) => i.fileName === l.description && !i.fileUrl);
        if (item) {
          console.log(`   item "${l.description}" → fileUrl`);
          if (APPLY) {
            await prisma.orderDocumentItem.update({ where: { id: item.id }, data: { fileUrl: l.sourceFileUrl } });
          }
        } else {
          console.log(`   (sin item vacío que case con "${l.description}" — solo evento)`);
        }
      }

      // 2) Evento canónico por archivo ÚNICO: un mismo PDF puede sustentar
      //    varias líneas (presupuesto segmentado multi-documento) y el
      //    colaborador no necesita el archivo repetido.
      const uniqueUrls = [...new Set(withFiles.map((l) => l.sourceFileUrl))];
      const eventsData = uniqueUrls.map((url) => {
        const l = withFiles.find((x) => x.sourceFileUrl === url);
        return {
          orderId: o.id,
          type: "order.source_document_uploaded",
          message: "Documento fuente adjuntado desde el presupuesto (backfill).",
          payload: {
            fileUrl: url,
            fileName: l.description,
            fileType: null,
            fileSize: null,
            pageStart: l.pageStart ?? null,
            pageEnd: l.pageEnd ?? null,
            uploadedAt: new Date().toISOString(),
            uploadedBy: "presupuesto",
            backfill: "f3ad789",
          },
        };
      });
      console.log(`   ${eventsData.length} evento(s) order.source_document_uploaded`);
      if (APPLY) await prisma.orderEvent.createMany({ data: eventsData });

      repaired++;
    }
  }

  console.log(`\n${repaired} pedido(s) ${APPLY ? "reparados" : "a reparar"}.`);
  if (!repaired) console.log("Nada que hacer.");
  else if (!APPLY) console.log("Repite con --apply para escribir.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
