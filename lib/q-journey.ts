// Reglas puras del recorrido guiado de /q: documentos que faltan, datos de
// facturación antes de pagar y su prefill. Sin Prisma: se prueba con node --test.

import { needsNif, resolveBillingPrefill, type BillingFields } from "./delivery-billing.ts";

/* ------------------------------ documentos que faltan ------------------------------ */

export const COMPLETION_MAX_FILES = 10;
export const COMPLETION_MAX_BYTES = 20 * 1024 * 1024; // = tope de la puerta (/api/documents/upload)
export const COMPLETION_EXTS = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "tif", "tiff"];
export const COMPLETION_NOTE_MAX = 1000;
// 5 envíos por enlace e IP cada 10 minutos: un cliente real envía una o dos veces.
export const COMPLETION_RATE = { limit: 5, windowMs: 10 * 60 * 1000 } as const;
export const BILLING_RATE = { limit: 20, windowMs: 10 * 60 * 1000 } as const;

export const COMPLETION_EVENT = "client.docs_added";
export const BILLING_EVENT = "client.billing_data";

// Topes por presupuesto (además del rate limit por IP, que se esquiva rotando IP).
export const COMPLETION_MAX_SUBMITS_PER_DAY = 3;
export const COMPLETION_MAX_TOTAL_FILES = 10;

/** Host público de NUESTRA tienda de Blob: vercel_blob_rw_<storeId>_<secreto> → <storeid>.public.blob.vercel-storage.com. */
export function blobHostFromToken(token: string | null | undefined): string | null {
  const m = /^vercel_blob_rw_([A-Za-z0-9]+)_/.exec((token || "").trim());
  return m ? `${m[1].toLowerCase()}.public.blob.vercel-storage.com` : null;
}

export type CompletionBlock = "deleted" | "expired" | "status" | "paid";

/** ¿Puede este presupuesto recibir documentos? Solo uno vivo, vigente, pagable y sin pagar. */
export function completionBlockReason(
  q: { deletedAt?: Date | null; validUntil: Date; status: string; paidAt?: Date | null },
  now = new Date()
): CompletionBlock | null {
  if (q.deletedAt) return "deleted";
  if (q.paidAt || ["PAID", "IN_PROGRESS", "DELIVERED"].includes(q.status)) return "paid";
  if (q.validUntil.getTime() < now.getTime()) return "expired";
  if (!["SENT", "OPENED", "ACCEPTED"].includes(q.status)) return "status";
  return null;
}

/** Tope por presupuesto: 3 envíos «Falta algo» al día y 10 archivos en total. */
export function completionQuota(
  past: { at: Date; fileCount: number }[],
  newFiles: number,
  now = new Date()
): "daily" | "total" | null {
  const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
  if (past.filter((e) => e.at.getTime() > dayAgo).length >= COMPLETION_MAX_SUBMITS_PER_DAY) return "daily";
  if (past.reduce((n, e) => n + e.fileCount, 0) + newFiles > COMPLETION_MAX_TOTAL_FILES) return "total";
  return null;
}

/** Datos fiscales: tras el pago, o con pedido o factura emitida viva, solo los toca el staff. */
// Un pedido SIN datos fiscales y sin pagar (p. ej. «Ya he transferido», crédito) los acepta.
export function billingLocked(q: {
  paidAt?: Date | null;
  orderPaidAt?: Date | null;
  orderHasBilling: boolean;
  invoiceIssued: boolean;
}): boolean {
  return !!q.paidAt || !!q.orderPaidAt || q.orderHasBilling || q.invoiceIssued;
}

export const completionBlobPrefix = (quoteId: string) => `quotes-complementos/${quoteId}/`;

