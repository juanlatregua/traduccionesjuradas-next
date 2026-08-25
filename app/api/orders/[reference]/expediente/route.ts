import { NextResponse } from "next/server";
import { requireStaffAccess } from "@/lib/staff-auth";
import { buildExpedienteZip } from "@/lib/expediente-zip";

export const runtime = "nodejs";
export const maxDuration = 120;

/* «Descargar expediente» de la ficha del pedido (Juan, 25-ago-2026). Solo staff
   (sesión u OTP), con auditoría en OrderEvent. La construcción vive en
   lib/expediente-zip.ts. */
export async function GET(req: Request, { params }: { params: { reference: string } }) {
  const staff = await requireStaffAccess(req);
  if (!staff.ok) return NextResponse.json({ ok: false, error: staff.error }, { status: 403 });
  const zip = await buildExpedienteZip(params.reference, { by: staff.email });
  if (!zip) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  return new NextResponse(new Uint8Array(zip.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zip.folder}.zip"; filename*=UTF-8''${encodeURIComponent(zip.folder)}.zip`,
      "Content-Length": String(zip.buffer.length),
      "Cache-Control": "no-store",
    },
  });
}
