// app/api/cron/justificantes/route.ts — cada 15 min:
//  1. lee los justificantes subidos a pedidos y lanza los que cuadran (lib/payment-proof-auto);
//  2. sincroniza la bandeja, mira los justificantes que llegan por email y manda
//     al cliente el enlace para subirlo (no confirma nada);
//  3. recuerda la dirección de envío de los pedidos en papel ya lanzados.
// Fail-closed por CRON_SECRET como el resto de crons.
import { NextResponse } from "next/server";
import { processUploadedProofs } from "@/lib/payment-proof-auto";
import { scanInboxForPaymentProofs, sendUploadLinkForEmailedProofs } from "@/lib/payment-proof-inbox";
import { isInboxConfigured } from "@/lib/azure-mail-read";
import { syncInboxEmails } from "@/lib/inbox";
import { remindPendingShipping } from "@/lib/shipping-request";

export const runtime = "nodejs";
export const maxDuration = 300;

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err: any) {
    console.error(`[cron/justificantes] ${name}`, err?.message || err);
    return { error: String(err?.message || err).slice(0, 200) };
  }
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const subidos = await step("subidos", () => processUploadedProofs({ max: 10 }));
  const bandeja = isInboxConfigured() ? await step("sync", () => syncInboxEmails()) : { error: "bandeja no configurada" };
  const correo = await step("correo", () => scanInboxForPaymentProofs({ max: 20 }));
  const enlaces = await step("enlaces", () => sendUploadLinkForEmailedProofs());
  const envio = await step("envio", () => remindPendingShipping());

  return NextResponse.json({ ok: true, subidos, bandeja, correo, enlaces, envio });
}
