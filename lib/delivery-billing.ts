// Reglas puras del panel «Entregar al cliente»: factura simplificada o completa,
// datos fiscales por defecto, destinatario de una factura emitida y estado que
// se enseña al staff. Sin Prisma: se prueba con node --test.

export const SIMPLIFIED_MAX_CENTS = 40000;

export type BillingFields = {
  fiscalName: string;
  nif: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
};

type Loose = Partial<Record<keyof BillingFields, string | null>> | null | undefined;

// Sin NIF y hasta 400 € (venta web a particular): simplificada, no una completa con NIF en blanco.
export function isSimplifiedInvoice(nif: string | null | undefined, amountCents: number): boolean {
  return !(nif || "").trim() && amountCents <= SIMPLIFIED_MAX_CENTS;
}

function clean(v: string | null | undefined): string {
  return (v || "").trim();
}

function fromSource(src: Loose, fallbackEmail: string): BillingFields | null {
  if (!src || !clean(src.fiscalName)) return null;
  return {
    fiscalName: clean(src.fiscalName),
    nif: clean(src.nif),
    address: clean(src.address),
    city: clean(src.city),
    postalCode: clean(src.postalCode),
    country: clean(src.country) || "España",
    email: clean(src.email) || fallbackEmail,
  };
}

// BillingData del pedido > ficha del Customer > nombre del pedido.
export function resolveBillingPrefill(input: {
  billing?: Loose;
  customer?: (NonNullable<Loose> & { companyName?: string | null }) | null;
  clientName?: string | null;
  clientEmail: string;
}): BillingFields {
  const email = clean(input.clientEmail);
  const fromBilling = fromSource(input.billing, email);
  if (fromBilling) return fromBilling;
  const c = input.customer;
  const fromCustomer = c ? fromSource({ ...c, fiscalName: clean(c.fiscalName) || clean(c.companyName) }, email) : null;
  if (fromCustomer) return fromCustomer;
  return {
    fiscalName: clean(input.clientName),
    nif: "",
    address: "",
    city: "",
    postalCode: "",
    country: "España",
    email,
  };
}

const RECIPIENT_KEYS = ["fiscalName", "nif", "address", "city", "postalCode", "country"] as const;

function norm(v: string | null | undefined): string {
  return clean(v).toLowerCase().replace(/\s+/g, " ");
}

export function recipientDiffers(invoice: Loose, billing: BillingFields): boolean {
  return RECIPIENT_KEYS.some((k) => norm(invoice?.[k]) !== norm(billing[k]));
}

// ¿Salió ya la factura emitida al cliente? Se mira si hubo un envío de entrega
// o cualquier aviso al cliente (notification.*.sent) DESPUÉS de emitirla (los envíos antiguos no
// guardaban qué adjuntaron: ante la duda, enviada).
export function invoiceWasSent(
  events: { type: string; createdAt: Date | string }[],
  issuedAt: Date | string | null | undefined
): boolean {
  if (!issuedAt) return false;
  const since = new Date(issuedAt).getTime();
  return events.some((e) => /^notification\..+\.sent$/.test(e.type) && new Date(e.createdAt).getTime() >= since);
}

export const RECIPIENT_CORRECTION_WINDOW_MS = 72 * 60 * 60 * 1000;

// Corregir el destinatario de una emitida solo vale en sus primeras 72 h.
export function isRecentlyIssued(issuedAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!issuedAt) return false;
  return now.getTime() - new Date(issuedAt).getTime() < RECIPIENT_CORRECTION_WINDOW_MS;
}

export type InvoiceStatus =
  | { kind: "excluded"; reason: string }
  | { kind: "monthly" }
  | { kind: "quote" }
  | { kind: "draft" }
  | { kind: "annulled" }
  | { kind: "zero" }
  | { kind: "bizum" }
  | { kind: "issued"; number: string }
  | { kind: "will_issue"; simplified: boolean };

export function invoiceStatusOf(input: {
  billingExcluded: boolean;
  billingExcludedReason?: string | null;
  hasMonthlyInvoice: boolean;
  invoice?: { number: string | null; status: string; docKind: string; annulledAt?: unknown } | null;
  paymentMethod?: string | null;
  nif: string;
  amountCents: number;
}): InvoiceStatus {
  const inv = input.invoice;
  if (inv && inv.status === "ISSUED" && inv.number && inv.docKind === "invoice" && !inv.annulledAt) {
    return { kind: "issued", number: inv.number };
  }
  if (input.billingExcluded) return { kind: "excluded", reason: input.billingExcludedReason || "sin motivo" };
  if (input.hasMonthlyInvoice) return { kind: "monthly" };
  switch (decideInvoiceAction({ existing: inv, amountCents: input.amountCents, paymentMethod: input.paymentMethod })) {
    case "quote":
      return { kind: "quote" };
    case "draft":
      return { kind: "draft" };
    case "annulled":
      return { kind: "annulled" };
    case "zero":
      return { kind: "zero" };
    case "bizum":
      return { kind: "bizum" };
    default:
      return { kind: "will_issue", simplified: isSimplifiedInvoice(input.nif, input.amountCents) };
  }
}

export function invoiceStatusLabel(s: InvoiceStatus): string {
  switch (s.kind) {
    case "issued":
      return `Factura ${s.number} emitida: se adjunta`;
    case "excluded":
      return `Excluido de facturación (${s.reason}): se envía sin factura`;
    case "monthly":
      return "Factura agrupada del mes: se envía sin factura";
    case "quote":
      return "Hay un presupuesto vinculado: se envía sin factura (emítela desde Facturas)";
    case "draft":
      return "Hay un borrador en Facturas: se envía sin factura";
    case "annulled":
      return "Factura anulada: se envía sin factura";
    case "zero":
      return "Pedido de 0 €: se envía sin factura";
    case "bizum":
      return "Pago Bizum: se envía sin factura";
    case "will_issue":
      return `Se emitirá al enviar (${s.simplified ? "simplificada" : "completa"})`;
  }
}

export type InvoiceAction = "issue" | "existing" | "draft" | "annulled" | "quote" | "zero" | "bizum";

// Qué hace el panel con la factura del pedido: solo emite si NO hay ninguna.
export function decideInvoiceAction(input: {
  existing?: { status: string; docKind: string; annulledAt?: unknown } | null;
  amountCents: number;
  paymentMethod?: string | null;
}): InvoiceAction {
  const e = input.existing;
  if (e) {
    if (e.docKind === "quote") return "quote";
    if (e.annulledAt) return "annulled";
    return e.status === "ISSUED" ? "existing" : "draft";
  }
  if (input.amountCents <= 0) return "zero";
  if (input.paymentMethod === "BIZUM") return "bizum";
  return "issue";
}

// Motivo por el que no se puede corregir el destinatario de una emitida (null = se puede).
export function recipientLockReasonOf(f: {
  annulled: boolean;
  issuedAt: Date | string | null | undefined;
  hasRectification: boolean;
  periodClosed: boolean;
  recordSendStatus?: string | null;
  sentToClient: boolean;
  now?: Date;
}): string | null {
  if (f.annulled) return "está anulada";
  if (!isRecentlyIssued(f.issuedAt, f.now)) return "se emitió hace más de 72 h";
  if (f.hasRectification) return "tiene una rectificativa";
  if (f.periodClosed) return "su trimestre ya está cerrado";
  if (f.recordSendStatus && f.recordSendStatus !== "LOCAL") return "ya se registró ante Hacienda";
  if (f.sentToClient) return "ya se envió al cliente";
  return null;
}
