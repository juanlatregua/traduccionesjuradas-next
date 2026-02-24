import crypto from "node:crypto";
import type { PaymentMethod, Prisma } from "@prisma/client";

type BuildKeyParams = {
  reference: string;
  provider: PaymentMethod;
  providerEventId: string;
};

type RegisterOrderPaymentEventArgs = BuildKeyParams & {
  tx: Prisma.TransactionClient;
  orderId: string;
  source?: string | null;
  payload?: unknown;
};

function toHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeText(value: string) {
  return String(value || "").trim();
}

export function normalizeProviderEventId(value: string) {
  return normalizeText(value).toLowerCase();
}

export function buildManualPaymentProviderEventId(reference: string, method: "BIZUM" | "TRANSFER") {
  return `manual:${normalizeText(reference).toUpperCase()}:${method}`;
}

export function buildOrderPaymentIdempotencyKey(params: BuildKeyParams) {
  const reference = normalizeText(params.reference).toUpperCase();
  const provider = normalizeText(params.provider).toUpperCase();
  const providerEventId = normalizeProviderEventId(params.providerEventId);
  if (!reference || !provider || !providerEventId) {
    throw new Error("No se pudo construir la clave de idempotencia de pago.");
  }
  return `opay_${toHash(`${reference}|${provider}|${providerEventId}`)}`;
}

export function isDuplicateOrderPaymentEventError(err: any) {
  return String(err?.code || "").toUpperCase() === "P2002";
}

export async function registerOrderPaymentEvent(args: RegisterOrderPaymentEventArgs) {
  const providerEventId = normalizeProviderEventId(args.providerEventId);
  if (!providerEventId) {
    throw new Error("Identificador externo de pago requerido.");
  }

  const idempotencyKey = buildOrderPaymentIdempotencyKey({
    reference: args.reference,
    provider: args.provider,
    providerEventId,
  });

  const source = normalizeText(String(args.source || "unknown")).toLowerCase() || "unknown";
  const payload =
    args.payload === undefined ? undefined : (args.payload as Prisma.InputJsonValue);

  try {
    const created = await args.tx.orderPaymentEvent.create({
      data: {
        orderId: args.orderId,
        provider: args.provider,
        providerEventId,
        idempotencyKey,
        source,
        ...(payload === undefined ? {} : { payload }),
      },
      select: {
        id: true,
      },
    });
    return {
      duplicate: false as const,
      providerEventId,
      idempotencyKey,
      eventLogId: created.id,
    };
  } catch (err: any) {
    if (isDuplicateOrderPaymentEventError(err)) {
      return {
        duplicate: true as const,
        providerEventId,
        idempotencyKey,
        eventLogId: null,
      };
    }
    throw err;
  }
}
