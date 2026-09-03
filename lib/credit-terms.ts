// lib/credit-terms.ts — Fuente ÚNICA del carril de COBRO APLAZADO.
//
// El problema que resuelve: hasta hoy un pedido solo nacía cuando entraba el
// dinero (mark-paid es el único camino que llama al puente presupuesto→pedido).
// Con clientes empresa —INVERSIONES KARSENTY, Auream, L'Agence— eso es al revés
// de como funciona el trabajo: aprueban, se traduce, se entrega y pagan después.
// Juan no podía ni subir la traducción.
//
// Decisiones de Juan (2-sep-2026), que son las que dan forma a este módulo:
//   · "se puede entregar y trabajar con determinados clientes" → el permiso vive
//     en el CLIENTE (Customer.creditEnabled), no en el pedido ni en un flag suelto.
//   · "no hay tope de pedido, siempre es en mis trabajos" → sin límite de importe.
//     El carril es para trabajos propios, así que no hay coste de traductor
//     externo que adelantar: el riesgo es el margen, no la caja.
//   · "se conciliará a mano" → el cobro no se casa solo; ver isWithinFiscalQuarter.
//
// La MARCA del carril NO es un booleano en Order: es la propia factura. Una
// ClientInvoice ISSUED con dueDate significa "Juan lo autorizó, el derecho de
// cobro existe, está numerado y ya está declarado". Lo protege la serie fiscal.
// Un flag se copia por ahí; una factura numerada, no.
//
// Módulo PURO a propósito (sin Prisma, sin fetch): así se prueba entero con
// node --test y las reglas del dinero no dependen de tener base de datos.

// Campos opcionales a propósito: a este predicado le llegan facturas de selects
// distintos (la página del pedido, el zip del expediente, el vigía…). Si falta
// dueDate, la respuesta correcta es "no autoriza" — nunca un error de tipos que
// obligue a tocar cada consulta del repo.
export type CreditInvoice = {
  status?: string | null;
  docKind?: string | null;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
};

export type CreditCustomer = {
  creditEnabled?: boolean | null;
  creditDays?: number | null;
};

/** Campos mínimos a pedir en el select cuando se vaya a evaluar el carril. */
export const CREDIT_INVOICE_SELECT = {
  id: true,
  number: true,
  status: true,
  docKind: true,
  issuedAt: true,
  dueDate: true,
  paidAt: true,
} as const;

const toDate = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * ¿Esta factura autoriza el carril de crédito?
 * Exige las tres cosas a la vez, y el orden importa para el caso real: hay 27
 * facturas ISSUED sin cobrar en producción y NINGUNA tiene dueDate, así que el
 * carril las deja fuera por construcción — no hay que sanearlas antes.
 */
export function isCreditAuthorized(inv: CreditInvoice | null | undefined): boolean {
  if (!inv) return false;
  if (inv.status !== "ISSUED") return false;
  if (inv.docKind !== "invoice") return false; // un presupuesto de la serie AA_NNN no autoriza nada
  return toDate(inv.dueDate) !== null;
}

/** Autorizada y todavía sin cobrar: lo que el vigía tiene que perseguir. */
export function isCreditOutstanding(inv: CreditInvoice | null | undefined): boolean {
  return isCreditAuthorized(inv) && toDate(inv?.paidAt ?? null) === null;
}

/** Días que faltan para el vencimiento. Negativo = vencida. null si no aplica. */
export function creditDaysToDue(
  inv: CreditInvoice | null | undefined,
  now: Date
): number | null {
  const due = toDate(inv?.dueDate ?? null);
  if (!due || !isCreditAuthorized(inv)) return null;
  const d0 = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const n0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((d0 - n0) / 86_400_000);
}

/** Vencida y sin cobrar. */
export function isCreditOverdue(inv: CreditInvoice | null | undefined, now: Date): boolean {
  if (!isCreditOutstanding(inv)) return false;
  const d = creditDaysToDue(inv, now);
  return d !== null && d < 0;
}

/**
 * "Asegurado" ≠ "cobrado". Es la única palabra nueva del carril y significa: el
 * derecho de cobro existe, está numerado y ya está declarado en el 303.
 * Es lo que permite TRABAJAR y ENTREGAR sin haber cobrado.
 */
