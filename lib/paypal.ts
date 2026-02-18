const clientId = process.env.PAYPAL_CLIENT_ID || "";
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || "";
const isProduction = process.env.PAYPAL_ENV === "production";

const BASE_URL = isProduction
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`PayPal auth failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

/**
 * Create a PayPal order for the given amount.
 * Returns the PayPal order ID for the frontend to approve.
 */
export async function createPayPalOrder(opts: {
  orderReference: string;
  amountEur: string; // e.g. "50.00"
  description: string;
}) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: opts.orderReference,
          description: opts.description.slice(0, 127),
          amount: {
            currency_code: "EUR",
            value: opts.amountEur,
          },
        },
      ],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal create order failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as { id: string; status: string };
  return data;
}

/**
 * Capture a previously approved PayPal order.
 * Returns capture details.
 */
export async function capturePayPalOrder(paypalOrderId: string) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PayPal capture failed: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    id: string;
    status: string;
    purchase_units?: Array<{
      reference_id?: string;
      payments?: {
        captures?: Array<{ id: string; status: string }>;
      };
    }>;
  };

  return data;
}
