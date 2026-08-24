import crypto from "crypto";
import { jsPDF } from "jspdf";
import { put } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/payment-config";
import { drawLogo, GOLD_DARK, GREY } from "@/lib/invoice-pdf";
import { getBrand } from "@/lib/invoice-brands";

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
  paid?: boolean; // recibo: sella el presupuesto como PAGADO (marca de agua + indicador)
  notesLegal?: string | null;
  holderNames?: string | null; // titulares de los certificados (informativo)
  translatorName?: string | null; // jurado que realiza la traducción (directriz 12-ago)
  translatorMaec?: string | null;
  paymentMethods?: string[]; // bbva/openbank/bizum/paypal — vacío = todas por defecto
  contactWhatsapp?: string | null; // WhatsApp/teléfono override para este presupuesto
  lang?: string | null; // idioma del PDF (es|en|fr|it|pt|de); otro/ausente = es
};

// Idiomas del PDF (petición Juan 21-ago-2026: "poner el presupuesto en otros
// idiomas como los mensajes"). Rótulos fijos traducidos; las líneas las escribe
// el staff en el builder (en el idioma que quiera). Fechas e importes con el
// formato del idioma (Intl), limpiando los espacios finos que no están en WinAnsi.
import { QUOTE_PDF_LANGS, normalizeQuotePdfLang, type QuotePdfLang } from "@/lib/quote-pdf-langs";
export { QUOTE_PDF_LANGS, QUOTE_PDF_LANG_LABELS, normalizeQuotePdfLang, type QuotePdfLang } from "@/lib/quote-pdf-langs";
const PDF_LOCALE: Record<QuotePdfLang, string> = { es: "es-ES", en: "en-GB", fr: "fr-FR", it: "it-IT", pt: "pt-PT", de: "de-DE" };

