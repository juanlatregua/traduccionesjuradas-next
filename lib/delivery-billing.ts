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
// o un mensaje al cliente DESPUÉS de emitirla (los envíos antiguos no
// guardaban qué adjuntaron: ante la duda, enviada).
export function invoiceWasSent(
  events: { type: string; createdAt: Date | string }[],
  issuedAt: Date | string | null | undefined
): boolean {
  if (!issuedAt) return false;
  const since = new Date(issuedAt).getTime();
  return events.some(
    (e) =>
      (e.type === "notification.delivery_ready.sent" || e.type === "notification.custom.sent") &&
      new Date(e.createdAt).getTime() >= since
  );
}

export type InvoiceStatus =
  | { kind: "excluded"; reason: string }
  | { kind: "monthly" }
  | { kind: "quote" }
  | { kind: "issued"; number: string }
  | { kind: "will_issue"; simplified: boolean };

export function invoiceStatusOf(input: {
  billingExcluded: boolean;
  billingExcludedReason?: string | null;
  hasMonthlyInvoice: boolean;
  invoice?: { number: string | null; status: string; docKind: string } | null;
  nif: string;
  amountCents: number;
}): InvoiceStatus {
  const inv = input.invoice;
  if (inv && inv.status === "ISSUED" && inv.number && inv.docKind === "invoice") {
    return { kind: "issued", number: inv.number };
  }
  if (input.billingExcluded) return { kind: "excluded", reason: input.billingExcludedReason || "sin motivo" };
  if (input.hasMonthlyInvoice) return { kind: "monthly" };
  if (inv?.docKind === "quote") return { kind: "quote" };
  return { kind: "will_issue", simplified: isSimplifiedInvoice(input.nif, input.amountCents) };
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
    case "will_issue":
      return `Se emitirá al enviar (${s.simplified ? "simplificada" : "completa"})`;
  }
}
