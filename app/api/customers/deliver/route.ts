// app/api/customers/deliver/route.ts
// STAFF: entrega directa de traducciones a un cliente que llegó por presupuesto /
// WhatsApp (sin pedido formal). Crea un PEDIDO ya ENTREGADO con los PDFs traducidos
// adjuntos, de modo que el cliente los ve y descarga en su portal (/area-cliente).
// Es la versión UI de lo que se hacía a mano. Los ficheros se suben antes a
// /api/upload (prefix=deliveries) y aquí llegan ya como URLs de Blob.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireStaffAccess } from "@/lib/staff-auth";

export const runtime = "nodejs";

type FileRef = { url?: string; key?: string | null; name?: string | null };
type Body = {
  clientEmail?: string;
  clientName?: string | null;
  title?: string;
  langPair?: string | null;
  amountCents?: number | null;
  translations?: FileRef[];
  originals?: FileRef[];
};

function twoDigits(n: number) {
  return String(n).padStart(2, "0");
}
async function generateReference() {
  const yy = twoDigits(new Date().getFullYear() % 100);
  for (let i = 0; i < 6; i += 1) {
    const ref = `${yy}_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const clash = await prisma.order.findUnique({ where: { reference: ref }, select: { id: true } });
    if (!clash) return ref;
  }
  throw new Error("No se pudo generar una referencia única.");
}

export async function POST(req: Request) {
  const access = await requireStaffAccess(req);
  if (!access.ok) return NextResponse.json({ ok: false, error: access.error }, { status: 403 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* opcional */
  }

  const clientEmail = String(body.clientEmail || "").trim().toLowerCase();
  if (!clientEmail) return NextResponse.json({ ok: false, error: "Falta el email del cliente." }, { status: 400 });

  const translations = (body.translations || []).filter((f) => f && f.url);
  if (translations.length === 0) {
    return NextResponse.json({ ok: false, error: "Adjunta al menos una traducción." }, { status: 400 });
  }
  const originals = (body.originals || []).filter((f) => f && f.url);

  const title = String(body.title || "").trim() || `Traducción jurada · ${translations.length} documento(s)`;
  const langPair = body.langPair?.trim() || null;
  const amountCents = Number.isFinite(body.amountCents) && (body.amountCents as number) > 0 ? Math.round(body.amountCents as number) : 0;

  // Nombre del cliente desde su ficha si existe (para el pedido).
  const customer = await prisma.customer.findFirst({
    where: { email: { equals: clientEmail, mode: "insensitive" } },
    select: { name: true, companyName: true },
  });
  const clientName = (body.clientName?.trim() || customer?.companyName || customer?.name || null) as string | null;

  const deliveryFilesJson = translations.map((f) => ({
    url: f.url,
    fileKey: f.key || undefined,
    filename: f.name || "Traducción jurada.pdf",
    mimeType: "application/pdf",
  }));

  // Un documentItem por traducción; empareja con el original por índice si lo hay.
  const documentItems = translations.map((t, i) => ({
    fileName: (t.name || `Documento ${i + 1}`).replace(/\.pdf$/i, ""),
    sourceLang: langPair ? langPair.split(/->|-/)[0]?.trim() || null : null,
    targetLang: langPair ? langPair.split(/->|-/)[1]?.trim() || null : null,
    prodStatus: "DELIVERED",
    fileUrl: originals[i]?.url || null,
    deliveredFileUrl: t.url || null,
    deliveredAt: new Date(),
  }));

  try {
    const reference = await generateReference();
    const order = await prisma.order.create({
      data: {
        reference,
        clientEmail,
        clientName,
        clientLocale: "es",
        source: "file",
        title,
        langPair,
        amountCents,
        currency: "eur",
        status: "DELIVERED",
        paymentStatus: "PENDING",
        deliveryState: "TRADUCIDO",
        deliveryType: "pdf",
        translatedFileUrl: translations[0].url,
        finalDeliveryFileUrl: translations[0].url,
        finalDeliveryFileKey: translations[0].key || null,
        finalFilename: translations[0].name || "Traducción jurada.pdf",
        finalMimeType: "application/pdf",
        deliveryFilesJson,
        documentItems: { create: documentItems },
        events: {
          create: [
            { type: "order.created", message: `Entrega directa creada por ${access.email}.` },
            { type: "order.delivered", message: "Traducciones adjuntadas y listas para el cliente." },
          ],
        },
      },
      select: { reference: true },
    });
    return NextResponse.json({ ok: true, reference: order.reference });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "No se pudo crear la entrega." }, { status: 400 });
  }
}
