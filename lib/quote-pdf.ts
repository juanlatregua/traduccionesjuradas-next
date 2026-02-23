import crypto from "crypto";
import { jsPDF } from "jspdf";
import { put } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/payment-config";
import { formatDateEs } from "@/lib/quotes";

type QuotePdfLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type QuotePdfData = {
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  sourceLang: string;
  targetLang: string;
  deliveryType: "DIGITAL_PDF" | "PAPER_SHIP";
  issuedAt: Date;
  validUntil: Date;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  payUrl: string;
  lines: QuotePdfLine[];
  isDraft?: boolean;
  notesLegal?: string | null;
};

function toMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

function drawRow(doc: jsPDF, y: number, cols: [string, string, string, string], bold = false) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.text(cols[0], 14, y, { maxWidth: 90 });
  doc.text(cols[1], 110, y, { align: "right" });
  doc.text(cols[2], 145, y, { align: "right" });
  doc.text(cols[3], 195, y, { align: "right" });
}

export function buildQuotePdfBuffer(data: QuotePdfData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("TRADUCCIONES JURADAS", 14, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Presupuesto de traducción jurada", 14, y);
  y += 6;
  doc.text(`Nº presupuesto: ${data.quoteNumber}`, 14, y);
  y += 5;
  doc.text(`Fecha emisión: ${formatDateEs(data.issuedAt)} · Válido hasta: ${formatDateEs(data.validUntil)}`, 14, y);
  y += 7;

  doc.setDrawColor(210, 210, 210);
  doc.line(14, y, 196, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Cliente", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`${data.customerName} (${data.customerEmail})`, 14, y);
  y += 5;
  doc.text(`Idiomas: ${data.sourceLang} -> ${data.targetLang}`, 14, y);
  y += 5;
  doc.text(
    `Entrega: ${data.deliveryType === "DIGITAL_PDF" ? "PDF digital firmado" : "Envío en papel (mensajería)"}`,
    14,
    y
  );
  y += 8;

  doc.setFont("helvetica", "bold");
  drawRow(doc, y, ["Descripción", "Cantidad", "Precio", "Total"], true);
  y += 2;
  doc.line(14, y, 196, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  data.lines.forEach((line) => {
    if (y > 265) {
      doc.addPage();
      y = 18;
      drawRow(doc, y, ["Descripción", "Cantidad", "Precio", "Total"], true);
      y += 2;
      doc.line(14, y, 196, y);
      y += 5;
    }
    drawRow(
      doc,
      y,
      [
        line.description,
        String(line.quantity),
        toMoney(line.unitPrice),
        toMoney(line.lineTotal),
      ]
    );
    y += 6;
  });

  y += 4;
  doc.line(110, y, 196, y);
  y += 6;

  const totals: [string, string][] = [
    ["Subtotal", toMoney(data.subtotal)],
    ["Descuento", `- ${toMoney(data.discountAmount)}`],
    ["Envío", toMoney(data.shippingAmount)],
    [`IVA (${(data.vatRate * 100).toFixed(0)}%)`, toMoney(data.vatAmount)],
    ["TOTAL", toMoney(data.total)],
  ];

  totals.forEach(([label, value], idx) => {
    doc.setFont("helvetica", idx === totals.length - 1 ? "bold" : "normal");
    doc.text(label, 150, y, { align: "right" });
    doc.text(value, 195, y, { align: "right" });
    y += 6;
  });

  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Pago seguro: ${data.payUrl}`, 14, y, { maxWidth: 180 });
  y += 5;
  if (data.deliveryType === "PAPER_SHIP") {
    doc.text("El coste de envío en papel (12 € + IVA) está incluido en el total.", 14, y, { maxWidth: 180 });
    y += 5;
  }

  if (data.notesLegal) {
    doc.text(`Notas legales: ${data.notesLegal}`, 14, y, { maxWidth: 180 });
    y += 5;
  }

  if (data.isDraft) {
    doc.setTextColor(220, 20, 60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(28);
    doc.text("BORRADOR", 105, 150, { align: "center", angle: -25 });
    doc.setTextColor(0, 0, 0);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

export function hashPdf(buffer: Buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function uploadFinalQuotePdf(params: {
  quoteNumber: string;
  buffer: Buffer;
}) {
  if (!isBlobConfigured()) {
    throw new Error("BLOB_READ_WRITE_TOKEN no configurado para guardar PDF final.");
  }
  const safeNumber = params.quoteNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  const blob = await put(`quotes/${safeNumber}/final-${Date.now()}.pdf`, params.buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/pdf",
  });
  return blob.url;
}