type PdfStrings = {
  title: string; no: string; issued: string; validUntil: string; paid: string; client: string;
  holders: string; languages: string; delivery: string; deliveryDigital: string; deliveryPaper: string;
  translator: string; maecNo: (n: string) => string; maecAppointed: string;
  cols: [string, string, string, string]; subtotal: string; discount: string; shipping: string;
  vat: (pct: string) => string; total: string; paperNote: string; legalNotes: string; payTitle: string;
  beneficiary: string; bank: string; questions: string;
};
const PDF_STRINGS: Record<QuotePdfLang, PdfStrings> = {
  es: {
    title: "PRESUPUESTO", no: "Nº", issued: "Emisión", validUntil: "Válido hasta", paid: "PAGADO", client: "Cliente",
    holders: "Titulares", languages: "Idiomas", delivery: "Entrega", deliveryDigital: "PDF digital firmado",
    deliveryPaper: "Envío en papel (mensajería)", translator: "Traductor/a jurado/a",
    maecNo: (n) => `nº ${n} del MAEC`, maecAppointed: "nombrado/a por el MAEC",
    cols: ["Descripción", "Cantidad", "Precio", "Total"], subtotal: "Subtotal", discount: "Descuento", shipping: "Envío",
    vat: (p) => `IVA (${p}%)`, total: "TOTAL",
    paperNote: "El coste de envío en papel (12 € + IVA) está incluido en el total.", legalNotes: "Notas legales",
    payTitle: "Pago por transferencia, Bizum o PayPal (opcional):", beneficiary: "Beneficiario", bank: "Banco",
    questions: "Dudas: WhatsApp / teléfono",
  },
  en: {
    title: "QUOTE", no: "No.", issued: "Issued", validUntil: "Valid until", paid: "PAID", client: "Customer",
    holders: "Holders", languages: "Languages", delivery: "Delivery", deliveryDigital: "Digitally signed PDF",
    deliveryPaper: "Paper copy by courier", translator: "Sworn translator",
    maecNo: (n) => `MAEC no. ${n}`, maecAppointed: "appointed by the Spanish Ministry of Foreign Affairs (MAEC)",
    cols: ["Description", "Qty", "Price", "Total"], subtotal: "Subtotal", discount: "Discount", shipping: "Shipping",
    vat: (p) => `VAT (${p}%)`, total: "TOTAL",
    paperNote: "The paper shipping cost (€12 + VAT) is included in the total.", legalNotes: "Legal notes",
    payTitle: "Payment by bank transfer, Bizum or PayPal (optional):", beneficiary: "Beneficiary", bank: "Bank",
    questions: "Questions: WhatsApp / phone",
  },
  fr: {
    title: "DEVIS", no: "N°", issued: "Émission", validUntil: "Valable jusqu'au", paid: "PAYÉ", client: "Client",
    holders: "Titulaires", languages: "Langues", delivery: "Livraison", deliveryDigital: "PDF signé électroniquement",
    deliveryPaper: "Envoi papier (coursier)", translator: "Traducteur/trice assermenté(e)",
    maecNo: (n) => `n° ${n} du MAEC`, maecAppointed: "nommé(e) par le Ministère espagnol des Affaires étrangères (MAEC)",
    cols: ["Description", "Quantité", "Prix", "Total"], subtotal: "Sous-total", discount: "Remise", shipping: "Frais d'envoi",
    vat: (p) => `TVA (${p} %)`, total: "TOTAL",
    paperNote: "Les frais d'envoi papier (12 € + TVA) sont inclus dans le total.", legalNotes: "Mentions légales",
    payTitle: "Paiement par virement, Bizum ou PayPal (facultatif) :", beneficiary: "Bénéficiaire", bank: "Banque",
    questions: "Questions : WhatsApp / téléphone",
  },
  it: {
    title: "PREVENTIVO", no: "N.", issued: "Emissione", validUntil: "Valido fino al", paid: "PAGATO", client: "Cliente",
    holders: "Titolari", languages: "Lingue", delivery: "Consegna", deliveryDigital: "PDF con firma digitale",
    deliveryPaper: "Invio cartaceo (corriere)", translator: "Traduttore/trice giurato/a",
    maecNo: (n) => `n. ${n} del MAEC`, maecAppointed: "nominato/a dal Ministero degli Esteri spagnolo (MAEC)",
    cols: ["Descrizione", "Quantità", "Prezzo", "Totale"], subtotal: "Subtotale", discount: "Sconto", shipping: "Spedizione",
    vat: (p) => `IVA (${p}%)`, total: "TOTALE",
    paperNote: "Il costo della spedizione cartacea (12 € + IVA) è incluso nel totale.", legalNotes: "Note legali",
    payTitle: "Pagamento con bonifico, Bizum o PayPal (facoltativo):", beneficiary: "Beneficiario", bank: "Banca",
    questions: "Domande: WhatsApp / telefono",
  },
  pt: {
    title: "ORÇAMENTO", no: "N.º", issued: "Emissão", validUntil: "Válido até", paid: "PAGO", client: "Cliente",
    holders: "Titulares", languages: "Idiomas", delivery: "Entrega", deliveryDigital: "PDF assinado digitalmente",
    deliveryPaper: "Envio em papel (estafeta)", translator: "Tradutor/a ajuramentado/a",
    maecNo: (n) => `n.º ${n} do MAEC`, maecAppointed: "nomeado/a pelo Ministério dos Negócios Estrangeiros de Espanha (MAEC)",
    cols: ["Descrição", "Quantidade", "Preço", "Total"], subtotal: "Subtotal", discount: "Desconto", shipping: "Envio",
    vat: (p) => `IVA (${p}%)`, total: "TOTAL",
    paperNote: "O custo do envio em papel (12 € + IVA) está incluído no total.", legalNotes: "Notas legais",
    payTitle: "Pagamento por transferência, Bizum ou PayPal (opcional):", beneficiary: "Beneficiário", bank: "Banco",
    questions: "Dúvidas: WhatsApp / telefone",
  },
  de: {
    title: "ANGEBOT", no: "Nr.", issued: "Ausgestellt", validUntil: "Gültig bis", paid: "BEZAHLT", client: "Kunde",
    holders: "Inhaber", languages: "Sprachen", delivery: "Lieferung", deliveryDigital: "Digital signiertes PDF",
    deliveryPaper: "Versand in Papierform (Kurier)", translator: "Vereidigte/r Übersetzer/in",
    maecNo: (n) => `Nr. ${n} des MAEC`, maecAppointed: "ernannt vom spanischen Außenministerium (MAEC)",
    cols: ["Beschreibung", "Menge", "Preis", "Gesamt"], subtotal: "Zwischensumme", discount: "Rabatt", shipping: "Versand",
    vat: (p) => `MwSt. (${p} %)`, total: "GESAMT",
    paperNote: "Die Versandkosten in Papierform (12 € + MwSt.) sind im Gesamtbetrag enthalten.", legalNotes: "Rechtliche Hinweise",
    payTitle: "Zahlung per Überweisung, Bizum oder PayPal (optional):", beneficiary: "Begünstigter", bank: "Bank",
    questions: "Fragen: WhatsApp / Telefon",
  },
};

