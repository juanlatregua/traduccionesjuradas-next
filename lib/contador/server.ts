// lib/contador/server.ts — Conexión real del contador: Prisma, fetch y avisos a
// staff por dos transportes (email + SMS). La lógica vive en flow.ts/core.ts.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendStaffAlertSMS } from "@/lib/sms";
import { contadorClient, contadorConfig } from "./core";
import { submitForDocument, type ContadorDeps, type ContadorRepo, type TrabajoRow } from "./flow";

const repo: ContadorRepo = {
  findTrabajoByDoc: (documentAnalysisId) => prisma.contadorTrabajo.findUnique({ where: { documentAnalysisId } }) as Promise<TrabajoRow | null>,
  findTrabajoByJobId: (jobId) => prisma.contadorTrabajo.findUnique({ where: { jobId } }) as Promise<TrabajoRow | null>,
  async createTrabajo(data) {
    try {
      return (await prisma.contadorTrabajo.create({ data })) as TrabajoRow;
    } catch (err: any) {
      if (err?.code === "P2002") return null; // otra petición lo creó a la vez
      throw err;
    }
  },
  async updateTrabajo(id, data) {
    await prisma.contadorTrabajo.update({ where: { id }, data: data as any });
  },
  listPending: (limit) =>
    prisma.contadorTrabajo.findMany({
      where: { estado: { in: ["pendiente_envio", "en_cola", "contando"] }, aplicadoAt: null },
      orderBy: { createdAt: "asc" },
      take: limit,
    }) as Promise<TrabajoRow[]>,
  loadDoc: (id) => prisma.documentAnalysis.findUnique({ where: { id }, select: { id: true, fileUrl: true, analysisJson: true, orderId: true } }),
  async quotesForFile(fileUrl) {
    const quotes = await prisma.quote.findMany({
      where: { deletedAt: null, supersededAt: null, lines: { some: { sourceFileUrl: fileUrl } } },
      select: { id: true, quoteNumber: true, status: true },
    });
    return quotes.map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, status: q.status }));
  },
  orderRef: (orderId) => prisma.order.findUnique({ where: { id: orderId }, select: { reference: true, status: true } }).then((o) => (o ? { reference: o.reference, status: String(o.status) } : null)),
  async applyAtomically(trabajoId, trabajoData, docId, analysisJson, estimatedWords) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.contadorTrabajo.updateMany({ where: { id: trabajoId, aplicadoAt: null }, data: trabajoData as any });
      if (claim.count === 0) return false;
      await tx.documentAnalysis.update({ where: { id: docId }, data: { analysisJson, estimatedWords } });
      return true;
    });
  },
  async saveDocAnalysis(docId, analysisJson, estimatedWords) {
    await prisma.documentAnalysis.update({ where: { id: docId }, data: { analysisJson, estimatedWords } });
  },
};

async function alertStaff(msg: { subject: string; text: string; sms: string; context: string }) {
  await Promise.all([
    sendMail({
      to: process.env.ADMIN_EMAIL || "hola@traduccionesjuradas.net",
      subject: msg.subject,
      text: msg.text,
      html: renderSimpleEmailHtml(msg.text),
    }).catch((err) => console.error("[contador] email a staff falló:", err)),
    sendStaffAlertSMS(msg.sms, msg.context).catch(() => {}),
  ]);
}

export function contadorDeps(): ContadorDeps {
  const cfg = contadorConfig();
  return { client: cfg ? contadorClient(cfg) : null, repo, alertStaff };
}

export function contadorSecret(): string | null {
  return contadorConfig()?.secret ?? null;
}

/** Gancho tras guardar el análisis: nunca lanza; con el flag apagado no hace nada. */
export async function submitContadorAfterAnalysis(doc: {
  id: string;
  fileUrl: string;
  mimeType: string;
  mode?: string;
  pageCount?: number | null;
  analysisJson: any;
}): Promise<void> {
  try {
    const deps = contadorDeps();
    if (!deps.client) return;
    await submitForDocument(deps, doc);
  } catch (err) {
    console.error("[contador] gancho de análisis:", err);
  }
}