function extOf(name: string): string {
  return (name.split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
}

export type CompletionError = "none" | "count" | "type" | "size";

export function validateCompletionFiles(
  files: { name: string; size: number }[]
): { ok: true } | { ok: false; code: CompletionError } {
  if (files.length === 0) return { ok: false, code: "none" };
  if (files.length > COMPLETION_MAX_FILES) return { ok: false, code: "count" };
  for (const f of files) {
    if (!COMPLETION_EXTS.includes(extOf(f.name))) return { ok: false, code: "type" };
    if (!(f.size > 0) || f.size > COMPLETION_MAX_BYTES) return { ok: false, code: "size" };
  }
  return { ok: true };
}

export type CompletionFile = { url: string; name: string; size: number };

// Lo que llega del navegador son URLs de Blob que él mismo subió: solo valen las
// del almacén público de Vercel Blob bajo la carpeta de ESTE presupuesto (el
// token de subida ya fija carpeta, tipos y 20 MB; esto impide colar URLs ajenas).
export function parseCompletionFiles(
  raw: unknown,
  quoteId: string,
  host: string | null = null
): { ok: true; files: CompletionFile[] } | { ok: false; code: CompletionError | "url" } {
  if (!Array.isArray(raw)) return { ok: false, code: "none" };
  const files: CompletionFile[] = [];
  const pathnames: string[] = [];
  for (const item of raw) {
    const url = String((item as any)?.url || "");
    const name = String((item as any)?.name || "").trim().slice(0, 160);
    const size = Number((item as any)?.size);
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return { ok: false, code: "url" };
    }
    const hostOk = host ? u.hostname.toLowerCase() === host : u.hostname.endsWith(".public.blob.vercel-storage.com");
    if (u.protocol !== "https:" || !hostOk) {
      return { ok: false, code: "url" };
    }
    if (!decodeURIComponent(u.pathname).startsWith(`/${completionBlobPrefix(quoteId)}`)) {
      return { ok: false, code: "url" };
    }
    files.push({ url, name: name || decodeURIComponent(u.pathname.split("/").pop() || "documento"), size });
    pathnames.push(u.pathname);
  }
  // El tipo se valida por la extensión de la URL guardada, no por el nombre que declara el navegador.
  const check = validateCompletionFiles(files.map((f, i) => ({ name: pathnames[i], size: f.size })));
  if (!check.ok) return check;
  return { ok: true, files };
}

// «Pendiente de completar»: el cliente añadió documentos y desde entonces no se
// ha vuelto a enviar el presupuesto (PAY_LINK / RESEND_PAY_LINK del MessageLog).
export function isPendingCompletion(
  eventAt: (Date | null | undefined)[],
  lastSentAt: Date | null | undefined
): boolean {
  const latest = eventAt.filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
  if (!latest) return false;
  return !lastSentAt || latest.getTime() > lastSentAt.getTime();
}

/* ------------------------------ datos de facturación ------------------------------ */

export type BillingForm = Omit<BillingFields, "email">;
export type BillingSource = "saved" | "billing" | "customer" | "document" | "empty";

export const EMPTY_BILLING: BillingForm = {
  fiscalName: "",
  nif: "",
  address: "",
  city: "",
  postalCode: "",
  country: "España",
};

export const isWhatsappPlaceholder = (email: string | null | undefined) => /@whatsapp\.local$/i.test((email || "").trim());

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function pieces(s: string): { address: string; postalCode: string; city: string } {
  // «Calle Mayor 3, 29001 Málaga»: separa CP (5 cifras) y ciudad si vienen así.
  const m = s.match(/^(.*?)[,\s]+(\d{5})\s+([^,\d][^,]*)$/);
  return m ? { address: m[1].trim().replace(/,$/, ""), postalCode: m[2], city: m[3].trim() } : { address: s, postalCode: "", city: "" };
}

// Lo que los análisis de sus documentos dicen del cliente: el primer nombre y,
// si el análisis trae direcciones (campo opcional), la primera.
export function billingFromAnalyses(analyses: unknown[]): Partial<BillingForm> | null {
  let name = "";
  let addr: Partial<BillingForm> = {};
  for (const a of analyses) {
    const data = (a as any)?.extracted_data;
    if (!data || typeof data !== "object") continue;
    if (!name) {
      const first = Array.isArray(data.names) ? data.names.map((n: unknown) => clean(n, 120)).find(Boolean) : "";
      if (first) name = first;
    }
    if (!addr.address) {
      const list = Array.isArray(data.addresses) ? data.addresses : data.address ? [data.address] : [];
      for (const raw of list) {
        if (typeof raw === "string" && clean(raw)) {
          addr = pieces(clean(raw));
          break;
        }
        if (raw && typeof raw === "object") {
          const o = raw as Record<string, unknown>;
          const street = clean(o.street) || clean(o.address) || clean(o.line1);
          if (street) {
            addr = { address: street, postalCode: clean(o.postalCode, 12) || clean(o.zip, 12), city: clean(o.city, 80), country: clean(o.country, 80) || undefined };
            break;
          }
        }
      }
    }
  }
  if (!name && !addr.address) return null;
  return { fiscalName: name, ...addr };
}