// Importes con el formato del idioma ("123,45 €" / "€123.45"); los espacios finos
// (U+202F/U+00A0) que mete Intl no están en WinAnsi → espacio normal.
function moneyFor(lang: QuotePdfLang) {
  const fmt = new Intl.NumberFormat(PDF_LOCALE[lang], { style: "currency", currency: "EUR" });
  return (value: number) => fmt.format(value).replace(/[\u202F\u00A0]/g, " ");
}
function dateFor(lang: QuotePdfLang) {
  return (input: Date | string) => {
    const date = input instanceof Date ? input : new Date(input);
    if (isNaN(date.getTime())) return String(input);
    return date.toLocaleDateString(PDF_LOCALE[lang], { day: "2-digit", month: "2-digit", year: "numeric" });
  };
}

// La helvetica estándar de jsPDF (WinAnsi) SÍ tiene ñ, tildes, ç, «», — y …
// (verificado 21-ago-2026: mismo ancho medido con y sin tildes, y el texto sale
// correcto). Antes se quitaban los diacríticos "por si infra-medía" y el PDF
// salía con "Espanol"/"Paginas" (queja de Juan, presupuesto 2026-00081). Lo
// único que no está en WinAnsi es la flecha → (salía como garabato): se cambia
// por › (sí está).
function safe(s: string) {
  return String(s ?? "")
    .replace(/\s*→\s*/g, " › ")
    .replace(/[\u2190\u2192\u2194]/g, "-");
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
  const brand = getBrand("traduccionesjuradas");
  const lang = normalizeQuotePdfLang(data.lang);
  const t = PDF_STRINGS[lang];
  const toMoney = moneyFor(lang);
  const fmtDate = dateFor(lang);

  // Cabecera con el MISMO logo y datos que las facturas (logo vectorial).
  drawLogo(doc, 14, 12, 64);
  let yEmit = 42;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...GOLD_DARK);
  doc.text(brand.emitterName, 14, yEmit);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GREY);
  doc.text(`CIF: ${brand.cif}`, 14, (yEmit += 4));
  doc.text(brand.address, 14, (yEmit += 4));
  doc.text(brand.city, 14, (yEmit += 4));

  // Meta del presupuesto (arriba derecha)
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(t.title, 196, 18, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${t.no} ${data.quoteNumber}`, 196, 24, { align: "right" });
  doc.text(`${t.issued}: ${fmtDate(data.issuedAt)}`, 196, 29, { align: "right" });
  doc.text(`${t.validUntil}: ${fmtDate(data.validUntil)}`, 196, 34, { align: "right" });
  if (data.paid) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 140, 60);
    doc.text(t.paid, 196, 40, { align: "right" });
    doc.setFont("helvetica", "normal");
  }

  doc.setTextColor(0, 0, 0);
  let y = 58;

  doc.setDrawColor(210, 210, 210);
  doc.line(14, y, 196, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text(t.client, 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`${data.customerName} (${data.customerEmail})`, 14, y);
  y += 5;
  if (data.holderNames && data.holderNames.trim()) {
    const holderLines = doc.splitTextToSize(`${t.holders}: ${safe(data.holderNames)}`, 182) as string[];
    for (const hl of holderLines) {
      doc.text(hl, 14, y);
      y += 5; // mismo paso de 5 mm que el resto del bloque Cliente
    }
  }
  doc.text(`${t.languages}: ${data.sourceLang.toUpperCase()} › ${data.targetLang.toUpperCase()}`, 14, y);
  y += 5;
  doc.text(
    `${t.delivery}: ${data.deliveryType === "DIGITAL_PDF" ? t.deliveryDigital : t.deliveryPaper}`,
    14,
    y
  );
  y += 5;
  if (data.translatorName) {
    const juradoLines = doc.splitTextToSize(
      `${t.translator}: ${safe(data.translatorName)}${data.translatorMaec ? ` — ${t.maecNo(safe(data.translatorMaec))}` : ` — ${t.maecAppointed}`}`,
      182
    ) as string[];
    for (const jl of juradoLines) {
      doc.text(jl, 14, y);
      y += 5;
    }
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  drawRow(doc, y, t.cols, true);
  y += 2;
  doc.line(14, y, 196, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  data.lines.forEach((line) => {
    if (y > 265) {
      doc.addPage();
      y = 18;
      drawRow(doc, y, t.cols, true);
      y += 2;
      doc.line(14, y, 196, y);
      y += 5;
    }
    // Acotar la descripcion a SU columna: splitTextToSize ya corta a 82 mm (deja
    // hueco hasta Cantidad en x=110). El render va SIN maxWidth: pasarlo de nuevo
    // hacia justificar el parrafo (caracteres espaciados) y volvia a descuadrar.
    const descLines: string[] = doc.splitTextToSize(safe(line.description), 82);
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
    [t.subtotal, toMoney(data.subtotal)],
    [t.discount, `- ${toMoney(data.discountAmount)}`],
    [t.shipping, toMoney(data.shippingAmount)],
    [t.vat((data.vatRate * 100).toFixed(0)), toMoney(data.vatAmount)],
    [t.total, toMoney(data.total)],
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
    doc.text(t.paperNote, 14, y, { maxWidth: 180 });
    y += 5;
  }

  if (data.notesLegal) {
    doc.text(`${t.legalNotes}: ${safe(data.notesLegal)}`, 14, y, { maxWidth: 180 });
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
      // Fallback sin métodos guardados: Sabadell (BBVA en cierre, orden 24-ago).
      : ["sabadell", "bizum"];
  const payLines: string[] = [];
  if (methods.includes("bbva")) {
    payLines.push("BBVA · BIC BBVAESMM · IBAN ES66 0182 3370 67 0201616991 · HBTJ Consultores Lingüísticos");
  }
  if (methods.includes("openbank")) {
    payLines.push("Openbank · BIC OPENESMM · IBAN ES33 0073 0100 5207 9242 5264 · Juan Silva");
  }
  if (methods.includes("sabadell")) {
    payLines.push("Banco Sabadell · BIC BSABESBB · IBAN ES47 0081 0240 1100 0378 7991 · HBTJ Consultores Lingüísticos");
  }
  const bizumBoth = methods.includes("bizum");
  if (bizumBoth || methods.includes("bizum607")) payLines.push("Bizum: 607356273");
  if (bizumBoth || methods.includes("bizum654")) payLines.push("Bizum: 654069126");
  if (methods.includes("paypal")) {
    payLines.push("PayPal: hola@traduccionesjuradas.net");
  }
  if (methods.includes("revolut")) {
    // Cuenta internacional: datos COMPLETOS para transferencias SWIFT desde fuera de España.
    payLines.push("Revolut Bank UAB · IBAN ES32 1583 0001 1490 2264 2489 (ES3215830001149022642489) · BIC/SWIFT REVOESM2 · EUR");
    payLines.push(`${t.beneficiary}: Juan Antonio Silva Moreno · Eugenio Sellés 5, 29017 Málaga, España`);
    payLines.push(`${t.bank}: Revolut Bank UAB · Calle Príncipe de Vergara 132, 4ª planta, 28002 Madrid, España`);
  }
  if (payLines.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(t.payTitle, 14, y);
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
  doc.text(`${t.questions} ${whatsapp}`, 14, y, { maxWidth: 180 });
  y += 5;

  // Marca de agua PAGADO (recibo): diagonal, verde, translúcida, encima del
  // contenido sin taparlo. GState para la opacidad (cast: los tipos de jspdf
  // no exponen GState en la instancia).
  if (data.paid) {
    const anyDoc = doc as any;
    doc.saveGraphicsState();
    anyDoc.setGState(new anyDoc.GState({ opacity: 0.16 }));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(90);
    doc.setTextColor(0, 140, 60);
    doc.text(t.paid, 105, 175, { align: "center", angle: 32 });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
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
