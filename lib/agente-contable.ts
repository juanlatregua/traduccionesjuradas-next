// lib/agente-contable.ts — Agente de contabilidad autónomo (Juan, 30-oct-2026): lee
// las facturas de traductor que llegan por lavori y las contabiliza solo si cuadran,
// por el mismo carril que el formulario (registerCollaboratorInvoice).
// Kill-switch: solo escribe con AGENTE_CONTABLE=on.

import { prisma } from "@/lib/prisma";
import { extractExpenseFromDocument } from "@/lib/ai/extract-expense";
import { registerCollaboratorInvoice, DuplicateExpenseError } from "@/lib/expenses";
import { getLast303Close } from "@/lib/tax-close-store";
import { isOwnBlobUrl } from "@/lib/q-journey";
import { escapeHtml } from "@/lib/collaborator-emails";
import { cierreEfectivo, decidirFacturaColaborador, referenciaPedido, MOTIVO_TEXTO, type FacturaLeida, type MotivoParada } from "@/lib/agente-contable-logic";

const MAX_LECTURAS_POR_PASADA = 10; // lo ya leído se vuelve a decidir sin coste
const TIEMPO_MAX_LECTURAS_MS = 200_000; // el cron corta a 300 s y aún debe enviar el resumen
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_POR_EXTENSION: Record<string, string> = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

const EV_LECTURA = "agente_contable.lectura";
export const EV_PARADA = "agente_contable.parada";
const EV_AVISADA = "agente_contable.parada_avisada";
const EV_HECHA = "agente_contable.contabilizada";
const EV_LECTURA_FALLIDA = "agente_contable.lectura_fallida";
const REINTENTO_LECTURA_MS = 7 * 86_400_000;

export type ResultadoFactura = {
  expenseId: string;
  orderId: string | null;
  reference: string | null;
  supplier: string | null;
  estado: "contabilizada" | "lista" | "parada";
  motivo?: MotivoParada | "duplicada" | "sin_leer" | "error";
  detalle?: string;
  nueva?: boolean; // parada que aún no se le ha contado a Juan
  numero?: string;
  baseCents?: number;
};

export type PasadaContable = { resultados: ResultadoFactura[] } | { skipped: string };

