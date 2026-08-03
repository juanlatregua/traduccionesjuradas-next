// lib/invoice-pdf.ts — Factura PDF con la plantilla de HBTJ (estilo 24_014),
// logo de la web recreado en vectores (jsPDF no rasteriza SVG) y presentación
// mejorada: banda dorada de marca, caja de número, datos del cliente, tabla con
// par de idiomas, resumen Base/IVA/TOTAL y pie con datos bancarios.
import { jsPDF } from "jspdf";
import { getBrand } from "@/lib/invoice-brands";

type InvoiceLine = {
  description: string;
  detail?: string;
  amountCents: number;
};

type InvoiceData = {
  reference?: string;
  title: string;
  amountCents: number;
  baseCents?: number;
  vatCents?: number;
  vatRate?: number; // fracción (0.21). Si se omite, se asume 21%.
  draft?: boolean; // marca de agua PROFORMA y oculta el número
  docKind?: string; // invoice | quote — quote imprime "PRESUPUESTO" en vez de FACTURA
  simplified?: boolean; // factura simplificada (RD 1619/2012)
  brand?: string; // marca/actividad emisora (traduccionesjuradas | holabonjour)
  logoDataUrl?: string; // PNG en data URL para marcas con logo de imagen
  poNumber?: string | null; // Purchase Order / nº de pedido del cliente
  holderNames?: string | null; // titulares de los certificados (informativo)
  langPair?: string | null;
  words?: number | null;
  paidAt?: Date | null;
  createdAt: Date;
  invoiceNumber?: string;
  issuedAt?: Date | null;
  lines?: InvoiceLine[];
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

// Respaldo si falta el PNG del logo de Hola Bonjour: wordmark en sus colores.
function drawHolaBonjourWordmark(doc: jsPDF, x: number, y: number) {
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(20);
  doc.setTextColor(46, 90, 172); // azul
  doc.text("Hola", x, y);
  doc.setTextColor(229, 23, 107); // magenta
  doc.text("Bonjour", x, y + 8.5);
  doc.setDrawColor(229, 23, 107);
  doc.setLineWidth(0.5);
  doc.line(x, y + 11.5, x + 46, y + 11.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(46, 90, 172);
  doc.text("LENGUA Y CULTURA FRANCESA", x, y + 15);
}

// Paleta marca web
const GOLD: [number, number, number] = [184, 146, 42]; // #B8922A
export const GOLD_DARK: [number, number, number] = [150, 117, 30];
const BLUE: [number, number, number] = [61, 111, 168]; // #3D6FA8
export const INK: [number, number, number] = [17, 32, 46];
export const GREY: [number, number, number] = [110, 122, 133];
const TABLE_BG: [number, number, number] = [225, 230, 245];
const LINE_GREY: [number, number, number] = [206, 211, 220];

const LANG: Record<string, string> = {
  es: "español", fr: "francés", en: "inglés", de: "alemán", it: "italiano",
  pt: "portugués", ca: "catalán", nl: "neerlandés", sv: "sueco", no: "noruego",
  ar: "árabe", ro: "rumano",
};

function langLabel(pair?: string | null): string {
  if (!pair) return "";
  const parts = pair.split(/->|—|-|→/).map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 2) return `${LANG[parts[0]] || parts[0]}-${LANG[parts[1]] || parts[1]}`;
  return pair;
}

function eur(cents: number): string {
  const n = (cents / 100).toFixed(2);
  const [int, dec] = n.split(".");
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots},${dec} €`;
}

// Recreación vectorial del logo (banner dorado + monograma TJ + wordmark + .net).
export function drawLogo(doc: jsPDF, x: number, y: number, w: number) {
  const s = w / 600; // escala desde el viewBox 600x200
  const h = 200 * s;
  const px = (u: number) => x + u * s;
  const py = (u: number) => y + u * s;

  // Banner dorado
  doc.setFillColor(...GOLD);
  doc.roundedRect(x, y, w, h, 18 * s, 18 * s, "F");
  // Franja .net inferior (un tono más oscuro)
  doc.setFillColor(...GOLD_DARK);
  doc.rect(x, py(160), w, h - 160 * s, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13 * s * 2.0);
  doc.text(".net", px(300), py(188), { align: "center" });

  // Monograma TJ
  doc.setLineCap("round");
  doc.setLineWidth(16 * s);
  doc.setDrawColor(255, 255, 255);
  doc.line(px(40), py(36), px(160), py(36)); // barra T
  doc.line(px(76), py(36), px(76), py(142)); // tallo T
  doc.setDrawColor(...BLUE);
  doc.line(px(76), py(142), px(160), py(142)); // base azul
  // Arco D (bezier cúbico relativo)
  doc.lines([[70 * s, 0, 70 * s, 106 * s, 0, 106 * s]], px(160), py(36), [1, 1], "S", false);
  doc.setFillColor(...GOLD);
  doc.circle(px(76), py(89), 9 * s, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(px(76), py(89), 5.5 * s, "F");

  // Wordmark
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(30 * s * 2.0);
  doc.text("TRADUCCIONES", px(256), py(74));
  doc.text("JURADAS", px(256), py(110));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11 * s * 2.0);
  doc.setTextColor(255, 255, 255);
  doc.text("traducción oficial certificada · españa", px(257), py(140));
}

export function generateInvoicePdf(data: InvoiceData): Buffer {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = 210;
  const margin = 16;
  const contentW = pageW - margin * 2;

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageW, 297, "F");

  // ── Cabecera: logo + emisor (según marca) ─────────────────
  const brand = getBrand(data.brand);
  if (brand.logo.kind === "image" && data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, "PNG", margin, 10, brand.logo.widthMm, brand.logo.heightMm);
    } catch {
      drawHolaBonjourWordmark(doc, margin, 16);
    }
  } else if (brand.logo.kind === "image") {
    drawHolaBonjourWordmark(doc, margin, 16);
  } else {
    drawLogo(doc, margin, 14, 66);
  }
  let y = 46;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...GOLD_DARK);
  doc.text(brand.emitterName, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(`CIF: ${brand.cif}`, margin, (y += 4.5));
  doc.text(brand.address, margin, (y += 4.5));
  doc.text(brand.city, margin, (y += 4.5));

  // ── Caja número de factura (arriba derecha) ───────────────
  const boxX = 120;
  const boxW = pageW - margin - boxX;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, 16, boxW, 15, 1.5, 1.5, "S");
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  const isSimpl = !!data.simplified && !data.draft;
  const isQuote = data.docKind === "quote";
  doc.setFontSize(isSimpl || isQuote ? 10 : 13);
  doc.text(
    isQuote ? "PRESUPUESTO" : data.draft ? "PROFORMA" : isSimpl ? "FACTURA SIMPLIFICADA" : "FACTURA",
    boxX + 5,
    25.5
  );
  doc.setFontSize(15);
  const numberLabel = data.invoiceNumber || (data.draft ? "BORRADOR" : data.reference ? `F-${data.reference}` : "—");
  doc.text(numberLabel, pageW - margin - 5, 25.5, { align: "right" });

  // ── Caja cliente ──────────────────────────────────────────
  const cliY = 35;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const rawCli = [
    data.billing.fiscalName,
    data.billing.nif ? `NIF/CIF: ${data.billing.nif}` : "",
    data.billing.address,
    [data.billing.postalCode, data.billing.city].filter(Boolean).join(" "),
    data.billing.country,
  ].filter(Boolean);
  const cliWrapped: string[] = rawCli.flatMap((l) => doc.splitTextToSize(l, boxW - 10) as string[]);
  const cliH = 9 + cliWrapped.length * 4.3;
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.4);
  doc.roundedRect(boxX, cliY, boxW, cliH, 1.5, 1.5, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...BLUE);
  doc.text("Cliente:", boxX + 5, cliY + 6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK);
  let cy = cliY + 11;
  for (const l of cliWrapped) {
    doc.text(l, boxX + 5, cy);
    cy += 4.3;
  }

  // ── Fecha ─────────────────────────────────────────────────
  const dateStr = (data.issuedAt || data.paidAt || data.createdAt).toLocaleDateString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(`Fecha: ${dateStr}`, margin, 66);

  // ── Titulares de los certificados (informativo) ───────────
  let leftBottom = 66;
  const holders = (data.holderNames || "").trim();
  if (holders) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BLUE);
    doc.text("Titulares:", margin, 72);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK);
    // El bloque del cliente ocupa la derecha (desde boxX); deja margen hasta ahí.
    const holderWrapped = doc.splitTextToSize(holders, boxX - margin - 22) as string[];
    let hy = 72;
    for (const l of holderWrapped) {
      doc.text(l, margin + 18, hy);
      hy += 4.3;
    }
    leftBottom = hy;
  }

  // ── Tabla ─────────────────────────────────────────────────
  let ty = Math.max(74, leftBottom + 4, cliY + cliH + 8);
  const cDesc = margin;
  const cLangW = 44;
  const cImpW = 30;
  const cImp = pageW - margin; // borde derecho (texto align right)
  const cLang = pageW - margin - cImpW - cLangW; // x inicio col idioma

  // Cabecera tabla (banda dorada)
  doc.setFillColor(...GOLD);
  doc.rect(cDesc, ty, contentW, 9, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Descripción (nº de páginas/palabras por documento)", cDesc + 2, ty + 5.6);
  doc.setFontSize(8);
  if (data.langPair) doc.text(langLabel(data.langPair), cLang + cLangW / 2, ty + 5.6, { align: "center" });
  doc.text("Importe", cImp - 2, ty + 5.6, { align: "right" });
  ty += 9;

  // Cuerpo
  const lines: InvoiceLine[] =
    data.lines && data.lines.length > 0
      ? data.lines.map((l) => ({ ...l }))
      : [{ description: data.title, amountCents: Math.round(data.amountCents / 1.21) }];
  if (data.poNumber && lines[0]) {
    const po = `Purchase Order / Nº de pedido ${data.poNumber}`;
    lines[0].detail = lines[0].detail ? `${lines[0].detail} · ${po}` : po;
  }

  const bodyTop = ty;
  doc.setTextColor(...INK);
  for (const line of lines) {
    // El detalle (p.ej. nota legal de inversión del sujeto pasivo) se envuelve a
    // varias líneas para no cortarse por la derecha; la fila crece con él.
    let detailLines: string[] = [];
    if (line.detail) {
      doc.setFontSize(7.5);
      detailLines = doc.splitTextToSize(line.detail, contentW - 6) as string[];
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(line.description, cLang - cDesc - 4) as string[];
    const descH = 8 + (descLines.length - 1) * 4;
    const rowH = line.detail ? descH + detailLines.length * 3.2 : descH;
    doc.setFillColor(...TABLE_BG);
    doc.rect(cDesc, ty, contentW, rowH, "F");
    doc.setTextColor(...INK);
    doc.text(descLines, cDesc + 2, ty + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(eur(line.amountCents), cImp - 2, ty + 5.5, { align: "right" });
    if (line.detail) {
      doc.setFontSize(7.5);
      doc.setTextColor(...GREY);
      doc.text(detailLines, cDesc + 2, ty + descH + 1.5);
      doc.setTextColor(...INK);
    }
    ty += rowH;
  }
  // Borde del cuerpo
  doc.setDrawColor(...LINE_GREY);
  doc.setLineWidth(0.3);
  doc.rect(cDesc, bodyTop, contentW, ty - bodyTop, "S");

  // ── Resumen Base / IVA / TOTAL ────────────────────────────
  const vatRate = data.vatRate ?? 0.21;
  const base = data.baseCents ?? Math.round(data.amountCents / (1 + vatRate));
  const vat = data.vatCents ?? data.amountCents - base;
  const vatPct = Math.round(vatRate * 100);
  ty += 3;
  const sumLabelX = cLang;
  const drawSum = (label: string, value: string, bold = false, big = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(big ? 11 : 9);
    doc.setTextColor(...(bold ? INK : GREY));
    doc.text(label, sumLabelX, ty);
    doc.setTextColor(...INK);
    doc.text(value, cImp - 2, ty, { align: "right" });
    ty += big ? 7 : 5.2;
  };
  drawSum("Base imponible", eur(base));
  drawSum(vatPct === 0 ? "IVA (exento/0%)" : `IVA ${vatPct}%`, eur(vat));
  ty += 1.5;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(sumLabelX, ty - 4, cImp, ty - 4);
  drawSum("TOTAL", eur(data.amountCents), true, true);

  // ── Pie: si está pagada, sello PAGADA (sin datos bancarios); si no, datos de pago ──
  const footY = 270;
  if (data.paidAt) {
    doc.setFillColor(22, 101, 52); // verde: cobrada
    doc.roundedRect(margin, footY, contentW, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(isQuote ? "PAGADO / Paiement reçu" : "FACTURA PAGADA / Paiement reçu", margin + 5, footY + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const paidStr = data.paidAt.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
    doc.text(`Cobrada el ${paidStr}`, margin + 5, footY + 12.5);
  } else {
    doc.setFillColor(...BLUE);
    doc.roundedRect(margin, footY, contentW, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("BIC/SWIFT", margin + 5, footY + 6);
    doc.text("CUENTA BANCARIA / Bank account", margin + 5, footY + 11.5);
    doc.setFont("helvetica", "normal");
    doc.text(brand.bic, margin + 60, footY + 6);
    doc.text(brand.iban, margin + 60, footY + 11.5);
  }

  // ── Marca de agua de borrador (proforma, sin valor fiscal) ────────────
  if (data.draft) {
    doc.setTextColor(214, 219, 228);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(60);
    doc.text("BORRADOR", 105, 165, { align: "center", angle: 32 });
    doc.setFontSize(11);
    doc.text("Proforma · sin valor como factura", 105, 178, { align: "center", angle: 32 });
  }

  const ab = doc.output("arraybuffer");
  return Buffer.from(ab);
}
