export type CardProvider = "stripe" | "redsys";

function hasValue(value?: string | null) {
  return Boolean(String(value || "").trim());
}

export function isStripeConfigured() {
  return hasValue(process.env.STRIPE_SECRET_KEY);
}

export function isRedsysConfigured() {
  return hasValue(process.env.REDSYS_SECRET_KEY) && hasValue(process.env.REDSYS_MERCHANT_CODE);
}

export function isPayPalConfigured() {
  return (
    hasValue(process.env.PAYPAL_CLIENT_ID) &&
    hasValue(process.env.PAYPAL_CLIENT_SECRET) &&
    hasValue(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID)
  );
}

export function isBlobConfigured() {
  return hasValue(process.env.BLOB_READ_WRITE_TOKEN);
}

export function resolveCardProvider(preferredRaw?: string | null): CardProvider | null {
  const preferred = String(preferredRaw || process.env.CARD_PROVIDER || "stripe")
    .trim()
    .toLowerCase();

  const stripe = isStripeConfigured();
  const redsys = isRedsysConfigured();

  if (preferred === "redsys") {
    if (redsys) return "redsys";
    if (stripe) return "stripe";
    return null;
  }

  if (stripe) return "stripe";
  if (redsys) return "redsys";
  return null;
}

export function getPaymentCapabilities() {
  const cardProvider = resolveCardProvider();
  return {
    cardEnabled: !!cardProvider,
    cardProvider,
    paypalEnabled: isPayPalConfigured(),
    manualProofUploadEnabled: isBlobConfigured(),
  };
}
