// app/api/admin/gestoria-package/route.ts — Paquete trimestral para la gestoría
// en UN clic. GET ?year=2026&q=2 (o &m=7):
//   · &check=1 → JSON con el checklist de pre-cierre (facturas, gastos, pedidos
//     cobrados sin facturar, gastos pendientes de confirmar, justificantes que faltan).
//   · sin check → ZIP en memoria: PDFs de facturas emitidas + CSVs (facturas y
//     gastos) + justificantes de gastos + resumen 303/111 + LEEME con avisos.
// Solo staff.

import path from "path";
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { generateInvoicePdf } from "@/lib/invoice-pdf";
import { loadBrandLogo, clientInvoicePdfArgs } from "@/lib/invoice-pdf-args";
import { parseFiscalPeriod, type FiscalPeriod } from "@/lib/fiscal-period";
import { buildInvoicesCsv, buildExpensesCsv } from "@/lib/gestoria-csv";
import { aggregateFiscal } from "@/lib/fiscal-aggregation";
import { draftToText } from "@/lib/tax-drafts";
import { listPaidUnbilledOrders } from "@/lib/reconcile-invoices";

export const runtime = "nodejs";
// PDFs por factura + descarga secuencial de justificantes: la ruta más pesada.
export const maxDuration = 120;


function safeName(v: string): string {
  return v.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "sin-nombre";
}

function attachmentExt(url: string, contentType: string | null): string {
  try {
    const ext = path.extname(new URL(url).pathname).slice(1).toLowerCase();
    if (ext && ext.length <= 5) return ext;
  } catch {}
  const ct = (contentType || "").split(";")[0].trim();
  const map: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return map[ct] || "bin";
}

async function fetchInvoices(period: FiscalPeriod) {
  return prisma.clientInvoice.findMany({
    where: { status: "ISSUED", docKind: "invoice", issuedAt: { gte: period.gte, lt: period.lt } },
    orderBy: { number: "asc" },
    include: { order: { select: { reference: true } } },
  });
}

// Gastos del periodo SIN filtrar por needsReview: la exclusión fiscal vive en
// aggregateFiscal; el CSV y los justificantes filtran aquí. Los devengos de
// colaborador (isAccrual) quedan fuera: no son facturas recibidas.
async function fetchExpenses(period: FiscalPeriod) {
  return prisma.expense.findMany({
    where: { date: { gte: period.gte, lt: period.lt }, isAccrual: false },
    orderBy: { date: "asc" },
  });
}

type Checklist = {
  invoices: number;
  expenses: number;
  paidUnbilled: { reference: string; amountCents: number }[];
  paidUnbilledNote: string;
  needsReview: number;
  sinJustificante: number;
};

async function buildChecklist(
  period: FiscalPeriod,
  invoices: Awaited<ReturnType<typeof fetchInvoices>>,
  allExpenses: Awaited<ReturnType<typeof fetchExpenses>>
): Promise<Checklist> {
  // listPaidUnbilledOrders lista TODO el histórico → se filtra al periodo por
  // fecha de cobro; los cobros SIN fecha se incluyen siempre (no asignables).
  const unbilled = (await listPaidUnbilledOrders()).filter((o) => {
    if (!o.paidAt) return true;
    const d = new Date(o.paidAt);
    return d >= period.gte && d < period.lt;
  });
  const confirmed = allExpenses.filter((e) => !e.needsReview);
  return {
    invoices: invoices.length,
    expenses: confirmed.length,
    paidUnbilled: unbilled.map((o) => ({ reference: o.reference, amountCents: o.orderAmountCents })),
    paidUnbilledNote: "Pedidos cobrados sin factura emitida, filtrados por fecha de cobro del periodo (los cobros sin fecha se incluyen siempre).",
    needsReview: allExpenses.filter((e) => e.needsReview).length,
    sinJustificante: confirmed.filter((e) => e.supplier && !e.attachmentUrl).length,
  };
}

