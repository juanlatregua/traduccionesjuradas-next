import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CheckoutBody = {
  amount?: number;
  currency?: string;
  title?: string;
  source?: "preset" | "file";
  langPair?: string;
  words?: number;
  pagesLabel?: string;
};

function toUnitAmount(amount: number) {
  return Math.round(amount * 100);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody;
    const amount = Number(body?.amount || 0);
    const unitAmount = toUnitAmount(amount);

    if (!Number.isFinite(amount) || unitAmount < 1000) {
      return NextResponse.json(
        { ok: false, error: "Importe inválido. El mínimo es 10 EUR." },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pago no disponible temporalmente. Falta configurar STRIPE_SECRET_KEY.",
        },
        { status: 500 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      new URL(req.url).origin;

    const title = (body.title || "Pedido de traducción jurada").slice(0, 120);
    const details = [
      body.langPair ? `Combinación: ${body.langPair}` : "",
      body.pagesLabel ? `Alcance: ${body.pagesLabel}` : "",
      typeof body.words === "number" ? `Palabras: ${body.words}` : "",
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 490);

    const payload = new URLSearchParams();
    payload.set("mode", "payment");
    payload.set("success_url", `${origin}/pago/exito?session_id={CHECKOUT_SESSION_ID}`);
    payload.set("cancel_url", `${origin}/pago/cancelado`);
    payload.set("line_items[0][quantity]", "1");
    payload.set("line_items[0][price_data][currency]", (body.currency || "eur").toLowerCase());
    payload.set("line_items[0][price_data][unit_amount]", String(unitAmount));
    payload.set("line_items[0][price_data][product_data][name]", title);
    if (details) {
      payload.set("line_items[0][price_data][product_data][description]", details);
    }
    payload.set("metadata[source]", body.source || "file");
    if (body.langPair) payload.set("metadata[lang_pair]", body.langPair);
    if (typeof body.words === "number") payload.set("metadata[words]", String(body.words));

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cache: "no-store",
    });

    const data = (await stripeRes.json()) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!stripeRes.ok || !data?.url) {
      return NextResponse.json(
        {
          ok: false,
          error: data?.error?.message || "No se pudo crear la sesión de pago.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, id: data.id, url: data.url });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Error creando checkout." },
      { status: 500 }
    );
  }
}