export function isOrderSecured(order: {
  paymentStatus?: string | null;
  clientInvoice?: CreditInvoice | null;
}): boolean {
  if (order.paymentStatus === "PAID") return true;
  return isCreditAuthorized(order.clientInvoice ?? null);
}

/** ¿Puede este cliente comprar a crédito? El permiso es suyo, no del pedido. */
export function customerCanUseCredit(c: CreditCustomer | null | undefined): boolean {
  return Boolean(c?.creditEnabled);
}

/** Vencimiento por defecto a partir de los días pactados con ese cliente. */
export function defaultDueDate(c: CreditCustomer | null | undefined, from: Date): Date {
  const days = Number.isFinite(Number(c?.creditDays)) ? Number(c?.creditDays) : 30;
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + Math.max(1, Math.min(90, days)));
  return d;
}

/** Trimestre fiscal (1-4) de una fecha. */
export function fiscalQuarter(d: Date): number {
  return Math.floor(d.getUTCMonth() / 3) + 1;
}

/**
 * ¿Caen emisión y cobro en el MISMO trimestre fiscal?
 *
 * Orden de Juan (2-sep-2026): "se conciliará a mano entonces, pero debería poder
 * hacerse siempre y cuando estemos en el 3T". La conciliación automática de
 * lib/bank-reconcile.ts usa una ventana de 7 días desde la emisión, así que un
 * cobro a 30 días NO casa nunca solo. Para el vínculo MANUAL la ventana deja de
 * ser de días y pasa a ser el trimestre: mientras el ingreso y la factura estén
 * en el mismo trimestre, se puede casar sin discutir con el calendario. Fuera de
 * ahí se avisa, porque cruzar trimestres sí tiene consecuencia en el 303.
 */
export function isWithinFiscalQuarter(issuedAt: Date | string | null, when: Date | string | null): boolean {
  const a = toDate(issuedAt);
  const b = toDate(when);
  if (!a || !b) return false;
  return a.getUTCFullYear() === b.getUTCFullYear() && fiscalQuarter(a) === fiscalQuarter(b);
}

/**
 * Motivo por el que NO se puede autorizar crédito a este cliente, o null si se
 * puede. Vive aquí (puro) para que la ficha del presupuesto, la del pedido y
 * el endpoint digan EXACTAMENTE lo mismo y se pruebe sin base de datos.
 *
 * Orden de las comprobaciones = orden en que Juan lo arregla: primero el
 * permiso (un clic en la ficha), luego los datos fiscales (sin NIF la factura
 * sale simplificada y a una empresa no le sirve), y por último el país (fuera
 * de España el IVA puede no ser el 21 % que issueOrUpdateInvoice fija a fuego).
 */
export type CreditCustomerProfile = CreditCustomer & {
  name?: string | null;
  email?: string | null;
  fiscalName?: string | null;
  nif?: string | null;
  country?: string | null;
};

const SPAIN = new Set(["españa", "espana", "spain", "es"]);

export function isSpainCountry(country: string | null | undefined): boolean {
  const c = String(country ?? "").trim().toLowerCase();
  return c === "" || SPAIN.has(c);
}

export function customerCreditBlocker(c: CreditCustomerProfile | null | undefined): string | null {
  if (!c) return "No hay ficha de cliente: créala antes de autorizar.";
  const who = String(c.name || c.email || "el cliente").trim();
  if (!customerCanUseCredit(c)) {
    return `${who} no está marcado como cliente de crédito. Actívalo en su ficha si quieres trabajar y entregar antes de cobrar.`;
  }
  if (!String(c.fiscalName || "").trim() || !String(c.nif || "").trim()) {
    return `La ficha de ${who} no tiene razón social o NIF. Rellénalos antes de autorizar: sin NIF la factura sale simplificada y no le sirve.`;
  }
  if (!isSpainCountry(c.country)) {
    return `El cliente es de ${String(c.country).trim()}: esta factura puede no ser al 21 %. Emítela a mano en /zona-traductor/facturas con el tipo correcto y vuelve a autorizar.`;
  }
  return null;
}