export async function GET(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  const url = new URL(req.url);
  const period = parseFiscalPeriod(url);
  if (!period) {
    return NextResponse.json({ ok: false, error: "Falta ?year=YYYY (y opcionalmente &q=1..4 o &m=1..12)." }, { status: 400 });
  }

  try {
    const [invoices, allExpenses] = await Promise.all([fetchInvoices(period), fetchExpenses(period)]);
    const checklist = await buildChecklist(period, invoices, allExpenses);

    if (url.searchParams.get("check") === "1") {
      return NextResponse.json(checklist);
    }

    const expenses = allExpenses.filter((e) => !e.needsReview);
    const zip = new JSZip();
    const avisos: string[] = [];

    // ── PDFs de facturas emitidas ──
    const logoCache = new Map<string, string | undefined>();
    for (const invoice of invoices) {
      try {
        if (!logoCache.has(invoice.brand)) logoCache.set(invoice.brand, await loadBrandLogo(invoice.brand));
        const pdfBuffer = generateInvoicePdf(clientInvoicePdfArgs(invoice, logoCache.get(invoice.brand)));
        zip.file(`facturas/${safeName(invoice.number || invoice.id.slice(0, 8))}.pdf`, pdfBuffer);
      } catch (err) {
        console.error("[gestoria-package] pdf error", invoice.number, err);
        avisos.push(`No se pudo generar el PDF de la factura ${invoice.number || invoice.id}.`);
      }
    }

    // ── CSVs (mismas funciones que las rutas de export) ──
    zip.file(`facturas-${period.tag}.csv`, buildInvoicesCsv(invoices));
    zip.file(`gastos-${period.tag}.csv`, buildExpensesCsv(expenses));

    // ── Justificantes de gastos ──
    // JSZip sobrescribe en silencio rutas repetidas → dedupe con sufijo _2, _3…
    const usedNames = new Set<string>();
    for (const e of expenses) {
      if (!e.attachmentUrl) continue;
      try {
        const res = await fetch(e.attachmentUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const ext = attachmentExt(e.attachmentUrl, res.headers.get("content-type"));
        const base = `${e.date.toISOString().slice(0, 10)}_${safeName(e.supplier || "sin-proveedor")}_${safeName(e.supplierInvoiceNumber || e.id.slice(0, 8))}`;
        let name = `${base}.${ext}`;
        for (let n = 2; usedNames.has(name); n++) name = `${base}_${n}.${ext}`;
        usedNames.add(name);
        zip.file(`justificantes/${name}`, buf);
      } catch (err) {
        console.error("[gestoria-package] justificante error", e.id, err);
        avisos.push(`No se pudo descargar el justificante de "${e.concept}" (${e.date.toISOString().slice(0, 10)}).`);
      }
    }

    // ── Resumen 303/111 (fuente única de agregación) ──
    const drafts = aggregateFiscal(invoices, allExpenses);
    zip.file(`resumen-303-${period.tag}.txt`, draftToText(period.label, drafts.d303, drafts.d111));

    // ── LEEME con recuentos y avisos del checklist ──
    const leeme = [
      `PAQUETE GESTORÍA — ${period.label}`,
      `HBTJ Consultores Lingüísticos S.L. · generado ${new Date().toISOString().slice(0, 10)}`,
      ``,
      `Facturas emitidas:        ${checklist.invoices}`,
      `Gastos contabilizados:    ${checklist.expenses}`,
      ``,
      `== AVISOS ==`,
      ...(checklist.paidUnbilled.length
        ? [
            `⚠ Pedidos COBRADOS sin factura emitida (${checklist.paidUnbilled.length}):`,
            ...checklist.paidUnbilled.map((o) => `  · ${o.reference} — ${(o.amountCents / 100).toFixed(2)} €`),
          ]
        : [`Sin pedidos cobrados pendientes de facturar.`]),
      ...(checklist.needsReview > 0
        ? [`⚠ Gastos recurrentes PENDIENTES de confirmar (fuera del paquete): ${checklist.needsReview}`]
        : []),
      ...(checklist.sinJustificante > 0
        ? [`⚠ Gastos con proveedor y SIN justificante adjunto: ${checklist.sinJustificante}`]
        : []),
      ...(avisos.length ? [`⚠ Incidencias al montar el ZIP:`, ...avisos.map((a) => `  · ${a}`)] : []),
      ``,
      `Contenido: facturas/ (PDFs emitidos), justificantes/ (gastos),`,
      `facturas-${period.tag}.csv, gastos-${period.tag}.csv, resumen-303-${period.tag}.txt.`,
    ].join("\n");
    zip.file("LEEME.txt", leeme);

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="gestoria-${period.tag}.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err) {
    console.error("[gestoria-package] error", err);
    return NextResponse.json({ ok: false, error: "Error al generar el paquete." }, { status: 500 });
  }
}
