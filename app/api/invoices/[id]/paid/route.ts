// app/api/invoices/[id]/paid/route.ts
// STAFF ADMIN/PM: marca una factura emitida como cobrada (sella paidAt) o pendiente
// (lo limpia). Complemento manual a la conciliación bancaria (efectivo, o movimiento
// que no se importa). Usa el helper único setInvoicePaid — el MISMO camino y guarda
// que /api/bank/decision — para que solo exista una fuente de verdad del cobro.
//
// Admite además adjuntar el JUSTIFICANTE bancario del pago (Vercel Blob): al pasar
// `proof`, se guarda el adjunto y la factura queda cobrada de una vez. Al marcar
// pendiente (paid:false) se borra el justificante y su blob.

import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";
import { getStaffRole } from "@/lib/staff-access";
import { setInvoicePaid } from "@/lib/client-invoice";

export const runtime = "nodejs";

type Params = { params: { id: string } };

type ProofInput = { url?: string | null; key?: string | null; name?: string | null };

export async function POST(req: Request, { params }: Params) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });
  const role = getStaffRole(access.email);
  if (role !== "ADMIN" && role !== "PM") {
    return NextResponse.json({ ok: false, error: "Solo ADMIN/PM." }, { status: 403 });
  }

  let body: { paid?: boolean; date?: string | null; proof?: ProofInput | null } = {};
  try {
    body = await req.json();
  } catch {
    /* opcional */
  }

  const markPaid = body.paid !== false; // por defecto marca como cobrada
  const when: Date | null = markPaid
    ? body.date && !isNaN(new Date(body.date).getTime())
      ? new Date(body.date)
      : new Date()
    : null;

  const proofUrl = body.proof?.url?.trim() || "";
  const proofKey = body.proof?.key?.trim() || "";
  const proofName = body.proof?.name?.trim() || "";

  // Justificante anterior, para borrar su blob si se reemplaza o se quita.
  const prev = await prisma.clientInvoice.findUnique({
    where: { id: params.id },
    select: { paymentProofUrl: true },
  });
  const prevUrl = prev?.paymentProofUrl || "";

  try {
    if (markPaid) {
      // Sella cobro + (si llega) justificante en un único update atómico. Si es un
      // BORRADOR, setInvoicePaid lanza antes de tocar nada (no se sella ni se adjunta).
      const updated = await setInvoicePaid(
        params.id,
        when,
        proofUrl ? { url: proofUrl, key: proofKey || null, name: proofName || null } : undefined
      );
      // Reemplazo de justificante: borra el blob anterior (best-effort).
      if (proofUrl && prevUrl && prevUrl !== proofUrl) {
        await del(prevUrl).catch((e) => console.error("[invoice-paid] del blob anterior", e));
      }
      return NextResponse.json({
        ok: true,
        invoice: { id: updated.id, paidAt: updated.paidAt ? updated.paidAt.toISOString() : null },
      });
    }

    // Marcar pendiente: limpia cobro y justificante atómicamente; luego borra el blob.
    const updated = await setInvoicePaid(params.id, null, { url: null, key: null, name: null });
    if (prevUrl) {
      await del(prevUrl).catch((e) => console.error("[invoice-paid] del blob", e));
    }
    return NextResponse.json({
      ok: true,
      invoice: { id: updated.id, paidAt: updated.paidAt ? updated.paidAt.toISOString() : null },
    });
  } catch (err: any) {
    const msg = err?.message || "No se pudo actualizar la factura.";
    const status = msg.includes("no encontrada") ? 404 : 400;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