type Loose = Partial<Record<keyof BillingFields, string | null>> | null | undefined;

// BillingData del pedido > Customer (por email, nunca el marcador de WhatsApp)
// > datos leídos de sus documentos > vacío. `saved` (lo que ya guardó aquí) manda sobre todo.
// Lo leído de los documentos NO se propone como nombre fiscal: va aparte, como
// sugerencia que el cliente acepta con un clic. Campo vacío por defecto.
export function pickBillingPrefill(input: {
  saved?: Partial<BillingForm> | null;
  orderBilling?: Loose;
  customer?: (NonNullable<Loose> & { companyName?: string | null }) | null;
  clientEmail: string;
  analyses?: unknown[];
}): { fields: BillingForm; source: BillingSource; suggestion: Partial<BillingForm> | null } {
  const email = (input.clientEmail || "").trim();
  const strip = (f: BillingFields): BillingForm => ({
    fiscalName: f.fiscalName,
    nif: f.nif,
    address: f.address,
    city: f.city,
    postalCode: f.postalCode,
    country: f.country,
  });
  if (input.saved && clean(input.saved.fiscalName)) {
    return { fields: { ...EMPTY_BILLING, ...input.saved }, source: "saved", suggestion: null };
  }
  const fromOrder = resolveBillingPrefill({ billing: input.orderBilling, customer: null, clientName: null, clientEmail: email });
  if (fromOrder.fiscalName) return { fields: strip(fromOrder), source: "billing", suggestion: null };
  const useCustomer = !!input.customer && !isWhatsappPlaceholder(email);
  const fromCustomer = resolveBillingPrefill({
    billing: null,
    customer: useCustomer ? input.customer : null,
    clientName: null,
    clientEmail: email,
  });
  if (fromCustomer.fiscalName) return { fields: strip(fromCustomer), source: "customer", suggestion: null };
  const fromDoc = billingFromAnalyses(input.analyses || []);
  return { fields: { ...EMPTY_BILLING }, source: fromDoc ? "document" : "empty", suggestion: fromDoc };
}

export type BillingError = "name" | "nif_required" | "address";

// Sin NIF y ≤400 €: simplificada (basta el nombre). >400 € exige NIF; con NIF la
// factura es completa y necesita dirección, CP y ciudad.
export function validateBilling(
  input: Partial<Record<keyof BillingForm, unknown>>,
  totalCents: number
): { ok: true; value: BillingForm } | { ok: false; code: BillingError } {
  const value: BillingForm = {
    fiscalName: clean(input.fiscalName, 160),
    nif: clean(input.nif, 32).toUpperCase(),
    address: clean(input.address, 200),
    city: clean(input.city, 100),
    postalCode: clean(input.postalCode, 16),
    country: clean(input.country, 80) || "España",
  };
  if (!value.fiscalName) return { ok: false, code: "name" };
  if (needsNif(value.nif, totalCents)) return { ok: false, code: "nif_required" };
  if (value.nif && (!value.address || !value.city || !value.postalCode)) return { ok: false, code: "address" };
  return { ok: true, value };
}

/* ------------------------------ fase de pago de /q ------------------------------ */

export type PayPhase = "open" | "confirming" | "partial" | "paid";

// «Pagado» solo con paidAt. ?paid=1 sin paidAt es que el webhook aún no ha llegado;
// con dos plazos, el primero cobrado y el segundo pendiente no es «Pagado».
export function payPhase(input: { paidAt: Date | null; paidParam: boolean; balance: number; balancePaidAt: Date | null }): PayPhase {
  if (input.paidAt) return input.balance > 0 && !input.balancePaidAt ? "partial" : "paid";
  return input.paidParam ? "confirming" : "open";
}