async function leerFactura(url: string | null, nombre: string | null): Promise<FacturaLeida> {
  if (!isOwnBlobUrl(url, process.env.BLOB_READ_WRITE_TOKEN)) throw new Error("adjunto fuera de nuestro Blob");
  const res = await fetch(url as string);
  if (!res.ok) throw new Error(`adjunto no disponible (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_BYTES) throw new Error("adjunto vacío o demasiado grande");
  const ext = String(nombre || url).split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_POR_EXTENSION[ext];
  if (!mimeType) throw new Error(`formato no admitido (.${ext})`);
  return extractExpenseFromDocument({ fileBase64: buf.toString("base64"), mimeType, fileName: nombre || "factura" });
}

const ultimoEvento = (orderId: string, type: string, expenseId: string) =>
  prisma.orderEvent.findFirst({
    where: { orderId, type, payload: { path: ["expenseId"], equals: expenseId } },
    orderBy: { createdAt: "desc" },
    select: { payload: true, createdAt: true },
  });

// Lo contabilizado en pasadas anteriores y aún sin contar a Juan (el email pudo fallar).
async function hechasSinAvisar(): Promise<ResultadoFactura[]> {
  const hechas = await prisma.orderEvent.findMany({ where: { type: EV_HECHA }, orderBy: { createdAt: "desc" }, take: 100, select: { orderId: true, payload: true } });
  const avisadas = await prisma.orderEvent.findMany({ where: { type: EV_AVISADA, payload: { path: ["motivo"], equals: "contabilizada" } }, orderBy: { createdAt: "desc" }, take: 200, select: { payload: true } });
  const yaContadas = new Set(avisadas.map((a) => (a.payload as { expenseId?: string }).expenseId));
  return hechas.flatMap((h) => {
    const p = h.payload as { expenseId: string; numero: string; baseCents: number; reference: string; supplier: string | null };
    return yaContadas.has(p.expenseId) ? [] : [{ expenseId: p.expenseId, orderId: h.orderId, reference: p.reference, supplier: p.supplier, estado: "contabilizada" as const, numero: p.numero, baseCents: p.baseCents, nueva: true }];
  });
}

export async function runAgenteContable(opts?: { dryRun?: boolean; now?: Date }): Promise<PasadaContable> {
  const dryRun = opts?.dryRun === true;
  const now = opts?.now ?? new Date();
  if (!dryRun && process.env.AGENTE_CONTABLE !== "on") return { skipped: "AGENTE_CONTABLE no está en on" };

  const cierre = cierreEfectivo(await getLast303Close(), now);
  // Las de solicitud sin pedido se avisan al llegar y salen en el panel: aquí no hay encargo con el que cuadrarlas.
  const facturas = await prisma.expense.findMany({
    where: {
      category: "colaborador",
      isAccrual: false,
      needsReview: true,
      concept: { startsWith: "Factura del sobre lavori", contains: "(pedido " },
      attachmentUrl: { not: null },
      settles: { none: {} },
    },
    orderBy: { date: "asc" },
    select: { id: true, concept: true, supplier: true, supplierInvoiceNumber: true, totalCents: true, attachmentUrl: true, attachmentName: true },
  });

  const resultados: ResultadoFactura[] = dryRun ? [] : await hechasSinAvisar();
  const inicio = Date.now();
  let lecturas = 0;
  for (const f of facturas) {
    const reference = referenciaPedido(f.concept);
    const order = reference ? await prisma.order.findUnique({ where: { reference }, select: { id: true } }) : null;
    if (!reference || !order) continue;
    const base = { expenseId: f.id, orderId: order.id, reference, supplier: f.supplier };

    const parar = async (motivo: NonNullable<ResultadoFactura["motivo"]>, detalle: string) => {
      const avisada = await ultimoEvento(order.id, EV_AVISADA, f.id);
      const nueva = (avisada?.payload as { motivo?: string } | null)?.motivo !== motivo;
      const previa = await ultimoEvento(order.id, EV_PARADA, f.id);
      if (!dryRun && (previa?.payload as { motivo?: string } | null)?.motivo !== motivo) {
        await prisma.orderEvent.create({
          data: { orderId: order.id, type: EV_PARADA, message: "Agente contable: factura pendiente de revisión.", payload: { expenseId: f.id, motivo, detalle } },
        });
      }
      resultados.push({ ...base, estado: "parada", motivo, detalle, nueva });
    };

    try {
      // La lectura se guarda: cada día se vuelve a decidir (p. ej. si se corrige el
      // coste del encargo) sin pagar otra vez a la IA, mientras el adjunto sea el mismo.
      const guardada = (await ultimoEvento(order.id, EV_LECTURA, f.id))?.payload as { leida?: FacturaLeida; attachmentUrl?: string } | null;
      let leida = guardada?.attachmentUrl === f.attachmentUrl ? guardada?.leida ?? null : null;
      if (!leida) {
        const fallo = await ultimoEvento(order.id, EV_LECTURA_FALLIDA, f.id);
        const falloPayload = fallo?.payload as { attachmentUrl?: string; detalle?: string } | null;
        if (fallo && falloPayload?.attachmentUrl === f.attachmentUrl && now.getTime() - fallo.createdAt.getTime() < REINTENTO_LECTURA_MS) {
          await parar("sin_leer", falloPayload.detalle || "no se pudo leer");
          continue;
        }
        if (lecturas >= MAX_LECTURAS_POR_PASADA || Date.now() - inicio > TIEMPO_MAX_LECTURAS_MS) continue;
        lecturas++;
        try {
          leida = await leerFactura(f.attachmentUrl, f.attachmentName);
        } catch (err: any) {
          const detalle = String(err?.message || err);
          if (!dryRun) {
            await prisma.orderEvent.create({
              data: { orderId: order.id, type: EV_LECTURA_FALLIDA, message: "Agente contable: factura pendiente de revisión.", payload: { expenseId: f.id, attachmentUrl: f.attachmentUrl, detalle } },
            });
          }
          await parar("sin_leer", detalle);
          continue;
        }
        if (!dryRun) {
          await prisma.orderEvent.create({
            data: { orderId: order.id, type: EV_LECTURA, message: "Agente contable: factura del traductor leída.", payload: { expenseId: f.id, attachmentUrl: f.attachmentUrl, leida } },
          });
        }
      }

      const devengos = await prisma.expense.findMany({
        where: { isAccrual: true, settledById: null, orderReference: reference, collaboratorId: { not: null } },
        select: { id: true, baseCents: true, collaborator: { select: { id: true, fullName: true, companyName: true, nif: true, supplierType: true } } },
      });
      const colaborador = devengos.map((d) => d.collaborator).find((c) => c && (c.fullName === f.supplier || c.companyName === f.supplier)) ?? null;
      if (!colaborador) {
        await parar("sin_devengo", MOTIVO_TEXTO.sin_devengo);
        continue;
      }
      const propios = devengos.filter((d) => d.collaborator?.id === colaborador.id);
      const decision = decidirFacturaColaborador({
        leida,
        colaborador,
        devengoCents: propios.reduce((a, d) => a + d.baseCents, 0),
        lavori: { numero: f.supplierInvoiceNumber, importeCents: f.totalCents },
        cierre,
        now,
      });
      if (!decision.ok) {
        await parar(decision.motivo, decision.detalle);
        continue;
      }

      const repetida = await prisma.expense.findFirst({
        where: {
          id: { not: f.id },
          isAccrual: false,
          supplierInvoiceNumber: decision.number,
          OR: [{ supplierNif: decision.supplierNif }, { supplier: { in: [colaborador.fullName, colaborador.companyName].filter(Boolean) as string[] } }],
        },
        select: { id: true },
      });
      if (repetida) {
        await parar("duplicada", `ya existe la factura ${decision.number} de este traductor`);
        continue;
      }

      if (dryRun) {
        resultados.push({ ...base, estado: "lista", numero: decision.number, baseCents: decision.baseCents });
        continue;
      }
      const redondeo = decision.diferenciaCents ? ` Diferencia de ${decision.diferenciaCents} céntimos con el devengo.` : "";
      await registerCollaboratorInvoice({
        collaboratorId: colaborador.id,
        accrualIds: propios.map((d) => d.id),
        number: decision.number,
        date: decision.date,
        baseCents: decision.baseCents,
        vatRate: decision.vatRate,
        irpfRetentionPct: decision.irpfPct,
        supplierNif: decision.supplierNif,
        notes: `Contabilizada por el agente contable: la base coincide con el encargo.${redondeo}`,
        existingExpenseId: f.id,
        acceptMismatch: true, // el decisor ya ha limitado la diferencia al redondeo
      });
      await prisma.orderEvent.create({
        data: { orderId: order.id, type: EV_HECHA, message: "Agente contable: factura registrada.", payload: { expenseId: f.id, numero: decision.number, baseCents: decision.baseCents, reference, supplier: f.supplier } },
      });
      resultados.push({ ...base, estado: "contabilizada", numero: decision.number, baseCents: decision.baseCents, nueva: true });
    } catch (err: any) {
      await parar(err instanceof DuplicateExpenseError ? "duplicada" : "error", String(err?.message || err)).catch((e) => console.error("[agente-contable] parada", f.id, e));
    }
  }
  return { resultados };
}

// Se sella DESPUÉS de enviar: si el email falla, mañana se vuelve a avisar.
export async function sellarAvisados(resultados: ResultadoFactura[]) {
  const avisados = resultados.filter((r) => r.nueva && r.orderId);
  await Promise.all(
    avisados.map((r) =>
      prisma.orderEvent.create({
        data: { orderId: r.orderId as string, type: EV_AVISADA, message: "Agente contable: resumen enviado.", payload: { expenseId: r.expenseId, motivo: r.estado === "contabilizada" ? "contabilizada" : r.motivo } },
      })
    )
  );
}

const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const motivoTexto = (r: ResultadoFactura) => (r.motivo && r.motivo in MOTIVO_TEXTO ? MOTIVO_TEXTO[r.motivo as MotivoParada] : r.detalle || "sin detalle");
const txt = (s: string | null | undefined) => escapeHtml(String(s ?? ""));

export function renderResumenContable(resultados: ResultadoFactura[]) {
  const hechas = resultados.filter((r) => r.estado === "contabilizada");
  const paradas = resultados.filter((r) => r.estado === "parada" && r.nueva);
  const li = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
  return [
    "<p>Resumen del agente de contabilidad. Se apaga quitando AGENTE_CONTABLE=on.</p>",
    hechas.length ? `<p><strong>Contabilizadas solas (${hechas.length})</strong></p>${li(hechas.map((r) => `${txt(r.reference)} · ${txt(r.supplier)} · nº ${txt(r.numero)} · ${eur(r.baseCents ?? 0)} de base`))}` : "",
    paradas.length ? `<p><strong>Paradas para ti (${paradas.length})</strong></p>${li(paradas.map((r) => `${txt(r.reference)} · ${txt(r.supplier)}: ${txt(motivoTexto(r))}`))}` : "",
  ].join("");
}
