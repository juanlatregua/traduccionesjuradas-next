// lib/payment-labels.ts — Etiquetas de pago (cuenta / Bizum a elegir).
// Módulo SIN dependencias (client-safe): fuente única usada por el PDF, el
// mensaje de WhatsApp del envío y el panel de detalle del presupuesto.

export const PAYMENT_LABELS: Record<string, string> = {
  bbva: "por transferencia a BBVA: ES66 0182 3370 67 0201616991 (BIC BBVAESMM)",
  openbank: "por transferencia a Openbank: ES33 0073 0100 5207 9242 5264 (BIC OPENESMM)",
  sabadell: "por transferencia a Banco Sabadell: ES47 0081 0240 1100 0378 7991 (BIC BSABESBB)",
  // bizum607 retirado (14-oct-2026): claves guardadas en presupuestos viejos muestran el 614.
  bizum607: "por Bizum al 614619682",
  bizum654: "por Bizum al 614619682",
  bizum: "por Bizum al 614619682",
  paypal: "por PayPal a hola@traduccionesjuradas.net",
  // Cuenta internacional (SWIFT): clientes fuera de España/UE.
  revolut:
    "por transferencia internacional a Revolut Bank UAB · IBAN ES32 1583 0001 1490 2264 2489 · BIC/SWIFT REVOESM2 · Beneficiario: Juan Antonio Silva Moreno",
};

// Datos estructurados por método, para la página pública /q/<token> (pestañas
// Bizum / Transferencia). Misma verdad que PAYMENT_LABELS y que el PDF
// (lib/quote-pdf.ts): la página enseñaba BBVA (en cierre) por constantes por
// defecto mientras el PDF decía Sabadell (26-ago, caso Lorna 2026-00092).
export type PaymentAccount =
  | { kind: "bizum"; phone: string }
  | { kind: "transfer"; bank: string; holder: string; iban: string; bic: string; holderAddress?: string; bankAddress?: string }
  | { kind: "paypal"; email: string };

// Direcciones para transferencias internacionales (SWIFT): el banco emisor las pide.
const HBTJ_ADDRESS = "Calle Esperanto 9, 29007 Málaga, España";
const JUAN_ADDRESS = "Eugenio Sellés 5, 29017 Málaga, España";

export const PAYMENT_ACCOUNTS: Record<string, PaymentAccount> = {
  bizum654: { kind: "bizum", phone: "614 619 682" },
  sabadell: { kind: "transfer", bank: "Banco Sabadell", holder: "HBTJ Consultores Lingüísticos S.L.", iban: "ES47 0081 0240 1100 0378 7991", bic: "BSABESBB", holderAddress: HBTJ_ADDRESS, bankAddress: "Avda. Óscar Esplá 37, 03007 Alicante, España" },
  bbva: { kind: "transfer", bank: "BBVA", holder: "HBTJ Consultores Lingüísticos S.L.", iban: "ES66 0182 3370 67 0201616991", bic: "BBVAESMM", holderAddress: HBTJ_ADDRESS, bankAddress: "Plaza de San Nicolás 4, 48005 Bilbao, España" },
  openbank: { kind: "transfer", bank: "Openbank", holder: "Juan Silva", iban: "ES33 0073 0100 5207 9242 5264", bic: "OPENESMM", holderAddress: JUAN_ADDRESS, bankAddress: "Paseo de la Castellana 24, 28046 Madrid, España" },
  revolut: { kind: "transfer", bank: "Revolut Bank UAB", holder: "Juan Antonio Silva Moreno", iban: "ES32 1583 0001 1490 2264 2489", bic: "REVOESM2", holderAddress: JUAN_ADDRESS, bankAddress: "Calle Príncipe de Vergara 132, 4ª planta, 28002 Madrid, España" },
  paypal: { kind: "paypal", email: "hola@traduccionesjuradas.net" },
};

/** "bizum" y el antiguo "bizum607" van al 614; descarta claves desconocidas. */
export function resolvePaymentAccounts(methods: string[] | null | undefined): { key: string; account: PaymentAccount }[] {
  const list = methods && methods.length ? methods : ["sabadell", "bizum654"];
  const keys = list.map((m) => (m === "bizum" || m === "bizum607" ? "bizum654" : m));
  return Array.from(new Set(keys))
    .filter((k) => PAYMENT_ACCOUNTS[k])
    .map((k) => ({ key: k, account: PAYMENT_ACCOUNTS[k] }));
}

// Solo las cuentas de la empresa confirman pedidos solas; Openbank y Revolut son
// personales de Juan (orden de Juan 21-sep-2026).
const COMPANY_TRANSFER_KEYS = ["sabadell", "bbva"] as const;

/** Últimas 4 cifras de las cuentas de la empresa (la misma fuente que ve el cliente). */
export function transferAccountsLast4(): string[] {
  return COMPANY_TRANSFER_KEYS.flatMap((k) => {
    const a = PAYMENT_ACCOUNTS[k];
    return a?.kind === "transfer" ? [a.iban.replace(/\s+/g, "").slice(-4)] : [];
  });
}
