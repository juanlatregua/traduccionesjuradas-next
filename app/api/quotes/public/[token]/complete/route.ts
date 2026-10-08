// app/api/quotes/public/[token]/complete/route.ts — «Falta algo» de /q/[token].
//
// El cliente ve los documentos de su presupuesto y dice que falta alguno. Los
// ficheros suben directo a Vercel Blob por /api/documents/upload (kind
// "quote-completion": mismo almacén, mismos tipos y 20 MB que la puerta) y aquí
// llegan solo sus URLs. Sin schema nuevo: el aviso queda como StripeEventLog
// "client.docs_added" y el presupuesto figura «pendiente de completar» hasta que
// el staff lo vuelva a enviar. NO bloquea el pago: lo avisa la propia página.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { sendMail } from "@/lib/azure-mail";
import { sendEmailWithRetry } from "@/lib/email-retry";
import { COMPLETION_EVENT, COMPLETION_NOTE_MAX, COMPLETION_RATE, parseCompletionFiles } from "@/lib/q-journey";

export const runtime = "nodejs";

type Params = { params: { token: string } };

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function POST(req: Request, { params }: Params) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit({
    key: `quote-complete:${params.token}:${ip}`,
    ...COMPLETION_RATE,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    select: { id: true, quoteNumber: true, status: true, paidAt: true, customerName: true, customerEmail: true, deletedAt: true },
  });
  if (!quote || quote.deletedAt) {
    return NextResponse.json({ ok: false, error: "Presupuesto no encontrado." }, { status: 404 });
  }
  if (quote.paidAt || ["PAID", "IN_PROGRESS", "DELIVERED"].includes(quote.status)) {
    return NextResponse.json({ ok: false, error: "Este presupuesto ya está pagado. Escríbenos y lo vemos." }, { status: 400 });
  }

  const parsed = parseCompletionFiles(body?.files, quote.id);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: "Archivos no válidos.", code: parsed.code }, { status: 400 });
  }
  const note = String(body?.note || "").trim().slice(0, COMPLETION_NOTE_MAX);

  const at = new Date();
  await prisma.stripeEventLog.create({
    data: {
      eventId: `q-docs:${quote.id}:${at.getTime()}`,
      eventType: COMPLETION_EVENT,
      quoteId: quote.id,
      payload: { files: parsed.files, note, at: at.toISOString() },
    },
  });

  // Aviso a la casa: con el rastro ya guardado (arriba) y reintentos; si agota,
  // queda en FailedEmail y el banner de la ficha sigue ahí.
  const to = process.env.PRESUPUESTO_TO || "hola@traduccionesjuradas.net";
  const ficha = `https://www.traduccionesjuradas.net/zona-traductor/presupuestos/${quote.id}`;
  const links = parsed.files
    .map((f) => `<li><a href="${esc(f.url)}">${esc(f.name)}</a> (${(f.size / 1024 / 1024).toFixed(1)} MB)</li>`)
    .join("");
  await sendEmailWithRetry(() =>
    sendMail({
      to,
      replyTo: quote.customerEmail.endsWith("@whatsapp.local") ? undefined : quote.customerEmail,
      subject: `Documentos añadidos por el cliente — presupuesto ${quote.quoteNumber}`,
      html: `
        <h2>El cliente dice que faltaban documentos</h2>
        <p><strong>Presupuesto:</strong> ${esc(quote.quoteNumber)} · ${esc(quote.customerName || quote.customerEmail)}</p>
        <ul>${links}</ul>
        ${note ? `<p><strong>Nota:</strong> ${esc(note)}</p>` : ""}
        <p>Ha visto «Recibido. Te enviaremos el presupuesto actualizado». Puede pagar el presupuesto viejo, pero la página le avisa de que espere la versión nueva.</p>
        <p><a href="${ficha}" style="display:inline-block; background:#0891b2; color:#fff; padding:10px 24px; border-radius:8px; text-decoration:none; font-weight:600;">Abrir la ficha del presupuesto</a></p>
      `,
    })
  );

  return NextResponse.json({ ok: true });
}
