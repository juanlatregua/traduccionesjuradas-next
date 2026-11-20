// lib/contador/server.ts — Conexión real del contador: Prisma, fetch y avisos a
// staff por dos transportes (email + SMS). La lógica vive en flow.ts/core.ts.
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/azure-mail";
import { renderSimpleEmailHtml } from "@/lib/quote-messages";
import { sendStaffAlertSMS } from "@/lib/sms";
import { GIVE_UP_MS, contadorClient, contadorConfig } from "./core";
import { submitForDocument, type ContadorDeps, type ContadorRepo, type SaleRef, type TrabajoRow } from "./flow";

const TERMINAL = ["hecho", "error", "abandonado"];

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
    const r = await prisma.contadorTrabajo.updateMany({
      where: { id, aplicadoAt: null, estado: { notIn: TERMINAL } },
      data: data as any,
    });
    return r.count > 0;
  },
  listPending: (limit, now) =>
    prisma.contadorTrabajo.findMany({
      where: {
        aplicadoAt: null,
        OR: [
          { estado: { in: ["pendiente_envio", "en_cola", "contando"] } },
          { estado: "sin_confirmar", createdAt: { lt: new Date(now.getTime() - GIVE_UP_MS) } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    }) as Promise<TrabajoRow[]>,
  countForEmailSince: (email, since) =>
    prisma.contadorTrabajo.count({
      where: { createdAt: { gte: since }, documentAnalysis: { clientEmail: { equals: email, mode: "insensitive" } } },
    }),
  loadDoc: (id) =>
    prisma.documentAnalysis.findUnique({
      where: { id },
      select: { id: true, fileUrl: true, mimeType: true, analysisJson: true, orderId: true, orderReference: true },
    }),
  async quotesForFile(fileUrl) {
    const quotes = await prisma.quote.findMany({
      where: { deletedAt: null, supersededAt: null, lines: { some: { sourceFileUrl: fileUrl } } },
      select: { id: true, quoteNumber: true, status: true },
    });
    return quotes.map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, status: q.status }));
  },
  async salesForDoc(doc) {
    const out: SaleRef[] = [];
    const order = doc.orderId
      ? await prisma.order.findUnique({ where: { id: doc.orderId }, select: { reference: true, status: true } })
      : doc.orderReference
        ? await prisma.order.findUnique({ where: { reference: doc.orderReference }, select: { reference: true, status: true } })
        : null;
    if (order) out.push({ kind: "pedido", reference: order.reference, status: String(order.status) });
    if (!order && doc.orderReference) {
      const session = await prisma.orderSession.findUnique({ where: { reference: doc.orderReference }, select: { reference: true, isPaid: true, step: true } });
      if (session) out.push({ kind: "sesion", reference: session.reference, status: session.isPaid ? "PAGADA" : String(session.step) });
    }
    return out;
  },
  async claim(trabajoId, trabajoData, doc) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.contadorTrabajo.updateMany({ where: { id: trabajoId, aplicadoAt: null }, data: trabajoData as any });
      if (claimed.count === 0) return false;
      if (doc) await tx.documentAnalysis.update({ where: { id: doc.id }, data: { analysisJson: doc.analysisJson } });
      return true;
    });
  },
  async saveDocAnalysis(docId, analysisJson) {
    await prisma.documentAnalysis.update({ where: { id: docId }, data: { analysisJson } });
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

type AnalyzedDoc = {
  id: string;
  fileUrl: string;
  mimeType: string;
  mode?: string;
  pageCount?: number | null;
  analysisJson: any;
  bytes?: Buffer;
};

/** Staff: tras guardar el análisis envía ya (≤5 s). Nunca lanza; con el flag apagado no hace nada. */
export async function submitContadorAfterAnalysis(doc: AnalyzedDoc): Promise<void> {
  try {
    const deps = contadorDeps();
    if (!deps.client) return;
    await submitForDocument(deps, doc);
  } catch (err) {
    console.error("[contador] gancho de análisis:", err);
  }
}

/**
 * Pública: solo encola (el cron lo manda), con email y cupo por email. Con el flag
 * apagado no hace ninguna consulta (ni siquiera la del email).
 */
export async function queueContadorFromPublic(doc: AnalyzedDoc, loadEmail: () => Promise<string | null>): Promise<void> {
  try {
    const deps = contadorDeps();
    if (!deps.client) return;
    const clientEmail = await loadEmail().catch(() => null);
    await submitForDocument(deps, doc, { kind: "public", clientEmail });
  } catch (err) {
    console.error("[contador] encolado público:", err);
  }
}
