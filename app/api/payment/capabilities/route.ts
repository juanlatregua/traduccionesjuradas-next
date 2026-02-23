import { NextResponse } from "next/server";
import { getPaymentCapabilities } from "@/lib/payment-config";

export const runtime = "nodejs";

export async function GET() {
  const capabilities = getPaymentCapabilities();
  return NextResponse.json({ ok: true, capabilities });
}
