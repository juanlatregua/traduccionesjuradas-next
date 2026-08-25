// Carpeta del expediente de un pedido como ZIP (orden de Juan 25-ago-2026: «en los
// pedidos no hay forma de descargar el expediente… crear una carpeta en el mac con
// los datos»). Único elemento raíz: <ref>_<par>_<cliente>/ con originales/,
// traduccion/ (si hay entrega), expediente.md legible y expediente.json (version 1)
// para importar en TraduCAT. SOLO SERVIDOR. La ruta GET /api/orders/[reference]/expediente
// pone la auth (staff) y la respuesta; aquí solo la construcción, para poder probarla.
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { getSourceDocumentsFromEvents } from "@/lib/order-source-documents";
import { clientVisibleDeliveryFiles } from "@/lib/client-delivery";

const EXPEDIENTE_VERSION = 1;

function slug(s: string, max = 40): string {
  return (
    String(s || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "x"
  );
}

function safeFileName(name: string, fallback: string): string {
  const base = String(name || "").split(/[\\/]/).pop() || "";
  // Los ítems del pedido llevan el par pegado al nombre: "X.pdf (Portugués→Español)".
  const sinPar = base.replace(/\s*\([^()]*(?:→|->)[^()]*\)\s*$/u, "");
  const cleaned = sinPar.normalize("NFC").replace(/[<>:"|?*\u0000-\u001f]/g, "_").trim();
  return cleaned || fallback;
}

function extFromUrl(url: string): string {
  const m = url.split("?")[0].match(/\.([A-Za-z0-9]{2,5})$/);
  return m ? `.${m[1].toLowerCase()}` : ".pdf";
}

async function fetchBytes(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(45_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const eur = (cents: number | null | undefined) =>
  cents == null ? null : `${(cents / 100).toFixed(2).replace(".", ",")} €`;

export type ExpedienteZip = { folder: string; buffer: Buffer; originales: number; descargados: number; traduccion: number };

export async function buildExpedienteZip(reference: string, opts: { by: string | null; audit?: boolean }): Promise<ExpedienteZip | null> {
  const staff = { email: opts.by };
  const order = await prisma.order.findUnique({
    where: { reference },
    include: {
      billing: true,
      shipping: true,
      clientInvoice: { select: { number: true, status: true, issuedAt: true } },
      quote: {
        select: {
          quoteNumber: true,
          subtotal: true,
          vatAmount: true,
          total: true,
          deliveryType: true,
          holderNames: true,
          notesLegal: true,
          lines: { select: { description: true, unitPrice: true, supplierUnitCost: true } },
        },
      },
      documentItems: { orderBy: { createdAt: "asc" } },
      documentAnalyses: {
        select: { fileUrl: true, fileName: true, documentType: true, sourceLanguage: true, targetLanguage: true, estimatedWords: true, pageCount: true, analysisJson: true },
      },
      collaboratorAssignments: {
        where: { isWinning: true },
        include: { collaborator: { select: { fullName: true, email: true, swornNumber: true } } },
        take: 1,
      },
      events: { orderBy: { createdAt: "asc" }, select: { type: true, payload: true, createdAt: true, message: true } },
    },
  });
  if (!order) return null;

  // Documentos originales: los ítems del pedido con fichero; si no hay, los
  // adjuntados por evento (pedidos antiguos / entrega directa).
  const items = order.documentItems.filter((d) => d.fileUrl);
  const sources: Array<{ name: string; url: string; type?: string | null; words?: number | null }> =
    items.length > 0
      ? items.map((d) => ({ name: d.fileName, url: d.fileUrl!, type: d.documentType, words: d.words }))
      : getSourceDocumentsFromEvents(order.events)
          .filter((d) => d.url)
          .map((d) => ({ name: d.name, url: d.url! }));

  const byUrl = new Map(order.documentAnalyses.map((a) => [a.fileUrl, a]));
  const pairParts = (order.langPair || "").split("->");
  const par = pairParts.length === 2 ? `${pairParts[0]}-${pairParts[1]}`.toUpperCase() : slug(order.langPair || "par");
  const clientSlug = slug((order.clientName || order.clientEmail || "cliente").split("@")[0].split(" ").slice(-2).join("-"));
  const folder = `${order.reference}_${par}_${clientSlug}`;

  const zip = new JSZip();
  const root = zip.folder(folder)!;
  const originales = root.folder("originales")!;
  const usados = new Set<string>();
  const docsMeta: Array<Record<string, unknown>> = [];
  let idx = 0;
  for (const src of sources) {
    idx += 1;
    const analysis = byUrl.get(src.url);
    const bytes = await fetchBytes(src.url);
    let fileName = `${String(idx).padStart(2, "0")}_${safeFileName(src.name, `documento-${idx}${extFromUrl(src.url)}`)}`;
    if (!/\.[A-Za-z0-9]{2,5}$/.test(fileName)) fileName += extFromUrl(src.url);
    while (usados.has(fileName)) fileName = fileName.replace(/(\.[^.]+)$/, `_2$1`);
    usados.add(fileName);
    if (bytes) originales.file(fileName, bytes);
    const a = analysis?.analysisJson as any;
    docsMeta.push({
      orden: idx,
      fichero: bytes ? `originales/${fileName}` : null,
      nombreOriginal: src.name,
      url: src.url,
      descargado: Boolean(bytes),
      tipo: analysis?.documentType || src.type || null,
      tipoEs: a?.document_type?.specific_type_es || null,
      origen: analysis?.sourceLanguage || null,
      destino: analysis?.targetLanguage || null,
      palabras: analysis?.estimatedWords ?? src.words ?? null,
      paginas: analysis?.pageCount ?? null,
      apostilla: a?.document_type?.specific_type === "apostille" || /apostill/i.test(String(a?.document_type?.specific_type_es || "")) || null,
      pais: a?.country?.origin_name || null,
      autoridad: a?.country?.issuing_authority || null,
    });
  }

  // Entrega (si existe): mismo criterio que ve el cliente.
  const entregas = clientVisibleDeliveryFiles(order);
  const entregaMeta: string[] = [];
  if (entregas.length > 0) {
    const t = root.folder("traduccion")!;
    for (const [i, f] of entregas.entries()) {
      const bytes = await fetchBytes(f.url);
      if (!bytes) continue;
      const name = safeFileName(f.filename || `traduccion-${i + 1}${extFromUrl(f.url)}`, `traduccion-${i + 1}.pdf`);
      t.file(name, bytes);
      entregaMeta.push(`traduccion/${name}`);
    }
  }

  const winner = order.collaboratorAssignments[0] || null;
  const fecha = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  const especificaciones = [order.clientNotes, order.quote?.notesLegal].filter(Boolean).join("\n");
  const expediente = {
    version: EXPEDIENTE_VERSION,
    generado: new Date().toISOString(),
    generadoPor: staff.email,
    pedido: {
      referencia: order.reference,
      titulo: order.title,
      fecha: fecha(order.createdAt),
      origen: order.source,
      par: order.langPair,
      modalidad: order.deliveryType,
      plazo: fecha(order.dueDate),
      estado: order.status,
      estadoEntrega: order.deliveryState,
    },
    cliente: {
      nombre: order.clientName,
      email: order.clientEmail?.endsWith("@whatsapp.local") ? null : order.clientEmail,
      telefono: order.clientPhone || (order.clientEmail?.endsWith("@whatsapp.local") ? `+${order.clientEmail.split("@")[0]}` : null),
      idioma: order.clientLocale,
      titulares: order.quote?.holderNames || null,
      facturacion: order.billing
        ? { nombreFiscal: order.billing.fiscalName, nif: order.billing.nif, direccion: `${order.billing.address}, ${order.billing.postalCode} ${order.billing.city}, ${order.billing.country}` }
        : null,
      envioPapel: order.shipping
        ? { nombre: order.shipping.name, telefono: order.shipping.phone, direccion: `${order.shipping.address}, ${order.shipping.postalCode} ${order.shipping.city} (${order.shipping.province}), ${order.shipping.country}` }
        : null,
    },
    economia: {
      precioClienteConIva: eur(order.amountCents),
      precioClienteNeto: order.quote?.subtotal != null ? `${Number(order.quote.subtotal).toFixed(2).replace(".", ",")} €` : eur(Math.round(order.amountCents / 1.21)),
      iva: order.quote?.vatAmount != null ? `${Number(order.quote.vatAmount).toFixed(2).replace(".", ",")} €` : null,
      estadoPago: order.paymentStatus,
      metodoPago: order.paymentMethod,
      pagadoEl: fecha(order.paidAt),
      presupuesto: order.quote?.quoteNumber || null,
      factura: order.clientInvoice?.number || null,
      sinFactura: order.billingExcluded ? order.billingExcludedReason || true : false,
      costeTraductor: eur(order.supplierCostCents ?? winner?.quotedPriceCents ?? null),
      margenPct: order.marginPct,
    },
    traductor: winner
      ? { nombre: winner.collaborator.fullName, email: winner.collaborator.email, maec: winner.collaborator.swornNumber, aceptadoEl: fecha(winner.acceptedAt) }
      : { nombre: order.assignedTo || null },
    especificaciones: especificaciones || null,
    lineasPresupuesto: (order.quote?.lines || []).map((l) => ({ descripcion: l.description, precio: Number(l.unitPrice), coste: l.supplierUnitCost != null ? Number(l.supplierUnitCost) : null })),
    documentos: docsMeta,
    traduccion: entregaMeta,
    historial: order.events.map((e) => ({ fecha: e.createdAt.toISOString(), tipo: e.type, mensaje: e.message })),
  };

  const md = [
    `# Expediente ${order.reference}`,
    ``,
    `- **Fecha:** ${expediente.pedido.fecha} · **Par:** ${order.langPair || "—"} · **Modalidad:** ${order.deliveryType} · **Plazo:** ${expediente.pedido.plazo || "—"}`,
    `- **Estado:** ${order.status} · **Entrega:** ${order.deliveryState} · **Pago:** ${order.paymentStatus}${order.paymentMethod ? ` (${order.paymentMethod})` : ""}${expediente.economia.pagadoEl ? ` el ${expediente.economia.pagadoEl}` : ""}`,
    ``,
    `## Cliente`,
    `- ${order.clientName || "—"} · ${expediente.cliente.email || "sin email"} · ${expediente.cliente.telefono || "sin teléfono"}`,
    expediente.cliente.titulares ? `- Titulares del documento: ${expediente.cliente.titulares}` : null,
    order.billing ? `- Facturación: ${order.billing.fiscalName} · NIF ${order.billing.nif} · ${expediente.cliente.facturacion?.direccion}` : null,
    order.shipping ? `- Envío en papel: ${expediente.cliente.envioPapel?.nombre} · ${expediente.cliente.envioPapel?.direccion}` : null,
    ``,
    `## Economía`,
    `- Precio cliente: ${expediente.economia.precioClienteConIva} con IVA (neto ${expediente.economia.precioClienteNeto})`,
    `- Presupuesto ${expediente.economia.presupuesto || "—"} · Factura ${expediente.economia.factura || (order.billingExcluded ? "sin factura (" + (order.billingExcludedReason || "excluido") + ")" : "pendiente")}`,
    expediente.economia.costeTraductor ? `- Coste del traductor: ${expediente.economia.costeTraductor}${order.marginPct != null ? ` · margen ${order.marginPct} %` : ""}` : null,
    ``,
    `## Traductor`,
    `- ${winner ? `${winner.collaborator.fullName}${winner.collaborator.swornNumber ? ` (MAEC ${winner.collaborator.swornNumber})` : ""} · ${winner.collaborator.email}` : order.assignedTo || "sin asignar"}`,
    ``,
    especificaciones ? `## Especificaciones del cliente\n${especificaciones}\n` : null,
    `## Documentos (${docsMeta.length})`,
    ...docsMeta.map((d) =>
      `- ${d.fichero || "(no descargado)"} — ${d.tipoEs || d.tipo || "documento"}${d.origen ? ` · ${d.origen}→${d.destino}` : ""}${d.palabras ? ` · ${d.palabras} palabras` : ""}${d.paginas ? ` · ${d.paginas} págs` : ""}${d.apostilla ? " · apostilla" : ""}${d.pais ? ` · ${d.pais}` : ""}`
    ),
    ``,
    entregaMeta.length ? `## Traducción entregada\n${entregaMeta.map((f) => `- ${f}`).join("\n")}\n` : null,
    `## Historial`,
    ...order.events.slice(-40).map((e) => `- ${e.createdAt.toLocaleString("es-ES", { timeZone: "Europe/Madrid", dateStyle: "short", timeStyle: "short" })} · ${e.type}${e.message ? ` — ${e.message}` : ""}`),
    ``,
  ]
    .filter((l) => l !== null)
    .join("\n");

  root.file("expediente.md", md);
  root.file("expediente.json", JSON.stringify(expediente, null, 2));

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });

  if (opts.audit !== false) await prisma.orderEvent
    .create({
      data: {
        orderId: order.id,
        type: "expediente.downloaded",
        message: `Expediente descargado (${docsMeta.filter((d) => d.descargado).length}/${docsMeta.length} originales${entregaMeta.length ? `, ${entregaMeta.length} de traducción` : ""}) por ${staff.email}.`,
        payload: { by: staff.email, folder, bytes: buffer.length },
      },
    })
    .catch(() => {});

  return { folder, buffer, originales: docsMeta.length, descargados: docsMeta.filter((d) => d.descargado).length, traduccion: entregaMeta.length };
}
