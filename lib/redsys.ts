import {
  createRedsysAPI,
  SANDBOX_URLS,
  PRODUCTION_URLS,
  CURRENCIES,
  TRANSACTION_TYPES,
  LANGUAGES,
} from "redsys-easy";

function getRedsysAPI() {
  const secretKey = process.env.REDSYS_SECRET_KEY;
  if (!secretKey) throw new Error("REDSYS_SECRET_KEY no configurado.");

  const isProduction = process.env.REDSYS_ENV === "production";
  return createRedsysAPI({
    secretKey,
    urls: isProduction ? PRODUCTION_URLS : SANDBOX_URLS,
  });
}

/**
 * Generate Redsys redirect form parameters for a payment.
 * The frontend auto-submits these to the Redsys payment page.
 */
export function buildRedsysFormData(opts: {
  orderReference: string;
  amountCents: number;
  notificationUrl: string;
  successUrl: string;
  cancelUrl: string;
  locale?: string | null;
}) {
  const merchantCode = process.env.REDSYS_MERCHANT_CODE || "";
  const terminal = process.env.REDSYS_TERMINAL || "1";
  const isProduction = process.env.REDSYS_ENV === "production";

  const { createRedirectForm } = getRedsysAPI();

  // Redsys order must be 4-12 alphanumeric and the first 4 chars must be numeric.
  const cleaned = opts.orderReference.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const onlyDigits = cleaned.replace(/\D/g, "");
  const numericPrefix = (onlyDigits + "0000").slice(0, 4);
  const tail = cleaned.slice(-8);
  const dsOrder = `${numericPrefix}${tail}`.slice(0, 12);

  const form = createRedirectForm({
    DS_MERCHANT_MERCHANTCODE: merchantCode,
    DS_MERCHANT_TERMINAL: terminal,
    DS_MERCHANT_TRANSACTIONTYPE: TRANSACTION_TYPES.AUTHORIZATION,
    DS_MERCHANT_ORDER: dsOrder,
    DS_MERCHANT_AMOUNT: String(opts.amountCents),
    DS_MERCHANT_CURRENCY: CURRENCIES.EUR.num,
    DS_MERCHANT_MERCHANTNAME: "Traducciones Juradas",
    DS_MERCHANT_MERCHANTURL: opts.notificationUrl,
    DS_MERCHANT_URLOK: opts.successUrl,
    DS_MERCHANT_URLKO: opts.cancelUrl,
    DS_MERCHANT_CONSUMERLANGUAGE: opts.locale === "fr" ? LANGUAGES.fr : LANGUAGES.es,
    DS_MERCHANT_MERCHANTDATA: opts.orderReference,
  });

  const redsysUrl = isProduction
    ? "https://sis.redsys.es/sis/realizarPago"
    : "https://sis-t.redsys.es:25443/sis/realizarPago";

  return {
    url: redsysUrl,
    Ds_SignatureVersion: form.body.Ds_SignatureVersion,
    Ds_MerchantParameters: form.body.Ds_MerchantParameters,
    Ds_Signature: form.body.Ds_Signature,
  };
}

/**
 * Verify and decode a Redsys notification (webhook).
 * Returns decoded parameters or throws on invalid signature.
 */
export function verifyRedsysNotification(body: {
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
}) {
  const { processRestNotification } = getRedsysAPI();
  return processRestNotification(body);
}
