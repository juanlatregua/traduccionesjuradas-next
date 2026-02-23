// lib/invoice-pdf.ts
import { jsPDF } from "jspdf";

type InvoiceData = {
  reference: string;
  title: string;
  amountCents: number;
  langPair?: string | null;
  words?: number | null;
  paidAt?: Date | null;
  createdAt: Date;
  billing: {
    fiscalName: string;
    nif: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
    email: string;
  };
};

const EMITTER = {
  name: "HBTJ Consultores Linguisticos S.L.",
  cif: "B93712784",
  address: "Calle Esperanto, 9",
  city: "29007 Malaga",
  country: "Espana",
  email: "hola@traduccionesjuradas.net",
  phone: "+34 951 333 614",
};

export function generateInvoicePdf(data: InvoiceData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Force white page background to avoid dark-mode viewers showing black canvas.
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("FACTURA", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("traduccionesjuradas.net", pageWidth - margin, y, { align: "right" });
  y += 12;

  // Invoice number & date
  const invoiceDate = data.paidAt || data.createdAt;
  const dateStr = invoiceDate.toISOString().slice(0, 10);
  const invoiceNumber = `F-${data.reference.replace("_", "-")}`;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`N. factura: ${invoiceNumber}`, margin, y);
  doc.text(`Fecha: ${dateStr}`, pageWidth - margin, y, { align: "right" });
  y += 10;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Two columns: emitter & client
  const colWidth = contentWidth / 2 - 5;

  // Emitter
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("EMISOR", margin, y);
  doc.text("CLIENTE", margin + colWidth + 10, y);
  y += 5;

  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(EMITTER.name, margin, y);
  doc.text(data.billing.fiscalName, margin + colWidth + 10, y);
  y += 4.5;

  doc.setFont("helvetica", "normal");
  doc.text(`CIF: ${EMITTER.cif}`, margin, y);
  doc.text(`NIF/CIF: ${data.billing.nif}`, margin + colWidth + 10, y);
  y += 4.5;

  doc.text(EMITTER.address, margin, y);
  doc.text(data.billing.address, margin + colWidth + 10, y);
  y += 4.5;

  doc.text(EMITTER.city, margin, y);
  doc.text(`${data.billing.postalCode} ${data.billing.city}`, margin + colWidth + 10, y);
  y += 4.5;

  doc.text(EMITTER.email, margin, y);
  doc.text(data.billing.country, margin + colWidth + 10, y);
  y += 4.5;

  doc.text(EMITTER.phone, margin, y);
  doc.text(data.billing.email, margin + colWidth + 10, y);
  y += 10;

  // Divider
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Table header
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, contentWidth, 8, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Concepto", margin + 2, y);
  doc.text("Importe", pageWidth - margin - 2, y, { align: "right" });
  y += 8;

  // Line item
  const baseAmount = data.amountCents / 100;
  const iva = 0; // Traducciones juradas están exentas de IVA (art. 20.1.26 LIVA)
  const ivaAmount = baseAmount * iva;
  const total = baseAmount + ivaAmount;

  doc.setFont("helvetica", "normal");
  const conceptLines = doc.splitTextToSize(data.title, contentWidth - 40);
  doc.text(conceptLines, margin + 2, y);
  doc.text(`${baseAmount.toFixed(2)} EUR`, pageWidth - margin - 2, y, { align: "right" });
  y += conceptLines.length * 4.5 + 2;

  if (data.langPair) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text(`Idiomas: ${data.langPair}${data.words ? ` · ${data.words} palabras` : ""}`, margin + 2, y);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    y += 6;
  }

  // Totals
  y += 4;
  doc.line(margin + contentWidth / 2, y, pageWidth - margin, y);
  y += 6;

  doc.text("Base imponible:", margin + contentWidth / 2, y);
  doc.text(`${baseAmount.toFixed(2)} EUR`, pageWidth - margin - 2, y, { align: "right" });
  y += 5;

  doc.text("IVA (0% - exento art. 20.1.26 LIVA):", margin + contentWidth / 2, y);
  doc.text(`${ivaAmount.toFixed(2)} EUR`, pageWidth - margin - 2, y, { align: "right" });
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TOTAL:", margin + contentWidth / 2, y);
  doc.text(`${total.toFixed(2)} EUR`, pageWidth - margin - 2, y, { align: "right" });
  y += 15;

  // Footer note
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Operacion exenta de IVA conforme al articulo 20.Uno.26 de la Ley 37/1992 del Impuesto sobre el Valor Anadido.",
    margin,
    y
  );
  y += 4;
  doc.text(`Referencia pedido: ${data.reference}`, margin, y);

  // Return as Buffer
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
