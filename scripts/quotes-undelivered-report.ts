/**
 * SOLO LECTURA. Inventario de "presupuestos elaborados que no llegaron al cliente".
 *
 * No escribe NADA: solo prisma.quote.findMany + lecturas relacionadas.
 *
 * Detecta 4 cohortes de fuga de leads:
 *   A) DRAFT nunca enviado     → quote elaborado (auto desde estimador o admin) que
 *                                jamás se finalizó/envió. sentAt = null.
 *   B) SENT/OPENED frío        → enviado pero ni abierto/pagado tras N días.
 *   C) Email-placeholder        → customerEmail @whatsapp.local: aunque figure SENT,
 *                                NUNCA salió email (finalize-send lo salta).
 *   D) Envío fallido            → existe MessageLog status=FAILED (PAY_LINK/REMINDER/EXPIRED).
 *
 * Uso:
 *   node_modules/.bin/tsx --env-file=.env.local scripts/quotes-undelivered-report.ts
 *   node_modules/.bin/tsx --env-file=.env.local scripts/quotes-undelivered-report.ts --json > /tmp/leads.json
 *   COLD_DAYS=2 node_modules/.bin/tsx --env-file=.env.local scripts/quotes-undelivered-report.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const AS_JSON = process.argv.includes("--json");
const COLD_DAYS = Number(process.env.COLD_DAYS || 2);

const now = new Date();
const coldThreshold = new Date(now.getTime() - COLD_DAYS * 24 * 60 * 60 * 1000);

function eur(d: unknown) {
  return Number(d ?? 0).toFixed(2);
}
function isPlaceholder(email: string) {
  return /@whatsapp\.local$/i.test(email);
}

async function main() {
  // Trae presupuestos NO cerrados (ni pagados, ni en proceso, ni entregados, ni en papelera)
  const quotes = await prisma.quote.findMany({
    where: {
      deletedAt: null,
      paidAt: null,
      status: { in: ["DRAFT", "SENT", "OPENED", "ACCEPTED", "EXPIRED"] },
    },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      sourceLang: true,
      targetLang: true,
      total: true,
      createdAt: true,
      issuedAt: true,
      validUntil: true,
      sentAt: true,
      openedAt: true,
      adminCreatedBy: true,
      lines: { select: { description: true, sourceFileUrl: true } },
      messageLogs: {
        select: { type: true, channel: true, status: true, recipient: true, sentAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      orders: {
        select: {
          reference: true,
          status: true,
          deliveryState: true,
          clientPhone: true,
          documentItems: { select: { fileName: true, fileUrl: true } },
          events: { select: { type: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = quotes.map((q) => {
    const placeholder = isPlaceholder(q.customerEmail);
    const everEmailedOk = q.messageLogs.some(
      (m) => m.channel === "EMAIL" && m.status === "SENT" && ["PAY_LINK", "RESEND_PAY_LINK"].includes(m.type)
    );
    const hasFailedSend = q.messageLogs.some((m) => m.channel === "EMAIL" && m.status === "FAILED");
    const lastEvent = q.orders[0]?.events[0]?.type ?? null;

    // Documentos fuente: de las líneas del quote + de los documentItems del pedido
    const sourceDocs = [
      ...q.lines.filter((l) => l.sourceFileUrl).map((l) => l.sourceFileUrl as string),
      ...q.orders.flatMap((o) => o.documentItems.map((d) => d.fileUrl)),
    ];

    let cohort: "A_DRAFT_NUNCA_ENVIADO" | "C_EMAIL_PLACEHOLDER" | "D_ENVIO_FALLIDO" | "B_SENT_FRIO" | "OK_REVISAR";
    if (placeholder) cohort = "C_EMAIL_PLACEHOLDER";
    else if (q.status === "DRAFT" && !q.sentAt) cohort = "A_DRAFT_NUNCA_ENVIADO";
    else if (hasFailedSend && !everEmailedOk) cohort = "D_ENVIO_FALLIDO";
    else if (["SENT", "OPENED"].includes(q.status) && !q.openedAt && q.sentAt && q.sentAt < coldThreshold)
      cohort = "B_SENT_FRIO";
    else cohort = "OK_REVISAR";

    return {
      cohort,
      quoteNumber: q.quoteNumber,
      status: q.status,
      email: q.customerEmail,
      phone: q.customerPhone || q.orders[0]?.clientPhone || null,
      total: eur(q.total),
      langPair: `${q.sourceLang}>${q.targetLang}`,
      createdAt: q.createdAt.toISOString().slice(0, 10),
      validUntil: q.validUntil.toISOString().slice(0, 10),
      sentAt: q.sentAt ? q.sentAt.toISOString().slice(0, 10) : null,
      openedAt: q.openedAt ? q.openedAt.toISOString().slice(0, 10) : null,
      createdBy: q.adminCreatedBy,
      orderRef: q.orders[0]?.reference ?? null,
      lastOrderEvent: lastEvent,
      sourceDocsCount: sourceDocs.length,
      sourceDocs,
    };
  });

  // Solo cohortes de fuga (excluye OK_REVISAR salvo en JSON completo)
  const leaks = rows.filter((r) => r.cohort !== "OK_REVISAR");

  if (AS_JSON) {
    console.log(JSON.stringify({ generatedAt: now.toISOString(), coldDays: COLD_DAYS, rows }, null, 2));
    return;
  }

  const byCohort: Record<string, typeof leaks> = {};
  for (const r of leaks) (byCohort[r.cohort] ||= []).push(r);

  console.log(`\n=== PRESUPUESTOS ELABORADOS QUE (PROBABLEMENTE) NO LLEGARON ===`);
  console.log(`Generado: ${now.toISOString()} · umbral frío: ${COLD_DAYS} días\n`);
  for (const [cohort, list] of Object.entries(byCohort)) {
    console.log(`\n## ${cohort} — ${list.length} caso(s)`);
    for (const r of list) {
      console.log(
        `  ${r.quoteNumber} | ${r.status} | ${r.total}€ | ${r.langPair} | ${r.email} | tel:${r.phone || "-"} | ` +
          `creado:${r.createdAt} venc:${r.validUntil} | docs:${r.sourceDocsCount} | pedido:${r.orderRef || "-"} | ultimoEvento:${r.lastOrderEvent || "-"}`
      );
    }
  }
  console.log(`\nTOTAL fugas: ${leaks.length} de ${rows.length} presupuestos abiertos\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
