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
  paymentMethods?: string[]; // bbva/openbank/bizum/paypal — vacío = todas por defecto
  contactWhatsapp?: string | null; // WhatsApp/teléfono override para este presupuesto
};

function toMoney(value: number) {
  return `${value.toFixed(2)} EUR`;
}

// La fuente estándar de jsPDF (helvetica/WinAnsi) no tiene varios caracteres
// Unicode (p.ej. la flecha →) → salen como garabatos. Los normalizamos.
function safe(s: string) {
  return String(s ?? "")
    .replace(/→/g, "->")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...");
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
    const descLines: string[] = doc.splitTextToSize(safe(line.description), 90);
    const rowHeight = Math.max(6, descLines.length * 5);
    doc.setFont("helvetica", "normal");
    doc.text(descLines, 14, y);
    doc.text(String(line.quantity), 110, y, { align: "right" });
    doc.text(toMoney(line.unitPrice), 145, y, { align: "right" });
    doc.text(toMoney(line.lineTotal), 195, y, { align: "right" });
    y += rowHeight;
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
  // El enlace de pago NO va en el PDF (se envía aparte por WhatsApp/email, copia-pega).
  if (data.deliveryType === "PAPER_SHIP") {
    doc.text("El coste de envío en papel (12 € + IVA) está incluido en el total.", 14, y, { maxWidth: 180 });
    y += 5;
  }

  if (data.notesLegal) {
    doc.text(`Notas legales: ${safe(data.notesLegal)}`, 14, y, { maxWidth: 180 });
    y += 5;
  }

  // Pago por transferencia / Bizum como alternativa al enlace online. En el
  // presupuesto se ofrecen las dos cuentas (BBVA principal + Openbank 2ª opción).
  y += 2;
  if (y > 255) {
    doc.addPage();
    y = 18;
  }
  const methods =
    data.paymentMethods && data.paymentMethods.length > 0
      ? data.paymentMethods
      : ["bbva", "openbank", "bizum"];
  const payLines: string[] = [];
  if (methods.includes("bbva")) {
    payLines.push("BBVA · BIC BBVAESMM · IBAN ES66 0182 3370 67 0201616991 · HBTJ Consultores Lingüísticos");
  }
  if (methods.includes("openbank")) {
    payLines.push("Openbank · BIC OPENESMM · IBAN ES33 0073 0100 5207 9242 5264 · Juan Silva");
  }
  const bizumBoth = methods.includes("bizum");
  if (bizumBoth || methods.includes("bizum607")) payLines.push("Bizum: 607356273");
  if (bizumBoth || methods.includes("bizum654")) payLines.push("Bizum: 654069126");
  if (methods.includes("paypal")) {
    payLines.push("PayPal: hola@traduccionesjuradas.net");
  }
  if (payLines.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Pago por transferencia, Bizum o PayPal (opcional):", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    for (const line of payLines) {
      doc.text(line, 14, y, { maxWidth: 180 });
      y += 4.5;
    }
    y += 0.5;
  }
  const whatsapp = (data.contactWhatsapp || "").trim() || "951 333 614";
  doc.setFont("helvetica", "normal");
  doc.text(`Dudas: WhatsApp / teléfono ${whatsapp}`, 14, y, { maxWidth: 180 });
  y += 5;

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
